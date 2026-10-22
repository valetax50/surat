(() => {
'use strict';

const SUPABASE_URL = 'https://bzozorsjrbkkeghaldom.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_CVB1RyqvTSLfjt1MMPAIbA_8PzUi8Tg';
const BUCKET = 'lampiran';
const ADMIN_ACTS = ['add', 'edit', 'del', 'confirm-del', 'sample', 'file-pick', 'file-remove'];

const configured = !SUPABASE_URL.startsWith('GANTI') && !SUPABASE_KEY.startsWith('GANTI') && window.supabase;
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let resolveAuth; const authReady = new Promise(r => { resolveAuth = r; });
const fail = e => ({ code: e && (e.code === '42501' || /row-level|policy|not allowed|unauthorized/i.test(e.message || '')) ? 'not_granted' : 'error', message: e && e.message });


const css = document.createElement('style');
css.textContent = `
body.locked .app{visibility:hidden}
html[data-role="petugas"] [data-act="add"],html[data-role="petugas"] [data-act="edit"],html[data-role="petugas"] [data-act="del"],html[data-role="petugas"] [data-act="sample"],html[data-role="petugas"] .dfoot{display:none!important}
.login{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;background:var(--bg);overflow:auto}
.login-card{width:min(400px,100%);background:var(--surface);border:1px solid var(--line-soft);border-radius:20px;box-shadow:var(--shadow);padding:28px 26px;display:grid;gap:18px}
.login-brand{display:flex;align-items:center;gap:12px}
.login-brand b{display:block;font-size:19px;font-weight:800}
.login-brand span{font-size:13px;color:var(--muted)}
.login-card .pw{position:relative}
.login-card .pw .field{padding-right:72px}
.login-card .pw button{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--primary);font-weight:700;font-size:13px;padding:6px 8px;border-radius:8px}
.login-err{display:none;padding:10px 12px;border-radius:12px;background:var(--danger-soft);color:var(--danger);font-size:13.5px}
.login-err.on{display:block}
.login-card .btn{width:100%;padding:12px 16px}
.who{margin-top:auto;display:grid;gap:10px;padding:14px 12px;border-top:1px solid rgba(255,255,255,.08)}
.who .nm{font-weight:600;color:#fff;font-size:13px;overflow-wrap:anywhere}
.who .rl{display:inline-block;margin-top:4px;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(255,255,255,.1);color:var(--side-ink)}
.who button{border:1px solid rgba(255,255,255,.18);background:transparent;color:var(--side-ink);border-radius:10px;padding:8px 12px;font-weight:600}
@media (max-width:900px){.who{margin:0 0 0 auto;border:0;padding:0;display:flex;align-items:center;gap:10px}}
`;
document.head.appendChild(css);


document.addEventListener('click', e => {
  if (document.documentElement.dataset.role === 'admin') return;
  const el = e.target.closest && e.target.closest('[data-act]');
  if (el && ADMIN_ACTS.includes(el.dataset.act)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
document.addEventListener('submit', e => {
  if (document.documentElement.dataset.role !== 'admin' && e.target.id === 'lform') { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

/* ---------- adapter data: meniru window.claude yang dipakai aplikasi ---------- */
const listeners = new Set();
async function pull(){
  const { data, error } = await sb.from('letters').select('id,data');
  if (error) { listeners.forEach(l => l.err(error)); return; }
  const docs = data.map(r => ({ id: r.id, data: () => r.data }));
  listeners.forEach(l => l.ok({ docs }));
}
const db = {
  collection: () => ({ onSnapshot(ok, err){ const l = { ok, err }; listeners.add(l); pull(); return () => listeners.delete(l); } }),
  doc: path => { const id = path.split('/')[1]; return {
    async set(d){ const { error } = await sb.from('letters').upsert({ id, data: d }); if (error) throw fail(error); await pull(); },
    async delete(){ const { error } = await sb.from('letters').delete().eq('id', id); if (error) throw fail(error); await pull(); }
  }; }
};
const assets = {
  async upload(f, o){
    const id = crypto.randomUUID().replace(/-/g, '');
    const { error } = await sb.storage.from(BUCKET).upload(id, f, { contentType: (o && o.type) || undefined });
    if (error) throw fail(error);
    return { id, sizeBytes: f.size };
  },
  async delete(id){ await sb.storage.from(BUCKET).remove([id]); }
};
function saveBlob(b, name){
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const downloads = { async save({ filename, data }){ saveBlob(new Blob([data], { type: 'text/csv;charset=utf-8' }), filename); } };
window.claude = { use: async n => { await authReady; return ({ db, assets, downloads })[n] || null; } };

/* ---------- lampiran: ubah /_blob/ID menjadi tautan sementara dari Supabase ---------- */
const idOf = u => String(u || '').replace(/^.*\/_blob\//, '').split(/[?#]/)[0];
async function signed(id){
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(id, 3600);
  if (error) throw error; return data.signedUrl;
}
document.addEventListener('click', async e => {
  const a = e.target.closest && e.target.closest('a[href*="/_blob/"]'); if (!a) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const dl = a.hasAttribute('download'), w = dl ? null : window.open('', '_blank');
  try {
    const url = await signed(idOf(a.getAttribute('href')));
    if (dl) saveBlob(await (await fetch(url)).blob(), a.getAttribute('download') || 'lampiran');
    else if (w) w.location.href = url;
  } catch { if (w) w.close(); alert('File tidak bisa dibuka.'); }
}, true);
new MutationObserver(() => {
  document.querySelectorAll('img[src*="/_blob/"]').forEach(async img => {
    const id = idOf(img.getAttribute('src')); img.removeAttribute('src');
    try { img.src = await signed(id); } catch {}
  });
}).observe(document.body, { childList: true, subtree: true });

/* ---------- login ---------- */
const ico = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
function showLogin(msg){
  document.body.classList.add('locked');
  document.body.style.overflow = 'hidden';
  const box = document.createElement('div'); box.className = 'login';
  box.innerHTML = `<form class="login-card" id="loginForm" novalidate>
    <div class="login-brand"><div style="width:42px;height:42px;border-radius:13px;background:linear-gradient(145deg,#3d8f8b,#2d6f78);display:grid;place-items:center;color:#fff">${ico}</div><div><b>Arsip Surat</b><span>Masuk untuk melanjutkan</span></div></div>
    <div class="login-err" id="loginErr" role="alert"></div>
    <div class="fld"><label for="lu">Email</label><input class="field" id="lu" type="email" autocomplete="username"></div>
    <div class="fld"><label for="lp">Kata sandi</label><div class="pw"><input class="field" id="lp" type="password" autocomplete="current-password"><button type="button" id="lshow">Lihat</button></div></div>
    <button type="submit" class="btn primary" id="lgo">Masuk</button>
  </form>`;
  document.body.appendChild(box);
  const $ = s => box.querySelector(s);
  const err = m => { $('#loginErr').textContent = m; $('#loginErr').classList.toggle('on', !!m); };
  if (!configured) err('Isi SUPABASE_URL dan SUPABASE_KEY di login.js, dan pastikan script Supabase dimuat di index.html.');
  else if (msg) err(msg);
  $('#lu').focus();
  $('#lshow').addEventListener('click', () => { const p = $('#lp'), on = p.type === 'password'; p.type = on ? 'text' : 'password'; $('#lshow').textContent = on ? 'Sembunyi' : 'Lihat'; });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    if (!configured) return;
    const email = $('#lu').value.trim(), password = $('#lp').value;
    if (!email || !password) { err('Isi email dan kata sandi.'); return; }
    $('#lgo').disabled = true; $('#lgo').textContent = 'Memeriksa...';
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    $('#lgo').disabled = false; $('#lgo').textContent = 'Masuk';
    if (error) { err('Email atau kata sandi salah.'); $('#lp').value = ''; $('#lp').focus(); return; }
    box.remove(); enter(data.user);
  });
}
async function enter(user){
  const { data, error } = await sb.from('profiles').select('role').eq('id', user.id).single();
  if (error || !data) { await sb.auth.signOut(); document.querySelector('.login')?.remove(); showLogin('Akun ini belum punya peran. Hubungi admin.'); return; }
  document.documentElement.dataset.role = data.role;
  document.body.classList.remove('locked'); document.body.style.overflow = '';
  const side = document.querySelector('.side');
  if (side && !side.querySelector('.who')) {
    const w = document.createElement('div'); w.className = 'who';
    w.innerHTML = '<div><div class="nm"></div><span class="rl"></span></div><button type="button" id="logoutBtn">Keluar</button>';
    w.querySelector('.nm').textContent = user.email;
    w.querySelector('.rl').textContent = data.role === 'admin' ? 'Admin' : 'Petugas';
    side.appendChild(w);
    w.querySelector('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
  }
  sb.channel('letters-live').on('postgres_changes', { event: '*', schema: 'public', table: 'letters' }, pull).subscribe();
  resolveAuth();
}
(async () => {
  if (!configured) { showLogin(); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) { document.body.classList.add('locked'); enter(session.user); } else showLogin();
})();
})();