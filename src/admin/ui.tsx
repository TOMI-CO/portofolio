'use client';

import { createContext, useContext, useId, useRef, useState } from 'react';
import type { Media } from '@/content/model';

// ---- upload
export type UploadKind = 'image' | 'video' | 'pdf' | 'audio';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

/** Fired when any admin request answers 401 — the app shows the login again (edits are kept). */
export const SESSION_EVENT = 'hq-admin-session-expired';

export const ACCEPT: Record<UploadKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif',
  video: 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov',
  pdf: 'application/pdf,.pdf',
  audio: 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav',
};

/** same limits as the server (src/server/files.ts) */
export const LIMIT_MB: Record<UploadKind, number> = { image: 500, video: 500, pdf: 500, audio: 500 };

async function readError(res: { status: number; text: string }) {
  let msg = '';
  try {
    msg = JSON.parse(res.text)?.error ?? '';
  } catch {}
  if (res.status === 401) window.dispatchEvent(new Event(SESSION_EVENT));
  return new ApiError(msg || (res.status === 413 ? 'File terlalu besar.' : `Gagal (kode ${res.status || 'jaringan'}).`), res.status);
}

/** JSON request to the admin API with readable Indonesian errors. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' });
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.');
  }
  const text = await res.text();
  if (!res.ok) throw await readError({ status: res.status, text });
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Upload with progress (XHR: fetch has no upload progress). The file itself is the request body,
 * so the server can stream it to disk — large videos (up to 500 MB) never have to fit in memory.
 */
export function uploadFile(file: File, kind: UploadKind, onProgress?: (p: number) => void) {
  return new Promise<{ url: string; name: string; size: number }>((resolve, reject) => {
    if (file.size > LIMIT_MB[kind] * 1024 * 1024) return reject(new ApiError(`File terlalu besar (maks ${LIMIT_MB[kind]} MB).`, 413));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.setRequestHeader('X-Upload-Kind', kind);
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError('Unggahan terputus. Periksa koneksi lalu coba lagi.'));
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new ApiError('Jawaban server tidak valid.'));
        }
      } else reject(await readError({ status: xhr.status, text: xhr.responseText }));
    };
    xhr.send(file);
  });
}

const ext = (name: string) => (name.split('.').pop() || '').toLowerCase();
const SERVER_IMAGE = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const MAX_SIDE = 2400;

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ApiError('Gambar tidak bisa dibaca. Gunakan JPG, PNG atau WEBP.'));
    img.src = src;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, name: string, quality = 0.88) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) return reject(new ApiError('Gagal memproses gambar.'));
        // browsers without WebP encoding fall back to PNG
        const type = b.type || 'image/png';
        const e = type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'png';
        resolve(new File([b], `${name.replace(/\.[^.]+$/, '') || 'image'}.${e}`, { type }));
      },
      'image/webp',
      quality,
    );
  });
}

/**
 * Photos: very large ones are scaled down (longest side 2400px) and formats the server doesn't take
 * (e.g. HEIC from a phone, when the browser can decode it) are converted. Returns the file to
 * upload and its width/height ratio.
 */
