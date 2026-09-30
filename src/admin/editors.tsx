'use client';

import { useState, useRef } from 'react';
import { newId, type Content, categoryLabel, slugify, stillOf, type Media, type Project } from '@/content/model';
import { AddButton, Area, btn, Card, Field, FileInput, Grid, inputCls, Lines, ListItem, move, PhotoInput, RowTools, Select, Tags, Text, Toggle, useNotify, api, MediaInput, scrollAdminTop, TrashIcon, uploadMedia, ACCEPT, kindOfFile } from '@/admin/ui';

// ---- sections
export type Edit = (fn: (d: Content) => void) => void;
export type EditorProps = { c: Content; edit: Edit };

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/* ----------------------------------------------------------------------------------------------- */
/* Umum                                                                                            */
/* ----------------------------------------------------------------------------------------------- */

const ZONES = [
  ['Asia/Jakarta', 'WIB — Jakarta'],
  ['Asia/Makassar', 'WITA — Makassar'],
  ['Asia/Jayapura', 'WIT — Jayapura'],
  ['Asia/Singapore', 'Singapore'],
  ['Asia/Kuala_Lumpur', 'Kuala Lumpur'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Australia/Sydney', 'Sydney'],
  ['Europe/London', 'London'],
  ['Europe/Amsterdam', 'Amsterdam'],
  ['America/New_York', 'New York'],
  ['America/Los_Angeles', 'Los Angeles'],
];

const NAV_TARGET: Record<string, string> = { home: 'Hero (paling atas)', work: 'Featured Work', contact: 'Kontak' };

export function GeneralEditor({ c, edit }: EditorProps) {
  const s = c.site;
  const zones = ZONES.some(([z]) => z === s.hud.timeZone) ? ZONES : [[s.hud.timeZone, s.hud.timeZone], ...ZONES];
  return (
    <>
      <Card title="Identitas" description="Nama dan profesi dipakai di hero, footer, judul tab browser dan sapaan email.">
        <Grid>
          <Text label="Nama lengkap" value={s.person.name} max={120} onChange={(v) => edit((d) => void (d.site.person.name = v))} />
          <Text label="Nama panggilan" value={s.person.first} max={60} hint="Dipakai di sapaan email: “Hi Gilbert, …”" onChange={(v) => edit((d) => void (d.site.person.first = v))} />
          <Text label="Profesi / jabatan" value={s.person.title} max={160} onChange={(v) => edit((d) => void (d.site.person.title = v))} />
          <Text label="Lokasi" value={s.person.location} max={120} placeholder="Jakarta, Indonesia" onChange={(v) => edit((d) => void (d.site.person.location = v))} />
        </Grid>
      </Card>

      <Card title="Logo teks (pojok kiri atas)" description="Dua bagian yang digabung, mis. “GILBERT” + “.A”.">
        <Grid cols={3}>
          <Text label="Bagian 1" value={s.brand.first} max={40} onChange={(v) => edit((d) => void (d.site.brand.first = v))} />
          <Text label="Bagian 2" value={s.brand.second} max={40} onChange={(v) => edit((d) => void (d.site.brand.second = v))} />
          <Field label="Pratinjau">
            <div className="flex h-[38px] items-center rounded-lg bg-black px-3 text-[15px] font-bold tracking-wide text-white uppercase">
              {s.brand.first}
              {s.brand.second}
            </div>
          </Field>
        </Grid>
      </Card>

      <Card title="Menu navigasi" description="Nama menu di bagian atas. Tujuan tiap menu tetap (tidak bisa diubah).">
        <Grid cols={3}>
          {s.nav.map((n, i) => (
            <Text key={n.id} label={`Menu ${i + 1} → ${NAV_TARGET[n.id] ?? n.id}`} value={n.label} max={40} onChange={(v) => edit((d) => void (d.site.nav[i].label = v))} />
          ))}
        </Grid>
      </Card>

      <Card title="Google & tab browser (SEO)">
        <Text label="Judul halaman" value={s.seo.title} max={160} onChange={(v) => edit((d) => void (d.site.seo.title = v))} />
        <Area label="Deskripsi singkat" value={s.seo.description} max={400} rows={3} hint="Muncul di hasil pencarian Google dan saat link dibagikan." onChange={(v) => edit((d) => void (d.site.seo.description = v))} />
        <div className="rounded-xl bg-white p-4 text-left">
          <p className="truncate text-[18px] text-[#1a0dab]">{s.seo.title || 'Judul halaman'}</p>
          <p className="mt-1 line-clamp-2 text-[13px] text-[#4d5156]">{s.seo.description || 'Deskripsi singkat…'}</p>
        </div>
      </Card>

      <Card title="Info di bawah layar" description="Jam, suhu dan hak cipta yang tampil di baris bawah dan footer.">
        <Grid cols={3}>
          <Select
            label="Zona waktu jam"
            value={s.hud.timeZone}
            options={zones.map(([value, label]) => ({ value, label }))}
            onChange={(v) => edit((d) => void (d.site.hud.timeZone = v))}
          />
          <Text label="Label zona" value={s.hud.zoneLabel} max={40} placeholder="WIB" onChange={(v) => edit((d) => void (d.site.hud.zoneLabel = v))} />
          <Text label="Suhu" value={s.hud.temperature} max={20} placeholder="29°C" onChange={(v) => edit((d) => void (d.site.hud.temperature = v))} />
        </Grid>
        <Text label="Teks hak cipta" value={s.copyright} max={120} placeholder="© 2026 Nama" onChange={(v) => edit((d) => void (d.site.copyright = v))} />
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Hero                                                                                            */
/* ----------------------------------------------------------------------------------------------- */

export function HeroEditor({ c, edit }: EditorProps) {
  const h = c.site.hero;
  return (
    <Card title="Hero (layar pertama)" description="Bagian pertama yang dilihat pengunjung: nama, profesi, kalimat singkat dan tombol.">
      <Grid>
        <Lines label="Nama (2 baris, desktop)" value={h.nameLines} count={2} max={40} onChange={(v) => edit((d) => void (d.site.hero.nameLines = v))} />
        <Text label="Profesi di hero" value={h.title} max={200} onChange={(v) => edit((d) => void (d.site.hero.title = v))} />
      </Grid>
      <Area label="Deskripsi singkat" value={h.description} max={600} rows={3} onChange={(v) => edit((d) => void (d.site.hero.description = v))} />
      <Lines label="Judul besar (maks 3 baris)" value={h.headline} count={3} max={40} hint="Tulisan besar di bawah. Kosongkan baris yang tidak dipakai." onChange={(v) => edit((d) => void (d.site.hero.headline = v))} />
      <Grid>
        <Text label="Tombol utama" value={h.primaryCta} max={60} hint="Membawa pengunjung ke Featured Work." onChange={(v) => edit((d) => void (d.site.hero.primaryCta = v))} />
        <Text label="Tombol kedua (resume)" value={h.secondaryCta} max={60} hint="Hanya tampil jika resume sudah diunggah (menu File)." onChange={(v) => edit((d) => void (d.site.hero.secondaryCta = v))} />
      </Grid>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* What I Do                                                                                       */
/* ----------------------------------------------------------------------------------------------- */

export function ExpertiseEditor({ c, edit }: EditorProps) {
  const e = c.site.expertise;
  return (
    <Card title="What I Do" description="Baris keahlian besar. Saat disorot mouse, kalimat dan daftar skill-nya muncul. Pita berjalan di bawahnya dibuat otomatis dari judul & skill.">
      <Text label="Judul section" value={e.label} max={80} onChange={(v) => edit((d) => void (d.site.expertise.label = v))} />
      <div className="space-y-3">
        {e.groups.map((g, i) => (
          <ListItem
            key={i}
            index={i}
            length={e.groups.length}
            title={g.title || 'Keahlian baru'}
            onMove={(dir) => edit((d) => void (d.site.expertise.groups = move(d.site.expertise.groups, i, dir)))}
            onRemove={() => edit((d) => void d.site.expertise.groups.splice(i, 1))}
            confirmText={`Hapus keahlian “${g.title || 'ini'}”?`}
          >
            <Grid>
              <Text label="Judul" value={g.title} max={80} onChange={(v) => edit((d) => void (d.site.expertise.groups[i].title = v))} />
              <Text label="Kalimat singkat" value={g.line} max={300} onChange={(v) => edit((d) => void (d.site.expertise.groups[i].line = v))} />
            </Grid>
            <Tags label="Skill" value={g.skills} max={12} onChange={(v) => edit((d) => void (d.site.expertise.groups[i].skills = v))} />
          </ListItem>
        ))}
        <AddButton disabled={e.groups.length >= 8} onClick={() => edit((d) => void d.site.expertise.groups.push({ title: '', line: '', skills: [] }))}>
          Tambah keahlian {e.groups.length >= 8 && '(maks 8)'}
        </AddButton>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* How I Work                                                                                      */
/* ----------------------------------------------------------------------------------------------- */

export function ProcessEditor({ c, edit }: EditorProps) {
  const p = c.site.process;
  return (
    <>
      <Card title="How I Work" description="Langkah kerja singkat di atas, lalu animasi portal: pengunjung “masuk” dan teks besar berganti per fase saat di-scroll.">
        <Grid>
          <Text label="Judul section" value={p.label} max={80} onChange={(v) => edit((d) => void (d.site.process.label = v))} />
          <Text label="Petunjuk scroll" value={p.hint} max={120} onChange={(v) => edit((d) => void (d.site.process.hint = v))} />
        </Grid>
        <Area label="Kalimat pembuka" value={p.intro} max={300} rows={2} onChange={(v) => edit((d) => void (d.site.process.intro = v))} />
      </Card>

      <Card title="Langkah kerja" description="Tampil sebagai daftar kecil (maks 6).">
        <div className="space-y-3">
          {p.steps.map((s, i) => (
            <ListItem
              key={i}
              index={i}
              length={p.steps.length}
              title={s.title || 'Langkah baru'}
              onMove={(dir) => edit((d) => void (d.site.process.steps = move(d.site.process.steps, i, dir)))}
              onRemove={() => edit((d) => void d.site.process.steps.splice(i, 1))}
            >
              <Grid>
                <Text label="Judul" value={s.title} max={60} onChange={(v) => edit((d) => void (d.site.process.steps[i].title = v))} />
                <Text label="Penjelasan singkat" value={s.body} max={160} onChange={(v) => edit((d) => void (d.site.process.steps[i].body = v))} />
              </Grid>
            </ListItem>
          ))}
          <AddButton disabled={p.steps.length >= 6} onClick={() => edit((d) => void d.site.process.steps.push({ title: '', body: '' }))}>
            Tambah langkah
          </AddButton>
        </div>
      </Card>

      <Card title="Teks besar di dalam portal" description="Tiap fase berisi 1–3 baris pendek (mis. UNDERSTAND / THE REAL / PROBLEM). Fase berganti berurutan saat di-scroll (maks 6).">
        <div className="space-y-3">
          {p.phases.map((ph, i) => (
            <ListItem
              key={i}
              index={i}
              length={p.phases.length}
              title={ph.filter(Boolean).join(' ') || 'Fase baru'}
              onMove={(dir) => edit((d) => void (d.site.process.phases = move(d.site.process.phases, i, dir)))}
              onRemove={() => edit((d) => void d.site.process.phases.splice(i, 1))}
            >
              <Lines label="Baris" value={ph} count={3} max={24} onChange={(v) => edit((d) => void (d.site.process.phases[i] = v))} />
            </ListItem>
          ))}
          <AddButton disabled={p.phases.length >= 6} onClick={() => edit((d) => void d.site.process.phases.push(['', '', '']))}>
            Tambah fase
          </AddButton>
        </div>
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* About                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export function AboutEditor({ c, edit }: EditorProps) {
  const a = c.site.about;
  return (
    <>
      <Card title="About Me">
        <Text label="Judul section" value={a.label} max={80} onChange={(v) => edit((d) => void (d.site.about.label = v))} />
        <PhotoInput label="Foto potret" value={a.portrait} hint="Rasio 4:5 paling pas." onChange={(v) => edit((d) => void (d.site.about.portrait = v))} />
        <Area label="Paragraf utama" value={a.lead} max={600} rows={4} hint="Kata-katanya menyala satu per satu saat di-scroll." onChange={(v) => edit((d) => void (d.site.about.lead = v))} />
        <Area label="Kutipan penutup" value={a.quote} max={300} rows={2} onChange={(v) => edit((d) => void (d.site.about.quote = v))} />
      </Card>

      <Card title="Fakta singkat" description="Kotak kecil berisi label + isi (mis. Based in / Jakarta). Maks 8.">
        <div className="space-y-2">
          {a.facts.map((f, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#111313] p-3 sm:flex-row sm:items-center">
              <input value={f.label} maxLength={60} placeholder="Label" aria-label="Label" className={inputCls} onChange={(e) => edit((d) => void (d.site.about.facts[i].label = e.target.value))} />
              <input value={f.value} maxLength={120} placeholder="Isi" aria-label="Isi" className={inputCls} onChange={(e) => edit((d) => void (d.site.about.facts[i].value = e.target.value))} />
              <RowTools
                index={i}
                length={a.facts.length}
                onMove={(dir) => edit((d) => void (d.site.about.facts = move(d.site.about.facts, i, dir)))}
                onRemove={() => edit((d) => void d.site.about.facts.splice(i, 1))}
              />
            </div>
          ))}
          <AddButton disabled={a.facts.length >= 8} onClick={() => edit((d) => void d.site.about.facts.push({ label: '', value: '' }))}>
            Tambah fakta
          </AddButton>
        </div>
      </Card>

      <Card title="Kata-kata besar (outline)" description="Kata bergaris tepi yang terisi penuh bergantian.">
        <Text label="Label di atasnya" value={a.intersectionLabel} max={120} onChange={(v) => edit((d) => void (d.site.about.intersectionLabel = v))} />
        <Tags label="Kata" value={a.interests} max={8} onChange={(v) => edit((d) => void (d.site.about.interests = v))} />
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Experience                                                                                      */
/* ----------------------------------------------------------------------------------------------- */

export function ExperienceEditor({ c, edit }: EditorProps) {
  return (
    <Card title="Experience & Journey" description="Strip foto yang bergeser otomatis ke kiri dan bisa di-drag. Section disembunyikan jika kosong.">
      <Grid>
        <Text label="Judul section" value={c.site.experience.label} max={80} onChange={(v) => edit((d) => void (d.site.experience.label = v))} />
        <Text label="Petunjuk kecil" value={c.site.experience.hint} max={80} placeholder="Drag →" onChange={(v) => edit((d) => void (d.site.experience.hint = v))} />
      </Grid>
      <div className="space-y-3">
        {c.experience.map((x, i) => (
          <ListItem
            key={x.id}
            index={i}
            length={c.experience.length}
            title={[x.role, x.organization].filter(Boolean).join(' — ') || 'Pengalaman baru'}
            onMove={(dir) => edit((d) => void (d.experience = move(d.experience, i, dir)))}
            onRemove={() => edit((d) => void d.experience.splice(i, 1))}
            confirmText="Hapus pengalaman ini?"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
              <PhotoInput label="Foto" value={x.photo} onChange={(v) => edit((d) => d.experience.forEach((e) => e.id === x.id && (e.photo = v)))} />
              <Grid>
                <Text label="Periode" value={x.period} max={80} placeholder="2024 — Sekarang" onChange={(v) => edit((d) => void (d.experience[i].period = v))} />
                <Text label="Jenis" value={x.type} max={60} placeholder="Freelance / Internship / Organisasi" onChange={(v) => edit((d) => void (d.experience[i].type = v))} />
                <Text label="Peran" value={x.role} max={200} onChange={(v) => edit((d) => void (d.experience[i].role = v))} />
                <Text label="Organisasi / tempat" value={x.organization} max={200} onChange={(v) => edit((d) => void (d.experience[i].organization = v))} />
              </Grid>
            </div>
          </ListItem>
        ))}
        <AddButton onClick={() => edit((d) => void d.experience.push({ id: newId('exp'), period: '', type: '', role: '', organization: '', photo: '' }))}>Tambah pengalaman</AddButton>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Testimonials                                                                                    */
/* ----------------------------------------------------------------------------------------------- */

/** the sample entries that ship with the site (replace them with real testimonials) */
const isSample = (name: string) => /^(client|teammate|lecturer|name) (name|surname)$/i.test(name.trim());

export function TestimonialsEditor({ c, edit }: EditorProps) {
  const shown = c.testimonials.filter((t) => t.published && t.quote.trim() && t.name.trim()).length;
  const samples = c.testimonials.filter((t) => isSample(t.name)).length;
  return (
    <Card
      title="Testimoni"
      description={
        <>
          Hanya admin yang bisa menambah testimoni. Yang tampil hanya yang <b className="text-white/80">ditampilkan</b> dan berisi kutipan + nama. Section testimoni selalu muncul di
          halaman utama; jika belum ada yang ditampilkan, isinya berupa ajakan untuk memberi testimoni. Saat ini tampil: <b className="text-white/80">{shown}</b>.
          {samples > 0 && (
            <span className="mt-2 block rounded-lg bg-[#8a5a00]/30 px-3 py-2 text-[#ffd37a]">
              {samples} testimoni masih berupa contoh. Ganti dengan kata-kata asli dari klien, dosen atau rekan kerja, atau matikan “Tampilkan di website”.
            </span>
          )}
        </>
      }
    >
      <Text label="Judul section" value={c.site.testimonials.label} max={80} onChange={(v) => edit((d) => void (d.site.testimonials.label = v))} />
      <div className="space-y-3">
        {c.testimonials.map((t, i) => {
          const complete = !!(t.quote.trim() && t.name.trim());
          const status = !t.published
            ? ['Disembunyikan', 'bg-white/10 text-white/60']
            : !complete
              ? ['Belum lengkap', 'bg-[#8a5a00]/40 text-[#ffd37a]']
              : isSample(t.name)
                ? ['Tampil · contoh', 'bg-[#8a5a00]/40 text-[#ffd37a]']
                : ['Tampil', 'bg-[#1f7a3a]/40 text-[#8ff0a9]'];
          return (
            <ListItem
              key={t.id}
              index={i}
              length={c.testimonials.length}
              title={
                <>
                  {t.name || 'Testimoni baru'} <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${status[1]}`}>{status[0]}</span>
                </>
              }
              onMove={(dir) => edit((d) => void (d.testimonials = move(d.testimonials, i, dir)))}
              onRemove={() => edit((d) => void d.testimonials.splice(i, 1))}
              confirmText={`Hapus testimoni dari “${t.name || 'ini'}”?`}
            >
              <Toggle label="Tampilkan di website" checked={t.published} onChange={(v) => edit((d) => void (d.testimonials[i].published = v))} />
              <Area label="Kutipan" value={t.quote} max={2000} rows={3} onChange={(v) => edit((d) => void (d.testimonials[i].quote = v))} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
                <PhotoInput
                  label="Foto (opsional)"
                  value={t.photo}
                  round
                  hint="Tanpa foto → inisial nama."
                  onChange={(v) => edit((d) => d.testimonials.forEach((e) => e.id === t.id && (e.photo = v)))}
                />
                <Grid>
                  <Text label="Nama" value={t.name} max={120} onChange={(v) => edit((d) => void (d.testimonials[i].name = v))} />
                  <Text label="Jabatan" value={t.position} max={160} onChange={(v) => edit((d) => void (d.testimonials[i].position = v))} />
                  <Text label="Perusahaan / organisasi" value={t.organization} max={160} onChange={(v) => edit((d) => void (d.testimonials[i].organization = v))} />
                  <Text label="Proyek yang dikerjakan" value={t.workedOn} max={200} onChange={(v) => edit((d) => void (d.testimonials[i].workedOn = v))} />
                </Grid>
              </div>
            </ListItem>
          );
        })}
        <AddButton
          onClick={() => edit((d) => void d.testimonials.push({ id: newId('t'), quote: '', name: '', position: '', organization: '', workedOn: '', photo: '', published: true }))}
        >
          Tambah testimoni
        </AddButton>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Contact & footer                                                                                */
/* ----------------------------------------------------------------------------------------------- */

const PRESETS: [string, string][] = [
  ['Instagram', 'https://www.instagram.com/'],
  ['LinkedIn', 'https://www.linkedin.com/in/'],
  ['GitHub', 'https://github.com/'],
  ['TikTok', 'https://www.tiktok.com/@'],
  ['YouTube', 'https://www.youtube.com/@'],
  ['WhatsApp', 'https://wa.me/62'],
  ['X', 'https://x.com/'],
  ['Website', 'https://'],
];

const validUrl = (v: string) => /^(https?:\/\/|mailto:|tel:)\S+$/i.test(v.trim()) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v.trim());

export function ContactEditor({ c, edit }: EditorProps) {
  const ct = c.site.contact;
  const cta = c.site.cta;
  const used = new Set(ct.socials.map((s) => s.label.toLowerCase()));
  return (
    <>
      <Card title="Kontak" description="Email dipakai untuk tombol “Contact me”, salin email dan footer.">
        <Text
          label="Email"
          type="email"
          value={ct.email}
          max={200}
          placeholder="nama@email.com"
          invalid={ct.email && !isEmail(ct.email) ? 'Format email belum benar.' : false}
          onChange={(v) => edit((d) => void (d.site.contact.email = v))}
        />
      </Card>

      <Card title="Media sosial & link" description="Tampil di bagian kontak dan footer. Link LinkedIn otomatis jadi tombol di bagian kontak. Maks 12.">
        <div className="space-y-2">
          {ct.socials.map((s, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#111313] p-3 sm:flex-row sm:items-start">
              <input
                value={s.label}
                maxLength={60}
                placeholder="Nama (mis. Instagram)"
                aria-label="Nama link"
                className={`${inputCls} sm:max-w-[200px]`}
                onChange={(e) => edit((d) => void (d.site.contact.socials[i].label = e.target.value))}
              />
              <div className="min-w-0 flex-1">
                <input
                  value={s.href}
                  maxLength={2000}
                  placeholder="https://…"
                  aria-label="URL"
                  className={`${inputCls} ${s.href && !validUrl(s.href) ? 'border-[#e11d2e]/70' : ''}`}
                  onChange={(e) => edit((d) => void (d.site.contact.socials[i].href = e.target.value))}
                />
                {s.href && !validUrl(s.href) && <p className="mt-1 text-[12px] text-[#ff6b77]">Link harus diawali https:// — link ini tidak akan disimpan.</p>}
                {(!s.label || !s.href) && <p className="mt-1 text-[12px] text-white/40">Isi nama dan link agar tampil.</p>}
              </div>
              <RowTools
                index={i}
                length={ct.socials.length}
                onMove={(dir) => edit((d) => void (d.site.contact.socials = move(d.site.contact.socials, i, dir)))}
                onRemove={() => edit((d) => void d.site.contact.socials.splice(i, 1))}
              />
            </div>
          ))}
          {ct.socials.length < 12 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESETS.filter(([l]) => !used.has(l.toLowerCase())).map(([label, href]) => (
                <button key={label} type="button" className={btn.secondary} onClick={() => edit((d) => void d.site.contact.socials.push({ label, href }))}>
                  + {label}
                </button>
              ))}
              <button type="button" className={btn.ghost} onClick={() => edit((d) => void d.site.contact.socials.push({ label: '', href: '' }))}>
                + Link lain
              </button>
            </div>
          )}
        </div>
      </Card>

      <Card title="Ajakan penutup (layar kontak)" description="Tulisan besar di atas latar merah sebelum footer.">
        <Lines label="Tulisan besar (4 bagian)" value={cta.lines} count={4} max={24} hint="Bagian 1 & 2 satu baris, lalu 3, lalu 4." onChange={(v) => edit((d) => void (d.site.cta.lines = v))} />
        <Text label="Pertanyaan" value={cta.question} max={200} onChange={(v) => edit((d) => void (d.site.cta.question = v))} />
        <Tags label="Terbuka untuk" value={cta.openTo} max={10} onChange={(v) => edit((d) => void (d.site.cta.openTo = v))} />
        <Text label="Teks tombol utama" value={cta.primary} max={60} onChange={(v) => edit((d) => void (d.site.cta.primary = v))} />
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Files                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export function FilesEditor({ c, edit }: EditorProps) {
  const r = c.site.resume;
  const [linkMode, setLinkMode] = useState(!!r.href && !r.href.startsWith('/'));
  return (
    <>
      <Card title="Resume / CV" description="Dipakai tombol Resume di menu, hero, About dan footer. Jika kosong, semua tombol resume disembunyikan.">
        <div className="inline-flex rounded-lg bg-white/[0.06] p-0.5 text-[12px]">
          {[
            [false, 'Unggah PDF'],
            [true, 'Pakai link (Google Drive, dll.)'],
          ].map(([v, l]) => (
            <button key={String(v)} type="button" onClick={() => setLinkMode(v as boolean)} className={`cursor-pointer rounded-md px-3 py-1 transition ${linkMode === v ? 'bg-[#c3101f] text-white' : 'text-white/60 hover:text-white'}`}>
              {l as string}
            </button>
          ))}
        </div>
        {linkMode ? (
          <Text
            label="Link resume"
            value={r.href}
            max={2000}
            placeholder="https://drive.google.com/…"
            invalid={r.href && !validUrl(r.href) && !r.href.startsWith('/') ? 'Link harus diawali https://' : false}
            onChange={(v) => edit((d) => void (d.site.resume.href = v))}
          />
        ) : (
          <FileInput
            label="File PDF"
            kind="pdf"
            value={r.href}
            emptyText="Belum ada resume."
            hint="Maks 500 MB."
            onChange={(v) => edit((d) => void (d.site.resume.href = v))}
            onUploaded={(name) => edit((d) => void (d.site.resume.fileName = name))}
          />
        )}
        <Text label="Nama file saat diunduh" value={r.fileName} max={120} placeholder="Nama-CV.pdf" onChange={(v) => edit((d) => void (d.site.resume.fileName = v))} />
      </Card>

      <Card title="Musik latar" description="Diputar saat pengunjung menyalakan Sound. Jika kosong, dipakai musik lo-fi bawaan.">
        <FileInput
          label="File audio"
          kind="audio"
          value={c.site.sound.music}
          emptyText="Memakai musik bawaan."
          hint="MP3 disarankan, maks 500 MB. Diputar berulang (loop)."
          onChange={(v) => edit((d) => void (d.site.sound.music = v))}
        />
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Settings                                                                                        */
/* ----------------------------------------------------------------------------------------------- */

export function SettingsEditor() {
  const notify = useNotify();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = again.length > 0 && again !== next;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return notify('Password baru minimal 8 karakter.', 'error');
    if (next !== again) return notify('Konfirmasi password tidak sama.', 'error');
    setBusy(true);
    try {
      await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ current: cur, next }) });
      notify('Password berhasil diganti.', 'ok');
      setCur('');
      setNext('');
      setAgain('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengganti password.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const pw = (label: string, v: string, set: (v: string) => void, auto: string) => (
    <Field label={label}>
      <input type="password" value={v} onChange={(e) => set(e.target.value)} autoComplete={auto} className={inputCls} />
    </Field>
  );
  return (
    <>
      <Card title="Ganti password admin">
        <form onSubmit={submit} className="max-w-md space-y-4">
          {pw('Password lama', cur, setCur, 'current-password')}
          {pw('Password baru (min. 8 karakter)', next, setNext, 'new-password')}
          {pw('Ulangi password baru', again, setAgain, 'new-password')}
          {mismatch && <p className="text-[12px] text-[#ff6b77]">Konfirmasi belum sama.</p>}
          <button type="submit" className={btn.primary} disabled={busy || !cur || !next || !again}>
            {busy ? 'Menyimpan…' : 'Ganti password'}
          </button>
        </form>
      </Card>
      <Card title="Cadangan otomatis">
        <p className="text-[13px] leading-relaxed text-white/55">
          Setiap kali Anda menyimpan, versi sebelumnya disalin ke folder <code className="rounded bg-white/10 px-1">storage/backups</code> (30 versi terakhir). File yang diunggah tersimpan
          di <code className="rounded bg-white/10 px-1">storage/uploads</code>. Salin folder <code className="rounded bg-white/10 px-1">storage</code> untuk membuat cadangan penuh.
        </p>
      </Card>
    </>
  );
}

// ---- ProjectsEditor
const MAX_FEATURED = 5;

function blankProject(type: 'image' | 'video', category: string, slug: string): Project {
  return {
    id: newId('p'),
    slug,
    title: 'Proyek baru',
    category,
    kind: '',
    year: String(new Date().getFullYear()),
    summary: '',
    role: '',
    tools: [],
    featured: false,
    media: { type, src: '' },
    hover: null,
    overview: '',
    challenge: '',
    solution: '',
    outcome: [],
    gallery: [],
    link: null,
  };
}

function Thumb({ m, className = '' }: { m: Media; className?: string }) {
  const still = stillOf(m);
  if (still)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={still} alt="" className={`h-full w-full object-cover ${className}`} />;
  if (m.type === 'video' && m.src) return <video src={`${m.src}#t=0.5`} muted playsInline preload="metadata" className={`h-full w-full object-cover ${className}`} />;
  return <span className="flex h-full w-full items-center justify-center text-[11px] text-white/35">Belum ada media</span>;
}

export function ProjectsEditor({ c, edit, dirty }: EditorProps & { dirty: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  /** new projects: the URL (slug) follows the title until it is edited by hand */
  const autoSlug = useRef(new Set<string>());
  const open = c.projects.find((p) => p.id === openId);

  const uniqueSlug = (base: string, except?: string) => {
    let s = slugify(base);
    let n = 2;
    while (c.projects.some((p) => p.id !== except && p.slug === s)) s = `${slugify(base)}-${n++}`;
    return s;
  };

  const add = (type: 'image' | 'video') => {
    const p = blankProject(type, c.categories[0]?.id ?? '', uniqueSlug('proyek-baru'));
    autoSlug.current.add(p.id);
    edit((d) => void d.projects.unshift(p));
    setOpenId(p.id);
    scrollAdminTop();
  };

  if (open)
    return (
      <ProjectForm key={open.id} p={open} c={c} edit={edit} dirty={dirty} autoSlug={autoSlug.current} uniqueSlug={uniqueSlug} onClose={() => setOpenId(null)} />
    );

  const featuredCount = c.projects.filter((p) => p.featured).length;
  return (
    <>
      <Card title="Judul section" description="Teks judul untuk Featured Work (proyek unggulan) dan All Work (semua proyek).">
        <Grid>
          <Text label="Judul Featured Work" value={c.site.featured.label} max={80} onChange={(v) => edit((d) => void (d.site.featured.label = v))} />
          <Text label="Judul All Work" value={c.site.allWork.label} max={80} onChange={(v) => edit((d) => void (d.site.allWork.label = v))} />
        </Grid>
        <Area label="Kalimat pengantar Featured Work" value={c.site.featured.intro} max={300} rows={2} onChange={(v) => edit((d) => void (d.site.featured.intro = v))} />
      </Card>

      <Card
        title={`Semua proyek (${c.projects.length})`}
        description={
          <>
            Urutan di sini = urutan di All Work. Tandai ★ untuk menampilkan di Featured Work (maks {MAX_FEATURED}, sekarang {featuredCount}
            {featuredCount > MAX_FEATURED ? ' — hanya 5 teratas yang tampil' : ''}). Klik proyek untuk mengubah tampilan kartu & halaman detailnya.
          </>
        }
        actions={
          <>
            <button type="button" className={btn.primary} onClick={() => add('image')}>
              + Proyek foto
            </button>
            <button type="button" className={btn.primary} onClick={() => add('video')}>
              + Proyek video
            </button>
          </>
        }
      >
        {c.projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[13px] text-white/50">Belum ada proyek. Klik “+ Proyek foto” atau “+ Proyek video”.</p>
        ) : (
          <ul className="space-y-2">
            {c.projects.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#111313] p-2 pr-1 transition hover:border-white/20">
                <button type="button" onClick={() => setOpenId(p.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
                  <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-black sm:w-24">
                    <Thumb m={p.media} />
                    {p.media.type === 'video' && <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[9px] font-medium text-white">VIDEO</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-white/35 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate text-[14px] font-medium text-white">{p.title || 'Tanpa judul'}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-white/45">
                      {[categoryLabel(c, p.category), p.kind, p.year].filter(Boolean).join(' · ') || '—'}
                      {!p.media.src && <span className="ml-2 text-[#ffd37a]">· belum ada foto/video</span>}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => edit((d) => void (d.projects[i].featured = !d.projects[i].featured))}
                  className={`${btn.icon} text-[17px] ${p.featured ? '!text-[#ffcf33]' : ''}`}
                  aria-pressed={p.featured}
                  aria-label={p.featured ? 'Hapus dari Featured Work' : 'Tampilkan di Featured Work'}
                  title={p.featured ? 'Tampil di Featured Work' : 'Tampilkan di Featured Work'}
                >
                  {p.featured ? '★' : '☆'}
                </button>
                <button type="button" className={`${btn.secondary} hidden sm:inline-flex`} onClick={() => setOpenId(p.id)}>
                  Edit
                </button>
                <RowTools
                  index={i}
                  length={c.projects.length}
                  onMove={(dir) => edit((d) => void (d.projects = move(d.projects, i, dir)))}
                  onRemove={() => edit((d) => void (d.projects = d.projects.filter((x) => x.id !== p.id)))}
                  confirmText={`Hapus proyek “${p.title}”? Halaman detailnya juga ikut terhapus.`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CategoriesCard c={c} edit={edit} />
    </>
  );
}

function CategoriesCard({ c, edit }: EditorProps) {
  const usage = (id: string) => c.projects.filter((p) => p.category === id).length;
  return (
    <Card title="Kategori" description="Label kecil di kartu dan halaman proyek. Kategori dipilih di tiap proyek.">
      <div className="space-y-2">
        {c.categories.map((cat, i) => (
          <div key={cat.id} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111313] p-2">
            <input
              value={cat.label}
              maxLength={60}
              placeholder="Nama kategori"
              aria-label="Nama kategori"
              className={inputCls}
              onChange={(e) => edit((d) => void (d.categories[i].label = e.target.value))}
            />
            <span className="w-20 shrink-0 text-center text-[12px] text-white/40">{usage(cat.id)} proyek</span>
            <RowTools
              index={i}
              length={c.categories.length}
              onMove={(dir) => edit((d) => void (d.categories = move(d.categories, i, dir)))}
              onRemove={
                c.categories.length > 1
                  ? () =>
                      edit((d) => {
                        d.categories = d.categories.filter((x) => x.id !== cat.id);
                        d.projects.forEach((p) => p.category === cat.id && (p.category = ''));
                      })
                  : undefined
              }
              confirmText={usage(cat.id) ? `Kategori ini dipakai ${usage(cat.id)} proyek. Hapus? Proyek tersebut menjadi tanpa kategori.` : `Hapus kategori “${cat.label}”?`}
            />
          </div>
        ))}
        {c.categories.some((x) => !x.label.trim()) && <p className="text-[12px] text-[#ffd37a]">Kategori tanpa nama tidak akan disimpan.</p>}
        <AddButton disabled={c.categories.length >= 30} onClick={() => edit((d) => void d.categories.push({ id: newId('cat'), label: '' }))}>
          Tambah kategori
        </AddButton>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* One project                                                                                     */
/* ----------------------------------------------------------------------------------------------- */

function ProjectForm({
  p,
  c,
  edit,
  dirty,
  autoSlug,
  uniqueSlug,
  onClose,
}: EditorProps & { p: Project; dirty: boolean; autoSlug: Set<string>; uniqueSlug: (b: string, except?: string) => string; onClose: () => void }) {
  const notify = useNotify();
  const set = (fn: (q: Project) => void) =>
    edit((d) => {
      const q = d.projects.find((x) => x.id === p.id);
      if (q) fn(q);
    });
  const dupSlug = c.projects.some((q) => q.id !== p.id && q.slug === p.slug);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const addGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    let ok = 0;
    for (let k = 0; k < list.length; k++) {
      const f = list[k];
      const kind = kindOfFile(f);
      if (!kind) {
        notify(`${f.name}: format tidak didukung.`, 'error');
        continue;
      }
      try {
        const m = await uploadMedia(f, kind, (pr, l) => setAdding(`${k + 1}/${list.length} · ${l} ${Math.round(pr * 100)}%`));
        set((q) => void q.gallery.push(m));
        ok++;
      } catch (e) {
        notify(`${f.name}: ${e instanceof Error ? e.message : 'gagal diunggah'}`, 'error');
      }
    }
    setAdding(null);
    if (ok) notify(`${ok} file ditambahkan ke galeri. Jangan lupa klik Simpan.`, 'ok');
  };

  const catOptions = [{ value: '', label: '— Tanpa kategori —' }, ...c.categories.filter((x) => x.label.trim()).map((x) => ({ value: x.id, label: x.label }))];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={btn.ghost} onClick={onClose}>
          ← Semua proyek
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-[12px] text-white/45">Simpan dulu untuk melihat perubahan di website.</span>}
          <a href={`/work/${p.slug}`} target="_blank" rel="noreferrer" className={btn.secondary}>
            Lihat halaman ↗
          </a>
        </div>
      </div>

      <Card title="Tampilan kartu" description="Yang tampil di Featured Work dan All Work.">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <MediaInput
              label="Foto / video utama"
              value={p.media}
              onChange={(m) => m && set((q) => void (q.media = { ...m, caption: undefined }))}
              hint="Dipakai di kartu, All Work dan bagian atas halaman detail. Video diputar otomatis tanpa suara."
            />
            <Grid>
              <Text
                label="Judul proyek"
                value={p.title}
                max={160}
                onChange={(v) =>
                  set((q) => {
                    q.title = v;
                    if (autoSlug.has(q.id)) q.slug = uniqueSlug(v || 'proyek', q.id);
                  })
                }
              />
              <Select label="Kategori" value={p.category} options={catOptions} onChange={(v) => set((q) => void (q.category = v))} />
              <Text label="Jenis proyek" value={p.kind} max={80} placeholder="Mobile App, Branding, Poster…" onChange={(v) => set((q) => void (q.kind = v))} />
              <Text label="Tahun" value={p.year} max={20} placeholder="2026" onChange={(v) => set((q) => void (q.year = v))} />
            </Grid>
            <Text label="Peran saya" value={p.role} max={200} placeholder="UI/UX Designer" onChange={(v) => set((q) => void (q.role = v))} />
            <Area label="Ringkasan (1–2 kalimat)" value={p.summary} max={300} rows={2} onChange={(v) => set((q) => void (q.summary = v))} />
            <Tags label="Tools" value={p.tools} max={12} placeholder="Figma, Illustrator…" onChange={(v) => set((q) => void (q.tools = v))} />
            <Toggle label="Tampilkan di Featured Work (★)" checked={p.featured} onChange={(v) => set((q) => void (q.featured = v))} hint="Maks 5 proyek, urut sesuai daftar." />
            <MediaInput
              label="Gambar saat kursor di atas kartu (opsional)"
              value={p.hover}
              types={['image']}
              allowEmpty
              onChange={(m) => set((q) => void (q.hover = m ? { ...m, caption: undefined } : null))}
              hint="Muncul membulat dari posisi kursor di Featured Work. Jika kosong, gambar utama berubah jadi efek merah."
            />
          </div>
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <p className="mb-2 text-[12px] font-medium text-white/45">Pratinjau kartu</p>
            <div className="rounded-xl bg-[#0f1111] p-3">
              <div className="relative aspect-[16/10] overflow-hidden bg-[#191b1b]">
                <Thumb m={p.media} />
                {categoryLabel(c, p.category) && (
                  <span className="absolute top-0 right-0 bg-[#c0fe04] px-1 font-mono text-[10px] text-black uppercase">{categoryLabel(c, p.category)}</span>
                )}
              </div>
              <div className="mt-2 flex justify-between gap-2 text-[11px] text-white uppercase">
                <span className="truncate">{p.title || 'Tanpa judul'}</span>
                <span className="shrink-0">{p.year}</span>
              </div>
              {p.role && <p className="mt-1 font-mono text-[10px] text-white/60">{p.role}</p>}
              {p.summary && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/60">{p.summary}</p>}
            </div>
          </aside>
        </div>
      </Card>

      <Card title="Halaman detail" description="Halaman yang terbuka saat kartu diklik. Bagian yang dikosongkan tidak ditampilkan.">
        <Text
          label="Alamat halaman"
          value={p.slug}
          max={80}
          hint={
            <>
              website.com/work/<b className="text-white/70">{p.slug || '…'}</b> — huruf kecil, angka dan tanda minus.
            </>
          }
          invalid={dupSlug ? 'Alamat ini sudah dipakai proyek lain — akan diberi nomor otomatis saat disimpan.' : false}
          onChange={(v) =>
            set((q) => {
              autoSlug.delete(q.id);
              q.slug = v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80);
            })
          }
        />
        <Area label="Overview (tentang proyek)" value={p.overview} max={4000} rows={4} onChange={(v) => set((q) => void (q.overview = v))} />
        <Grid>
          <Area label="Challenge (masalah)" value={p.challenge} max={4000} rows={5} onChange={(v) => set((q) => void (q.challenge = v))} />
          <Area label="Solution (solusi)" value={p.solution} max={4000} rows={5} onChange={(v) => set((q) => void (q.solution = v))} />
        </Grid>

        <Field label="Hasil / angka (opsional)" hint="Mis. “+40%” — “waktu checkout lebih cepat”. Maks 8.">
          <div className="space-y-2">
            {p.outcome.map((o, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input value={o.value} maxLength={60} placeholder="Angka / hasil" aria-label="Angka" className={`${inputCls} sm:max-w-[160px]`} onChange={(e) => set((q) => void (q.outcome[i].value = e.target.value))} />
                <input value={o.label} maxLength={200} placeholder="Keterangan" aria-label="Keterangan" className={inputCls} onChange={(e) => set((q) => void (q.outcome[i].label = e.target.value))} />
                <RowTools index={i} length={p.outcome.length} onMove={(dir) => set((q) => void (q.outcome = move(q.outcome, i, dir)))} onRemove={() => set((q) => void q.outcome.splice(i, 1))} />
              </div>
            ))}
            {p.outcome.length < 8 && (
              <button type="button" className={btn.ghost} onClick={() => set((q) => void q.outcome.push({ value: '', label: '' }))}>
                + Tambah hasil
              </button>
            )}
          </div>
        </Field>

        <Field label={`Galeri (${p.gallery.length})`} hint="Foto & video tambahan di bawah halaman. Bisa pilih banyak file sekaligus.">
          <div className="space-y-3">
            {p.gallery.map((m, i) => (
              <ListItem
                key={`${m.src}-${i}`}
                index={i}
                length={p.gallery.length}
                title={m.type === 'video' ? 'Video' : 'Foto'}
                onMove={(dir) => set((q) => void (q.gallery = move(q.gallery, i, dir)))}
                onRemove={() => set((q) => void q.gallery.splice(i, 1))}
              >
                <MediaInput label="File" value={m} withCaption onChange={(nm) => nm && set((q) => void (q.gallery[i] = nm))} />
              </ListItem>
            ))}
            {adding && <p className="text-[12px] text-white/60">Mengunggah {adding}</p>}
            <AddButton disabled={!!adding || p.gallery.length >= 40} onClick={() => galleryRef.current?.click()}>
              Tambah foto / video ke galeri
            </AddButton>
            <input ref={galleryRef} type="file" multiple accept={`${ACCEPT.image},${ACCEPT.video}`} className="hidden" onChange={(e) => (addGallery(e.target.files), (e.target.value = ''))} />
          </div>
        </Field>

        <Grid>
          <Text
            label="Link proyek (opsional)"
            value={p.link?.href ?? ''}
            max={2000}
            placeholder="https://…"
            hint="Kosongkan jika tidak ada."
            onChange={(v) => set((q) => void (q.link = { label: q.link?.label ?? 'Visit project', href: v }))}
          />
          <Text
            label="Teks tombol link"
            value={p.link?.label ?? ''}
            max={120}
            placeholder="Visit project"
            onChange={(v) => set((q) => void (q.link = { label: v, href: q.link?.href ?? '' }))}
          />
        </Grid>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className={btn.ghost} onClick={onClose}>
          ← Semua proyek
        </button>
        <button
          type="button"
          className={btn.danger}
          onClick={() => {
            if (!window.confirm(`Hapus proyek “${p.title}”? Halaman detailnya juga ikut terhapus.`)) return;
            edit((d) => void (d.projects = d.projects.filter((x) => x.id !== p.id)));
            onClose();
          }}
        >
          <TrashIcon /> Hapus proyek
        </button>
      </div>
    </>
  );
}
