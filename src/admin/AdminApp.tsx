'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Content } from '@/content/model';
import { ProjectsEditor, AboutEditor, ContactEditor, ExperienceEditor, ExpertiseEditor, FilesEditor, GeneralEditor, HeroEditor, ProcessEditor, SettingsEditor, TestimonialsEditor, type Edit } from '@/admin/editors';
import { btn, inputCls, NotifyContext, SCROLL_ID, scrollAdminTop, type Notify, api, SESSION_EVENT } from '@/admin/ui';

const TABS = [
  { id: 'general', label: 'Umum', note: 'Identitas, logo, menu, SEO' },
  { id: 'hero', label: 'Hero', note: 'Layar pertama' },
  { id: 'projects', label: 'Proyek', note: 'Featured & All Work' },
  { id: 'expertise', label: 'What I Do', note: 'Keahlian' },
  { id: 'process', label: 'How I Work', note: 'Langkah & portal' },
  { id: 'about', label: 'About', note: 'Foto & profil' },
  { id: 'experience', label: 'Experience', note: 'Strip foto' },
  { id: 'testimonials', label: 'Testimoni', note: 'Kelola komentar' },
  { id: 'contact', label: 'Kontak & Footer', note: 'Email, Instagram & link' },
  { id: 'files', label: 'Resume & Musik', note: 'Unggah PDF & audio' },
  { id: 'settings', label: 'Pengaturan', note: 'Password' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const TAB_KEY = 'hq-admin-tab';

type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };

export function AdminApp({ initial }: { initial: Content | null }) {
  const [content, setContent] = useState<Content | null>(initial);
  const [saved, setSaved] = useState(initial ? JSON.stringify(initial) : '');
  const [authed, setAuthed] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contentRef = useRef(content);
  contentRef.current = content;

  const notify: Notify = useCallback((text, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6500 : 3500);
  }, []);

  const current = useMemo(() => (content ? JSON.stringify(content) : ''), [content]);
  const dirty = !!content && current !== saved;

  const edit: Edit = useCallback(
    (fn) =>
      setContent((prev) => {
        if (!prev) return prev;
        const d = structuredClone(prev);
        fn(d);
        return d;
      }),
    [],
  );

  // remember the open tab for this browser session
  useEffect(() => {
    try {
      const t = sessionStorage.getItem(TAB_KEY) as Tab | null;
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    } catch {}
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem(TAB_KEY, t);
    } catch {}
    scrollAdminTop();
  };

  // any 401 → ask for the password again, keeping unsaved edits
  useEffect(() => {
    const onExpired = () => setAuthed(false);
    window.addEventListener(SESSION_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EVENT, onExpired);
  }, []);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const save = useCallback(async () => {
    const sent = contentRef.current;
    if (!sent || saving) return;
    setSaving(true);
    const sentJson = JSON.stringify(sent);
    try {
      const out = await api<Content>('/api/admin/content', { method: 'PUT', body: sentJson });
      const outJson = JSON.stringify(out);
      setSaved(outJson);
      // keep typing that happened while the request was in flight
      if (JSON.stringify(contentRef.current) === sentJson) setContent(out);
      notify('Tersimpan! Website utama sudah berubah.', 'ok');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, notify]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (authed) save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, authed]);

  const onLoggedIn = async () => {
    setAuthed(true);
    if (contentRef.current) {
      notify('Berhasil masuk kembali. Perubahan Anda masih ada — klik Simpan.', 'info');
      return;
    }
    try {
      const c = await api<Content>('/api/admin/content');
      setContent(c);
      setSaved(JSON.stringify(c));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal memuat konten.', 'error');
    }
  };

  const logout = async () => {
    if (dirty && !window.confirm('Ada perubahan yang belum disimpan. Tetap keluar?')) return;
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch {}
    setAuthed(false);
    setContent(null);
    setSaved('');
  };

  const revert = () => {
    if (!saved || !window.confirm('Batalkan semua perubahan sejak terakhir disimpan?')) return;
    setContent(JSON.parse(saved));
  };

  return (
    <NotifyContext.Provider value={notify}>
      <div id={SCROLL_ID} className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-[#0b0c0c] font-sans text-white antialiased [color-scheme:dark]">
        {content ? (
          <Dashboard
            c={content}
            edit={edit}
            tab={tab}
            choose={choose}
            dirty={dirty}
            saving={saving}
            save={save}
            revert={revert}
            logout={logout}
          />
        ) : (
          <Login onDone={onLoggedIn} />
        )}
        {content && !authed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <Login onDone={onLoggedIn} expired />
          </div>
        )}
        <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[60] flex sm:top-auto sm:bottom-4 w-[min(92vw,380px)] flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl border px-4 py-3 text-[13px] leading-snug shadow-2xl backdrop-blur ${
                t.tone === 'ok' ? 'border-[#2c8a4a]/50 bg-[#0f2416]/95 text-[#b9f5c9]' : t.tone === 'error' ? 'border-[#e11d2e]/50 bg-[#2a0a0d]/95 text-[#ffc2c7]' : 'border-white/15 bg-[#1b1d1d]/95 text-white/85'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </NotifyContext.Provider>
  );
}

/* ----------------------------------------------------------------------------------------------- */

function Login({ onDone, expired = false }: { onDone: () => void; expired?: boolean }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
      setPw('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={expired ? 'w-full max-w-sm' : 'relative flex min-h-full items-center justify-center overflow-hidden p-4'}>
      {!expired && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(184,9,26,0.45),transparent_70%),radial-gradient(40%_40%_at_100%_100%,rgba(92,7,16,0.5),transparent_70%)]" />
      )}
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#141616]/95 p-6 shadow-2xl sm:p-8">
        <div className="mb-6">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#c3101f] text-[18px] font-bold">G</div>
          <h1 className="text-[20px] font-semibold">{expired ? 'Sesi berakhir' : 'Masuk ke Admin'}</h1>
          <p className="mt-1 text-[13px] text-white/50">{expired ? 'Masukkan password lagi. Perubahan yang belum disimpan tetap aman.' : 'Kelola seluruh isi portfolio dari sini.'}</p>
        </div>
        <label htmlFor="admin-pw" className="mb-1.5 block text-[13px] font-medium text-white/85">
          Password
        </label>
        <div className="relative">
          <input
            id="admin-pw"
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            autoFocus
            className={`${inputCls} pr-20 ${error ? 'border-[#e11d2e]/70' : ''}`}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md px-2 py-1 text-[12px] text-white/55 hover:text-white">
            {show ? 'Sembunyikan' : 'Lihat'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-[#ff6b77]">
            {error}
          </p>
        )}
        <button type="submit" disabled={!pw || busy} className={`${btn.primary} mt-5 w-full py-2.5 text-[14px]`}>
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
        {!expired && (
          <a href="/" className="mt-4 block text-center text-[12px] text-white/40 hover:text-white/70">
            ← Kembali ke website
          </a>
        )}
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- */