export async function prepareImage(file: File): Promise<{ file: File; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new ApiError('Gambar tidak bisa dibaca.');
    const aspect = w / h;
    const e = ext(file.name);
    const convertible = e !== 'gif'; // keep animated gifs as they are
    if (convertible && (Math.max(w, h) > MAX_SIDE || !SERVER_IMAGE.includes(e) || file.size > 20 * 1024 * 1024)) {
      const k = Math.min(1, MAX_SIDE / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * k);
      c.height = Math.round(h * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      return { file: await canvasToFile(c, file.name), aspect };
    }
    return { file, aspect };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Videos: reads the ratio and grabs a still frame (~1s in) to use as the thumbnail/poster. */
export async function probeVideo(file: File): Promise<{ aspect: number; poster: File | null }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  try {
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new ApiError('Video tidak bisa dibaca browser. Gunakan MP4 (H.264).'));
      v.src = url;
    });
    const aspect = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    let poster: File | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 8000);
        v.onseeked = () => {
          clearTimeout(t);
          resolve();
        };
        v.currentTime = Math.min(1, (v.duration || 2) * 0.1);
      });
      const k = Math.min(1, 1600 / Math.max(1, v.videoWidth));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(v.videoWidth * k));
      c.height = Math.max(1, Math.round(v.videoHeight * k));
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      poster = await canvasToFile(c, `${file.name}-poster`, 0.85);
    } catch {
      poster = null; // no poster is fine: the first frame shows instead
    }
    return { aspect, poster };
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** Ratio of an image or video that is already online (pasted URL). */
export function measureUrl(src: string, type: 'image' | 'video') {
  return new Promise<number | undefined>((resolve) => {
    const done = (a?: number) => resolve(a && isFinite(a) && a > 0 ? a : undefined);
    setTimeout(() => done(), 8000);
    if (type === 'image') {
      const i = new Image();
      i.onload = () => done(i.naturalWidth / i.naturalHeight);
      i.onerror = () => done();
      i.src = src;
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => done(v.videoWidth / v.videoHeight);
      v.onerror = () => done();
      v.src = src;
    }
  });
}

export const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function kindOfFile(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext(file.name))) return 'video';
  if (file.type.startsWith('image/') || [...SERVER_IMAGE, 'heic', 'heif'].includes(ext(file.name))) return 'image';
  return null;
}

// ---- ui
/* ----------------------------------------------------------------------------------------------- */
/* Toasts                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

/** the admin page scrolls inside this element (the site locks html/body scrolling) */
export const SCROLL_ID = 'admin-scroll';
export const scrollAdminTop = () => document.getElementById(SCROLL_ID)?.scrollTo({ top: 0 });

export type Notify = (text: string, tone?: 'ok' | 'error' | 'info') => void;
export const NotifyContext = createContext<Notify>(() => {});
export const useNotify = () => useContext(NotifyContext);

/* ----------------------------------------------------------------------------------------------- */
/* Styles                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export const inputCls =
  'w-full rounded-lg border border-white/12 bg-[#0c0d0d] px-3 py-2 text-[14px] text-white placeholder:text-white/28 outline-none transition focus:border-[#e11d2e] focus:ring-2 focus:ring-[#e11d2e]/25 disabled:opacity-50';

const btnBase = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45';
export const btn = {
  primary: `${btnBase} bg-[#c3101f] px-4 py-2 text-white hover:bg-[#dc1628]`,
  secondary: `${btnBase} border border-white/14 bg-white/[0.04] px-3 py-2 text-white/90 hover:border-white/28 hover:bg-white/[0.08]`,
  ghost: `${btnBase} px-2.5 py-1.5 text-white/65 hover:bg-white/[0.07] hover:text-white`,
  danger: `${btnBase} border border-[#e11d2e]/40 px-3 py-2 text-[#ff6b77] hover:bg-[#e11d2e]/12`,
  icon: `${btnBase} h-8 w-8 text-white/60 hover:bg-white/[0.08] hover:text-white`,
};

/* ----------------------------------------------------------------------------------------------- */
/* Layout                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export function Card({ title, description, actions, children }: { title?: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#161818] p-4 sm:p-6">
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[16px] font-semibold text-white">{title}</h2>}
            {description && <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-white/50">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid grid-cols-1 gap-5 ${cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>{children}</div>;
}

export function Field({ label, hint, htmlFor, children, counter }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; counter?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-white/85">
          {label}
        </label>
        {counter && <span className="text-[11px] text-white/35 tabular-nums">{counter}</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-[12px] leading-relaxed text-white/42">{hint}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Inputs                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
  max,
  type = 'text',
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  max?: number;
  type?: 'text' | 'email' | 'url';
  invalid?: string | false;
}) {
  const id = useId();
  return (
    <Field label={label} hint={invalid || hint} htmlFor={id} counter={max ? `${value.length}/${max}` : undefined}>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${invalid ? 'border-[#e11d2e]/70' : ''}`}
        autoComplete="off"
        spellCheck={type === 'text'}
      />
    </Field>
  );
}

export function Area({ label, value, onChange, placeholder, hint, max, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: React.ReactNode; max?: number; rows?: number }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} counter={max ? `${value.length}/${max}` : undefined}>
      <textarea id={id} value={value} maxLength={max} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y leading-relaxed`} />
    </Field>
  );
}

export function Select({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: React.ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} cursor-pointer`}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#161818]">
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${checked ? 'bg-[#c3101f]' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span>
        <span className="block text-[13px] font-medium text-white/85">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-white/42">{hint}</span>}
      </span>
    </label>
  );
}

/** Fixed number of one-line inputs (e.g. the hero headline: 3 lines). */
export function Lines({ label, value, onChange, count, hint, placeholder, max = 60 }: { label: string; value: string[]; onChange: (v: string[]) => void; count: number; hint?: React.ReactNode; placeholder?: string; max?: number }) {
  const lines = Array.from({ length: count }, (_, i) => value[i] ?? '');
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[11px] text-white/35 tabular-nums">{i + 1}</span>
            <input
              value={l}
              maxLength={max}
              placeholder={placeholder}
              aria-label={`${label} — baris ${i + 1}`}
              onChange={(e) => onChange(lines.map((x, k) => (k === i ? e.target.value : x)))}
              className={inputCls}
            />
          </div>
        ))}
      </div>
    </Field>
  );
}

