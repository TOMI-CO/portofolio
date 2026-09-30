import crypto from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  clearFailures,
  clearSessionCookie,
  clientIp,
  createSessionCookie,
  guard,
  isAuthed,
  isHttps,
  lockedFor,
  recordFailure,
  sameOrigin,
  setPassword,
  verifyPassword,
} from '@/server/auth';
import { getContent, saveContent, UPLOAD_DIR, RULES, sniffOk, type UploadKind } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin API, one route per action (the URLs stay /api/admin/<action>):
 *   POST login · POST logout · GET session · GET/PUT content · POST password · POST upload
 */
type Ctx = { params: Promise<{ action: string }> };
type Handler = (req: Request) => Promise<Response>;

const notFound = () => Response.json({ error: 'Tidak ditemukan.' }, { status: 404 });

async function dispatch(req: Request, ctx: Ctx, table: Record<string, Handler>) {
  const { action } = await ctx.params;
  const h = Object.hasOwn(table, action) ? table[action] : undefined;
  return h ? h(req) : notFound();
}

export const GET = (req: Request, ctx: Ctx) => dispatch(req, ctx, { session, content: getContentRoute });
export const PUT = (req: Request, ctx: Ctx) => dispatch(req, ctx, { content: putContent });
export const POST = (req: Request, ctx: Ctx) => dispatch(req, ctx, { login, logout, password, upload });

/* ---- login / logout / session ------------------------------------------------------------- */

async function login(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Permintaan ditolak.' }, { status: 403 });
  const ip = clientIp(req);
  const wait = lockedFor(ip);
  if (wait) return Response.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(wait / 60)} menit.` }, { status: 429 });
  let pw = '';
  try {
    const body = await req.json();
    pw = typeof body?.password === 'string' ? body.password : '';
  } catch {}
  if (await verifyPassword(pw)) {
    clearFailures(ip);
    await createSessionCookie(isHttps(req));
    return Response.json({ ok: true });
  }
  recordFailure(ip);
  await new Promise((r) => setTimeout(r, 450));
  return Response.json({ error: 'Password salah.' }, { status: 401 });
}

async function logout(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Permintaan ditolak.' }, { status: 403 });
  await clearSessionCookie();
  return Response.json({ ok: true });
}

async function session() {
  return Response.json({ authed: await isAuthed() }, { headers: { 'Cache-Control': 'no-store' } });
}

/* ---- content ------------------------------------------------------------------------------ */

async function getContentRoute(req: Request) {
  const denied = await guard(req, false);
  if (denied) return denied;
  return Response.json(await getContent(), { headers: { 'Cache-Control': 'no-store' } });
}

async function putContent(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const text = await req.text();
  if (text.length > 4_000_000) return Response.json({ error: 'Konten terlalu besar.' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Format data tidak valid.' }, { status: 400 });
  }
  try {
    const saved = await saveContent(body);
    return Response.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin] save failed', e);
    return Response.json({ error: 'Gagal menyimpan ke disk. Periksa izin folder storage/.' }, { status: 500 });
  }
}

/* ---- password ----------------------------------------------------------------------------- */

async function password(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  let current = '';
  let next = '';
  try {
    const b = await req.json();
    current = typeof b?.current === 'string' ? b.current : '';
    next = typeof b?.next === 'string' ? b.next : '';
  } catch {}
  if (!(await verifyPassword(current))) return Response.json({ error: 'Password lama salah.' }, { status: 400 });
  if (next.length < 8 || next.length > 200) return Response.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
  await setPassword(next);
  return Response.json({ ok: true });
}

/* ---- upload ------------------------------------------------------------------------------- */

const KINDS = Object.keys(RULES) as UploadKind[];
const MB = 1024 * 1024;

/**
 * The raw file is the request body, with headers X-Upload-Kind (image|video|pdf|audio) and
 * X-File-Name (URI-encoded). The body is streamed straight to disk — a 500 MB video never sits in
 * memory — while the size limit and the magic bytes are checked on the way. → { url, name, size }
 */
async function upload(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;

  const kind = (req.headers.get('x-upload-kind') || '') as UploadKind;
  let original = '';
  try {
    original = decodeURIComponent(req.headers.get('x-file-name') || '');
  } catch {}
  if (!KINDS.includes(kind)) return Response.json({ error: 'Jenis file tidak dikenal.' }, { status: 400 });
  const rule = RULES[kind];
  const ext = (original.split('.').pop() || '').toLowerCase();
  if (!rule.ext.includes(ext)) return Response.json({ error: `Format .${ext || '?'} tidak didukung. Gunakan: ${rule.ext.join(', ')}.` }, { status: 415 });
  const tooBig = `File terlalu besar (maks ${Math.round(rule.max / MB)} MB).`;
  if (Number(req.headers.get('content-length') || 0) > rule.max) return Response.json({ error: tooBig }, { status: 413 });
  if (!req.body) return Response.json({ error: 'Tidak ada file.' }, { status: 400 });

  const month = new Date().toISOString().slice(0, 7);
  const name = `${crypto.randomBytes(9).toString('base64url')}.${ext}`;
  const dir = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, kind, month);
  const final = path.join(/*turbopackIgnore: true*/ dir, name);
  const part = `${final}.part`;
  await fs.mkdir(dir, { recursive: true });

  const out = createWriteStream(part, { flags: 'wx' });
  const reader = req.body.getReader();
  const fail = async (status: number, error: string) => {
    reader.cancel().catch(() => {});
    out.destroy();
    await fs.unlink(part).catch(() => {});
    return Response.json({ error }, { status });
  };

  let size = 0;
  let head = Buffer.alloc(0);
  let sniffed = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > rule.max) return fail(413, tooBig);
      if (!sniffed) {
        head = Buffer.concat([head, value]);
        if (head.length >= 64) {
          if (!sniffOk(ext, head)) return fail(415, 'Isi file tidak sesuai dengan formatnya.');
          sniffed = true;
        }
      }
      if (!out.write(value)) await once(out, 'drain');
    }
    if (!size) return fail(400, 'File kosong.');
    if (!sniffed && !sniffOk(ext, head)) return fail(415, 'Isi file tidak sesuai dengan formatnya.');
    out.end();
    await once(out, 'finish');
    await fs.rename(part, final);
  } catch (e) {
    console.error('[admin] upload failed', e);
    return fail(500, 'Unggahan terputus atau gagal disimpan. Coba lagi.');
  }
  return Response.json({ url: `/uploads/${kind}/${month}/${name}`, name: original, size });
}