function Dashboard({
  c,
  edit,
  tab,
  choose,
  dirty,
  saving,
  save,
  revert,
  logout,
}: {
  c: Content;
  edit: Edit;
  tab: Tab;
  choose: (t: Tab) => void;
  dirty: boolean;
  saving: boolean;
  save: () => void;
  revert: () => void;
  logout: () => void;
}) {
  const active = TABS.find((t) => t.id === tab)!;
  const status = saving ? ['Menyimpan…', 'bg-white/60'] : dirty ? ['Belum disimpan', 'bg-[#ffb020]'] : ['Semua tersimpan', 'bg-[#3ddc6f]'];
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0b0c0c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c3101f] text-[14px] font-bold">G</span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">Admin · {c.site.person.name}</p>
              <p className="flex items-center gap-1.5 text-[12px] text-white/50">
                <span className={`inline-block h-2 w-2 rounded-full ${status[1]}`} />
                {status[0]}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && !saving && (
              <button type="button" className={btn.ghost} onClick={revert}>
                Batalkan
              </button>
            )}
            <a href="/" target="_blank" rel="noreferrer" className={btn.secondary}>
              Lihat website ↗
            </a>
            <button type="button" className={btn.primary} onClick={save} disabled={!dirty || saving} title="Ctrl + S">
              {saving ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
            <button type="button" className={btn.ghost} onClick={logout}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6 lg:py-8">
        <nav aria-label="Bagian" className="lg:sticky lg:top-[88px] lg:w-60 lg:shrink-0 lg:self-start">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {TABS.map((t) => (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => choose(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left transition ${tab === t.id ? 'bg-[#c3101f] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'}`}
                >
                  <span className="block text-[13px] font-medium whitespace-nowrap">{t.label}</span>
                  <span className={`hidden text-[11px] lg:block ${tab === t.id ? 'text-white/75' : 'text-white/35'}`}>{t.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 space-y-6 pb-24">
          <div>
            <h1 className="text-[22px] font-semibold">{active.label}</h1>
            <p className="mt-0.5 text-[13px] text-white/45">{active.note}. Perubahan baru tampil di website setelah klik “Simpan perubahan”.</p>
          </div>
          {tab === 'general' && <GeneralEditor c={c} edit={edit} />}
          {tab === 'hero' && <HeroEditor c={c} edit={edit} />}
          {tab === 'projects' && <ProjectsEditor c={c} edit={edit} dirty={dirty} />}
          {tab === 'expertise' && <ExpertiseEditor c={c} edit={edit} />}
          {tab === 'process' && <ProcessEditor c={c} edit={edit} />}
          {tab === 'about' && <AboutEditor c={c} edit={edit} />}
          {tab === 'experience' && <ExperienceEditor c={c} edit={edit} />}
          {tab === 'testimonials' && <TestimonialsEditor c={c} edit={edit} />}
          {tab === 'contact' && <ContactEditor c={c} edit={edit} />}
          {tab === 'files' && <FilesEditor c={c} edit={edit} />}
          {tab === 'settings' && <SettingsEditor />}
        </main>
      </div>

      {/* floating save on small screens */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0c0c]/95 p-3 backdrop-blur sm:hidden">
          <button type="button" className={`${btn.primary} w-full py-3`} onClick={save} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        </div>
      )}
    </div>
  );
}