/** Chips: type and press Enter (or comma) to add, × to remove. */
export function Tags({ label, value, onChange, placeholder = 'Ketik lalu tekan Enter', hint, max = 20 }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: React.ReactNode; max?: number }) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const add = (raw: string) => {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.includes(s));
    if (items.length) onChange([...value, ...items].slice(0, max));
    setDraft('');
  };
  return (
    <Field label={label} hint={hint ?? `Tekan Enter atau koma untuk menambah (maks ${max}). ← → mengubah urutan.`} htmlFor={id}>
      <div className={`${inputCls} flex flex-wrap items-center gap-1.5 !py-1.5`}>
        {value.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-0.5 rounded-md bg-white/10 py-0.5 pr-0.5 pl-2 text-[12px] text-white">
            {t}
            <button
              type="button"
              aria-label={`Geser ${t} ke kiri`}
              disabled={i === 0}
              onClick={() => onChange(move(value, i, -1))}
              className="cursor-pointer rounded px-1 text-white/45 hover:text-white disabled:hidden"
            >
              ←
            </button>
            <button
              type="button"
              aria-label={`Geser ${t} ke kanan`}
              disabled={i === value.length - 1}
              onClick={() => onChange(move(value, i, 1))}
              className="cursor-pointer rounded px-1 text-white/45 hover:text-white disabled:hidden"
            >
              →
            </button>
            <button type="button" aria-label={`Hapus ${t}`} onClick={() => onChange(value.filter((_, k) => k !== i))} className="cursor-pointer rounded px-1 text-white/55 hover:bg-white/10 hover:text-white">
              ×
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            id={id}
            value={draft}
            placeholder={value.length ? '' : placeholder}
            onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(draft);
              } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => draft.trim() && add(draft)}
            className="min-w-[8rem] flex-1 bg-transparent py-1 text-[14px] text-white outline-none placeholder:text-white/28"
          />
        )}
      </div>
    </Field>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Lists                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Up / down / delete controls for one list row. */
export function RowTools({ index, length, onMove, onRemove, removeLabel = 'Hapus', confirmText }: { index: number; length: number; onMove: (d: number) => void; onRemove?: () => void; removeLabel?: string; confirmText?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" className={btn.icon} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Naikkan" title="Naikkan">
        ↑
      </button>
      <button type="button" className={btn.icon} disabled={index === length - 1} onClick={() => onMove(1)} aria-label="Turunkan" title="Turunkan">
        ↓
      </button>
      {onRemove && (
        <button
          type="button"
          className={`${btn.icon} hover:!bg-[#e11d2e]/15 hover:!text-[#ff6b77]`}
          onClick={() => (!confirmText || window.confirm(confirmText)) && onRemove()}
          aria-label={removeLabel}
          title={removeLabel}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

export function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

/** A numbered, reorderable block inside a list editor. */
export function ListItem({ index, length, title, onMove, onRemove, confirmText, children }: { index: number; length: number; title: React.ReactNode; onMove: (d: number) => void; onRemove: () => void; confirmText?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111313] p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-white/70">
          <span className="mr-2 text-white/35 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          {title}
        </span>
        <RowTools index={index} length={length} onMove={onMove} onRemove={onRemove} confirmText={confirmText} />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function AddButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${btn.secondary} w-full border-dashed py-3`}>
      <span aria-hidden="true" className="text-[16px] leading-none">
        +
      </span>{' '}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Uploads                                                                                         */
/* ----------------------------------------------------------------------------------------------- */

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[12px] text-white/60">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#e11d2e] transition-[width]" style={{ width: `${Math.max(3, value * 100)}%` }} />
      </div>
    </div>
  );
}

/** Upload a photo or a video (or paste a link); computes the ratio and a poster for videos. */
export async function uploadMedia(file: File, type: 'image' | 'video', onProgress: (p: number, label: string) => void): Promise<Media> {
  if (type === 'image') {
    onProgress(0, 'Menyiapkan gambar…');
    const { file: f, aspect } = await prepareImage(file);
    const up = await uploadFile(f, 'image', (p) => onProgress(p, `Mengunggah ${fmtSize(f.size)}…`));
    return { type: 'image', src: up.url, aspect };
  }
  onProgress(0, 'Membaca video…');
  const { aspect, poster } = await probeVideo(file);
  const up = await uploadFile(file, 'video', (p) => onProgress(p * 0.94, `Mengunggah video ${fmtSize(file.size)}…`));
  let posterUrl: string | undefined;
  if (poster) {
    try {
      posterUrl = (await uploadFile(poster, 'image', (p) => onProgress(0.94 + p * 0.06, 'Menyimpan thumbnail…'))).url;
    } catch {
      posterUrl = undefined;
    }
  }
  return { type: 'video', src: up.url, poster: posterUrl, aspect };
}

function MediaPreview({ m, className = '' }: { m: Media; className?: string }) {
  if (!m.src) return null;
  return m.type === 'video' ? (
    <video src={m.src} poster={m.poster || undefined} muted loop playsInline autoPlay preload="metadata" className={`h-full w-full object-cover ${className}`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.src} alt="" className={`h-full w-full object-cover ${className}`} />
  );
}

/**
 * Main media field: photo or video, drag & drop or pick, with preview, replace, remove and
 * "paste a link". `types` limits what may be chosen (e.g. only photos for a hover image).
 */
export function MediaInput({
  label,
  value,
  onChange,
  types = ['image', 'video'],
  allowEmpty = false,
  hint,
  withCaption = false,
}: {
  label: string;
  value: Media | null;
  onChange: (m: Media | null) => void;
  types?: ('image' | 'video')[];
  allowEmpty?: boolean;
  hint?: React.ReactNode;
  withCaption?: boolean;
}) {
  const notify = useNotify();
  const [type, setType] = useState<'image' | 'video'>(value?.type && types.includes(value.type) ? value.type : types[0]);
  const [busy, setBusy] = useState<{ p: number; label: string } | null>(null);
  const [over, setOver] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
    const kind = isVideo ? 'video' : 'image';
    if (!types.includes(kind)) return notify(types.includes('image') ? 'Bagian ini hanya menerima foto.' : 'Bagian ini hanya menerima video.', 'error');
    if (file.size > LIMIT_MB[kind] * 1024 * 1024) return notify(`File terlalu besar (maks ${LIMIT_MB[kind]} MB).`, 'error');
    setBusy({ p: 0, label: 'Menyiapkan…' });
    try {
      const m = await uploadMedia(file, kind, (p, l) => setBusy({ p, label: l }));
      setType(kind);
      onChange({ ...m, caption: value?.caption });
      notify(kind === 'video' ? 'Video terunggah. Jangan lupa klik Simpan.' : 'Foto terunggah. Jangan lupa klik Simpan.', 'ok');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal mengunggah.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const applyLink = async () => {
    const src = link.trim();
    if (!/^https:\/\/\S+$/i.test(src) && !/^\/\S+$/.test(src)) return notify('Link harus diawali https://', 'error');
    setBusy({ p: 0.5, label: 'Memeriksa link…' });
    const aspect = await measureUrl(src, type);
    setBusy(null);
    if (!aspect) notify('Link tidak bisa dibuka sebagai ' + (type === 'image' ? 'gambar' : 'video') + '. Periksa kembali.', 'error');
    onChange({ type, src, aspect: aspect ?? (type === 'video' ? 16 / 9 : 4 / 3), caption: value?.caption });
    setLinkOpen(false);
    setLink('');
  };

  const setPoster = async (file: File | undefined) => {
    if (!file || !value) return;
    setBusy({ p: 0, label: 'Mengunggah thumbnail…' });
    try {
      const { file: f } = await prepareImage(file);
      const up = await uploadFile(f, 'image', (p) => setBusy({ p, label: 'Mengunggah thumbnail…' }));
      onChange({ ...value, poster: up.url });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal mengunggah.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const accept = types.map((t) => ACCEPT[t]).join(',');
  return (
    <Field label={label} hint={hint}>
      <div
        className={`rounded-xl border border-dashed p-3 transition ${over ? 'border-[#e11d2e] bg-[#e11d2e]/8' : 'border-white/15 bg-[#0c0d0d]'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
      >
        {types.length > 1 && !value?.src && (
          <div className="mb-3 inline-flex rounded-lg bg-white/[0.06] p-0.5 text-[12px]">
            {types.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`cursor-pointer rounded-md px-3 py-1 transition ${type === t ? 'bg-[#c3101f] text-white' : 'text-white/60 hover:text-white'}`}>
                {t === 'image' ? 'Foto' : 'Video'}
              </button>
            ))}
          </div>
        )}

        {value?.src ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black sm:w-56">
              <MediaPreview m={value} />
              <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">{value.type === 'video' ? 'Video' : 'Foto'}</span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-[12px] text-white/45" title={value.src}>
                {value.src}
              </p>
              {value.aspect && <p className="text-[12px] text-white/45">Rasio {value.aspect >= 1 ? `${value.aspect.toFixed(2)} : 1 (lanskap)` : `1 : ${(1 / value.aspect).toFixed(2)} (potret)`}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn.secondary} onClick={() => fileRef.current?.click()} disabled={!!busy}>
                  Ganti file
                </button>
                {value.type === 'video' && (
                  <button type="button" className={btn.secondary} onClick={() => posterRef.current?.click()} disabled={!!busy}>
                    {value.poster ? 'Ganti thumbnail' : 'Pasang thumbnail'}
                  </button>
                )}
                {allowEmpty && (
                  <button type="button" className={btn.danger} onClick={() => onChange(null)} disabled={!!busy}>
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-[13px] text-white/70">
              Seret {type === 'image' ? 'foto' : 'video'} ke sini atau
              <button type="button" className="ml-1 cursor-pointer font-medium text-[#ff5c69] underline-offset-2 hover:underline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                pilih file
              </button>
            </p>
            <p className="text-[11px] text-white/38">
              {type === 'image' ? `JPG, PNG, WEBP, GIF · maks ${LIMIT_MB.image} MB · foto besar otomatis diperkecil` : `MP4 (disarankan), WEBM, MOV · maks ${LIMIT_MB.video} MB`}
            </p>
          </div>
        )}

        {busy && (
          <div className="mt-3">
            <Progress value={busy.p} label={busy.label} />
          </div>
        )}

        <div className="mt-3 border-t border-white/[0.06] pt-2">
          {linkOpen ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputCls} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyLink())} />
              <div className="flex gap-2">
                <button type="button" className={btn.secondary} onClick={applyLink}>
                  Pakai link
                </button>
                <button type="button" className={btn.ghost} onClick={() => setLinkOpen(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="cursor-pointer text-[12px] text-white/45 hover:text-white/80" onClick={() => setLinkOpen(true)}>
              atau tempel link {type === 'image' ? 'gambar' : 'video'} (https://)
            </button>
          )}
        </div>
      </div>

      {withCaption && value?.src && (
        <input
          value={value.caption ?? ''}
          onChange={(e) => onChange({ ...value, caption: e.target.value || undefined })}
          placeholder="Keterangan (opsional)"
          maxLength={300}
          className={`${inputCls} mt-2`}
        />
      )}

      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => (handle(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={posterRef} type="file" accept={ACCEPT.image} className="hidden" onChange={(e) => (setPoster(e.target.files?.[0]), (e.target.value = ''))} />
    </Field>
  );
}

/** A simple photo (portrait, experience photo, testimonial avatar) stored as a URL string. */
export function PhotoInput({ label, value, onChange, hint, round = false, aspect = '4 / 5' }: { label: string; value: string; onChange: (v: string) => void; hint?: React.ReactNode; round?: boolean; aspect?: string }) {
  const notify = useNotify();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(0);
    try {
      const { file: f } = await prepareImage(file);
      const up = await uploadFile(f, 'image', (p) => setBusy(p));
      onChange(up.url);
      notify('Foto terunggah. Jangan lupa klik Simpan.', 'ok');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal mengunggah.', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Field label={label} hint={hint}>
      <div
        className="flex items-center gap-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <div className={`relative shrink-0 overflow-hidden bg-[#0c0d0d] ring-1 ring-white/12 ${round ? 'h-14 w-14 rounded-full' : 'w-20 rounded-lg'}`} style={round ? undefined : { aspectRatio: aspect }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/30">Kosong</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => ref.current?.click()} disabled={busy !== null}>
            {busy !== null ? `Mengunggah ${Math.round(busy * 100)}%` : value ? 'Ganti foto' : 'Unggah foto'}
          </button>
          {value && (
            <button type="button" className={btn.ghost} onClick={() => onChange('')} disabled={busy !== null}>
              Hapus
            </button>
          )}
        </div>
      </div>
      <input ref={ref} type="file" accept={ACCEPT.image} className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
    </Field>
  );
}

/** Resume (PDF) or music (audio) file: upload, see current file, remove. */
export function FileInput({ label, kind, value, onChange, onUploaded, hint, emptyText }: { label: string; kind: Extract<UploadKind, 'pdf' | 'audio'>; value: string; onChange: (url: string) => void; onUploaded?: (name: string) => void; hint?: React.ReactNode; emptyText: string }) {
  const notify = useNotify();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > LIMIT_MB[kind] * 1024 * 1024) return notify(`File terlalu besar (maks ${LIMIT_MB[kind]} MB).`, 'error');
    setBusy(0);
    try {
      const up = await uploadFile(file, kind, (p) => setBusy(p));
      onChange(up.url);
      onUploaded?.(file.name);
      notify('File terunggah. Jangan lupa klik Simpan.', 'ok');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal mengunggah.', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-white/15 bg-[#0c0d0d] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-[13px]">
          {value ? (
            <a href={value} target="_blank" rel="noreferrer" className="block truncate text-[#ff5c69] hover:underline">
              {value}
            </a>
          ) : (
            <span className="text-white/45">{emptyText}</span>
          )}
          {kind === 'audio' && value && <audio src={value} controls className="mt-2 h-8 w-full max-w-sm" />}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={btn.secondary} onClick={() => ref.current?.click()} disabled={busy !== null}>
            {busy !== null ? `Mengunggah ${Math.round(busy * 100)}%` : value ? 'Ganti file' : 'Unggah file'}
          </button>
          {value && (
            <button type="button" className={btn.ghost} onClick={() => onChange('')} disabled={busy !== null}>
              Hapus
            </button>
          )}
        </div>
      </div>
      <input ref={ref} type="file" accept={ACCEPT[kind]} className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
    </Field>
  );
}
