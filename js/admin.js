/* =====================================================================
 *  admin.js — Dasbor Nabire Resto (SPA, hash router, tanpa framework)
 *  Prinsip cepat: halaman dibuat sekali lalu disembunyikan; data tampil
 *  dari cache dulu (SWR); aksi kecil optimistic + rollback; login
 *  langsung membawa data layar pertama; prefetch menu lain saat idle.
 * ===================================================================== */
(function () {
  'use strict';
  const C = window.Core, esc = C.esc, rp = C.rupiah, DEMO = !C.GAS_URL;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ROLE = { kasir: 1, admin: 2, superadmin: 3 };
  const STATUS = ['Menunggu', 'Diproses', 'Siap', 'Selesai', 'Batal'];
  const LAYANAN = { dinein: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery' };
  const BAYAR = { kasir: 'Bayar di Kasir', cod: 'COD', transfer: 'Transfer', qris: 'QRIS' };
  const ICONS = ['fa-solid fa-utensils', 'fa-solid fa-crown', 'fa-solid fa-drumstick-bite', 'fa-solid fa-fish', 'fa-solid fa-burger', 'fa-solid fa-mug-hot', 'fa-solid fa-ice-cream', 'fa-solid fa-bowl-rice', 'fa-solid fa-pizza-slice', 'fa-solid fa-pepper-hot', 'fa-solid fa-cookie', 'fa-solid fa-leaf', 'fa-solid fa-bowl-food', 'fa-solid fa-glass-water', 'fa-solid fa-cake-candles', 'fa-solid fa-shrimp', 'fa-solid fa-egg', 'fa-solid fa-star'];
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#e2e8f0"/><text x="80" y="56" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Tanpa foto</text></svg>');

  const ST = { token: '', user: null, boot: null, page: '', pages: {}, orderFilter: 'Menunggu', orderQ: '', menuTab: 'menu', menuCat: '', newIds: {}, crm: { f: { halaman: 1 }, sel: {} }, wa: { tab: 'blast' }, poll: { t: null, delay: 15000 } };

  // =================================================================
  //  API (+ adaptor mode contoh)
  // =================================================================
  async function call(action, data, opt) {
    if (DEMO) return DemoApi.call(action, data || {});
    setNet('sync');
    const r = await C.api(action, data, opt);
    setNet(r.network ? 'off' : 'on');
    return r;
  }
  function setNet(s) { const d = $('#netDot'); if (!d) return; d.className = 'net-dot' + (s === 'off' ? ' off' : s === 'sync' ? ' sync' : ''); d.title = s === 'off' ? 'Koneksi bermasalah' : s === 'sync' ? 'Menyinkronkan…' : 'Tersambung'; }
  const ukey = k => 'adm:' + (ST.user ? ST.user.username : 'x') + ':' + k;
  function swr(key, action, data, render, opt) { if (DEMO) return call(action, data).then(r => { if (r.success) render(r.data, false); return r; }); return C.swr(ukey(key), action, data, render, opt); }

  // =================================================================
  //  UI helper: toast, dialog, drawer, tombol loading
  // =================================================================
  function toast(msg, type) {
    const t = document.createElement('div'); t.className = 'toast ' + (type || '');
    t.innerHTML = '<i class="fa-solid ' + (type === 'err' ? 'fa-circle-exclamation' : 'fa-circle-check') + '"></i><span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), type === 'err' ? 5500 : 3200);
  }
  function res2toast(r, okMsg) { if (r.success) toast(r.message || okMsg || 'Tersimpan', 'ok'); else toast(r.message || 'Terjadi masalah, coba lagi.', 'err'); return r.success; }
  function closeLayer() { $('#layer').innerHTML = ''; document.body.style.overflow = ''; }
  function openLayer(html, center) {
    $('#layer').innerHTML = '<div class="overlay' + (center ? ' center' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.style.overflow = 'hidden';
    const ov = $('#layer .overlay'); ov.addEventListener('click', e => { if (e.target === ov) closeLayer(); });
    const f = ov.querySelector('input,textarea,select,button'); if (f && innerWidth > 760) setTimeout(() => f.focus(), 50);
    return ov;
  }
  function drawer(title, body, foot) {
    return openLayer('<div class="drawer"><div class="dr-h"><h3>' + title + '</h3><button class="btn btn-ghost btn-icon" data-close aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div><div class="dr-b">' + body + '</div>' + (foot ? '<div class="dr-f">' + foot + '</div>' : '') + '</div>');
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeLayer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#layer').innerHTML) closeLayer(); });
  /** Konfirmasi; bila word diisi, pengguna wajib mengetik kata itu. */
  function confirmBox(title, text, okLabel, opt) {
    opt = opt || {};
    return new Promise(res => {
      const ov = openLayer('<div class="dialog"><h3>' + esc(title) + '</h3><p>' + text + '</p>' + (opt.word ? '<div class="field" style="margin-top:14px"><label>Ketik <b>' + opt.word + '</b> untuk melanjutkan</label><input class="input" id="cfWord" autocomplete="off" /></div>' : '') +
        '<div class="acts"><button class="btn btn-ghost" data-no>Batal</button><button class="btn ' + (opt.danger ? 'btn-danger' : 'btn-primary') + '" data-yes ' + (opt.word ? 'disabled' : '') + '>' + esc(okLabel || 'Ya, lanjutkan') + '</button></div></div>', true);
      const yes = ov.querySelector('[data-yes]');
      if (opt.word) ov.querySelector('#cfWord').addEventListener('input', e => { yes.disabled = e.target.value.trim() !== opt.word; });
      ov.querySelector('[data-no]').onclick = () => { closeLayer(); res(false); };
      yes.onclick = () => { closeLayer(); res(true); };
    });
  }
  function showSecret(title, text, secret) { openLayer('<div class="dialog"><h3>' + esc(title) + '</h3><p>' + text + '</p><div class="secret">' + esc(secret) + '</div><div class="acts"><button class="btn btn-ghost" data-copy>Salin</button><button class="btn btn-primary" data-close>Sudah dicatat</button></div></div>', true)
    .querySelector('[data-copy]').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(secret); toast('Disalin', 'ok'); }; }
  async function busy(btn, fn) {
    if (!btn) return fn(); const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Memproses…';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
  }
  const fmtTgl = (iso, jam) => { if (!iso) return '-'; const d = new Date(iso); if (isNaN(d)) return String(iso); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + (jam !== false ? ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''); };
  const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' mnt lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; return fmtTgl(iso, false); };
  const can = r => ST.user && ROLE[ST.user.role] >= ROLE[r];
  const wa62 = h => { h = String(h || '').replace(/\D/g, ''); return h[0] === '0' ? '62' + h.slice(1) : h; };
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; }
  function download(name, text, mime) { const b = new Blob([text], { type: mime || 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function toCsv(rows, cols) { const q = v => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return '﻿' + [cols.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).join(','))).join('\n'); }
  function parseCsv(text) {
    const rows = []; let row = [], f = '', q = false; text = text.replace(/^﻿/, '');
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') q = false; else f += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch; }
    if (f || row.length) { row.push(f.replace(/\r$/, '')); rows.push(row); }
    const h = (rows.shift() || []).map(x => x.trim().toLowerCase());
    return rows.filter(r => r.join('').trim()).map(r => { const o = {}; h.forEach((k, i) => o[k] = (r[i] || '').trim()); return o; });
  }
  /** Kompres foto di browser sebelum diunggah (hemat kuota & cepat di HP). */
  function compressImage(file, max, q) {
    max = max || 1400; q = q || 0.82;
    return new Promise((res, rej) => {
      if (!/^image\//.test(file.type)) return rej(new Error('Pilih berkas gambar (JPG/PNG/WebP).'));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); res(cv.toDataURL(file.type === 'image/png' && file.size < 400000 ? 'image/png' : 'image/jpeg', q)); };
      img.onerror = () => rej(new Error('Gambar tidak bisa dibaca.')); img.src = url;
    });
  }
  async function uploadFile(file, name) {
    const dataUrl = await compressImage(file);
    if (DEMO) return { success: true, data: { url: dataUrl } };
    return call('uploadImage', { dataUrl, name: name || file.name });
  }
  /** Komponen pilih gambar: URL atau unggah foto. */
  function imgField(key, label, val, wide) {
    return '<div class="field"><label>' + label + '</label><div class="imgpick"><div class="prev' + (wide ? ' wide' : '') + '" data-prev="' + key + '" style="background-image:url(\'' + esc(val || '') + '\')">' + (val ? '' : '<i class="fa-solid fa-image"></i>') + '</div>' +
      '<div class="ctr"><input class="input" data-k="' + key + '" value="' + esc(val || '') + '" placeholder="Tempel URL gambar atau unggah →" />' +
      '<label class="btn btn-ghost btn-sm" style="justify-self:start"><i class="fa-solid fa-upload"></i> Unggah foto<input type="file" accept="image/*" data-upload="' + key + '" hidden /></label></div></div></div>';
  }
  function bindUploads(root, onChange) {
    $$('input[data-upload]', root).forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return; const key = inp.dataset.upload, lbl = inp.parentElement;
      await busy(lbl, async () => {
        try { const r = await uploadFile(f); if (!r.success) return toast(r.message, 'err');
          const t = $('[data-k="' + key + '"]', root); t.value = r.data.url; setPrev(root, key, r.data.url); onChange && onChange(key, r.data.url); toast('Foto terunggah', 'ok');
        } catch (e) { toast(e.message, 'err'); }
      }); inp.value = '';
    }));
    $$('input[data-k]', root).forEach(i => { if ($('[data-prev="' + i.dataset.k + '"]', root)) i.addEventListener('input', debounce(() => setPrev(root, i.dataset.k, i.value), 400)); });
  }
  function setPrev(root, key, url) { const p = $('[data-prev="' + key + '"]', root); if (p) { p.style.backgroundImage = url ? "url('" + url.replace(/'/g, '%27') + "')" : ''; p.innerHTML = url ? '' : '<i class="fa-solid fa-image"></i>'; } }

  // =================================================================
  //  AUTH
  // =================================================================
  function applyBrand() {
    const s = (ST.boot && ST.boot.settings) || C.Store.get('brand', null) || window.DEMO_DATA.settings;
    C.applyTheme(s);
    $$('.js-brand-name').forEach(e => e.textContent = s.brand_name || 'Nabire Resto');
    $$('.js-brand-mark').forEach(e => { e.innerHTML = s.logo_url ? '<img class="brand-logo" src="' + esc(s.logo_url) + '" alt="">' : '<i class="' + esc(s.brand_icon || 'fa-solid fa-utensils') + '"></i>'; if (s.logo_url) { e.style.background = 'none'; e.style.boxShadow = 'none'; } });
    document.title = 'Dasbor — ' + (s.brand_name || 'Resto');
    C.Store.set('brand', { brand_name: s.brand_name, brand_icon: s.brand_icon, logo_url: s.logo_url, color_primary: s.color_primary, color_primary_deep: s.color_primary_deep, color_dark: s.color_dark, color_dark2: s.color_dark2, color_text: s.color_text, color_accent: s.color_accent, color_bg: s.color_bg, font_body: s.font_body, font_display: s.font_display });
  }
  function showAuth(must) { $('#appView').hidden = true; $('#authView').hidden = false; $('#loginForm').hidden = !!must; $('#mustForm').hidden = !must; $('#demoBanner').hidden = !DEMO; applyBrand(); stopPoll(); }
  function saveSession() { C.Store.set('sess', { token: ST.token, user: ST.user }); }
  function logout(msg) { C.Store.del('sess'); ST.token = ''; ST.user = null; ST.boot = null; C.setToken(''); ST.pages = {}; $('#content').innerHTML = ''; showAuth(); if (msg) $('#lgMsg').textContent = msg; }
  C.onAuthFail(() => logout('Sesi berakhir, silakan masuk lagi.'));

  $('#lgEye').onclick = () => { const p = $('#lgPass'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#lgMsg').textContent = '';
    await busy($('#lgBtn'), async () => {
      const r = await call('login', { username: $('#lgUser').value.trim(), password: $('#lgPass').value });
      if (!r.success) { $('#lgMsg').textContent = r.message; return; }
      ST.token = r.data.token; ST.user = r.data.user; C.setToken(ST.token); saveSession();
      if (ST.user.mustChange) { showAuth(true); $('#mpOld').value = $('#lgPass').value; $('#mpNew').focus(); return; }
      enterApp(r.data.boot);
    });
  });
  $('#mustForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#mpMsg').textContent = '';
    if ($('#mpNew').value !== $('#mpNew2').value) { $('#mpMsg').textContent = 'Ulangi password tidak sama.'; return; }
    await busy($('#mpBtn'), async () => {
      const r = await call('changePassword', { oldPassword: $('#mpOld').value, newPassword: $('#mpNew').value });
      if (!r.success) { $('#mpMsg').textContent = r.message; return; }
      ST.token = r.data.token; ST.user = r.data.user; C.setToken(ST.token); saveSession(); toast(r.message, 'ok'); enterApp(r.data.boot);
    });
  });

  // =================================================================
  //  SHELL & ROUTER
  // =================================================================
  const NAV = [
    { id: 'ringkasan', t: 'Ringkasan', i: 'fa-solid fa-chart-simple', r: 'kasir', g: 'Utama', sub: () => salam() },
    { id: 'pesanan', t: 'Pesanan', i: 'fa-solid fa-receipt', r: 'kasir', g: 'Utama', sub: () => 'Pantau & proses pesanan masuk' },
    { id: 'reservasi', t: 'Reservasi', i: 'fa-solid fa-calendar-check', r: 'kasir', g: 'Utama', sub: () => 'Reservasi meja & daftar meja' },
    { id: 'menu', t: 'Menu', i: 'fa-solid fa-bowl-food', r: 'kasir', g: 'Utama', sub: () => 'Kelola menu, harga, foto, dan kategori' },
    { id: 'operasional', t: 'Jam & Operasional', i: 'fa-solid fa-store', r: 'admin', g: 'Toko', sub: () => 'Buka/tutup, jadwal, pembayaran, ongkir, reservasi' },
    { id: 'pelanggan', t: 'Pelanggan', i: 'fa-solid fa-address-book', r: 'admin', g: 'Pemasaran', sub: () => 'CRM: nama · email · WhatsApp' },
    { id: 'whatsapp', t: 'WhatsApp', i: 'fa-brands fa-whatsapp', r: 'admin', g: 'Pemasaran', sub: () => 'Blast, antrean, dan notifikasi otomatis' },
    { id: 'tampilan', t: 'Tampilan', i: 'fa-solid fa-palette', r: 'superadmin', g: 'Web', sub: () => 'Warna, huruf, teks, dan foto halaman publik' },
    { id: 'pengguna', t: 'Pengguna', i: 'fa-solid fa-users-gear', r: 'superadmin', g: 'Sistem', sub: () => 'Akun staf & kasir' },
    { id: 'migrasi', t: 'Migrasi Data', i: 'fa-solid fa-right-left', r: 'superadmin', g: 'Sistem', sub: () => 'Pindahkan data dari app lama' },
    { id: 'pengaturan', t: 'Pengaturan', i: 'fa-solid fa-gear', r: 'kasir', g: 'Sistem', sub: () => 'Akun, data contoh, lisensi' }
  ];
  function salam() { const h = new Date().getHours(), w = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'; return 'Selamat ' + w + ', ' + (ST.user ? ST.user.nama : '') + ' · ' + new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function navItems() { return NAV.filter(n => can(n.r)); }
  function buildNav() {
    let g = '', html = '<div class="sb-brand"><span class="brand-mark js-brand-mark"><i class="fa-solid fa-utensils"></i></span><div><div class="brand-name js-brand-name">Nabire Resto</div><div class="brand-sub">Dasbor</div></div></div>';
    navItems().forEach(n => { if (n.g !== g) { g = n.g; html += '<div class="sb-group">' + g + '</div>'; } html += '<button class="sb-link" data-go="' + n.id + '"><i class="' + n.i + '"></i>' + n.t + (n.id === 'pesanan' ? '<span class="sb-badge" data-pending hidden></span>' : n.id === 'reservasi' ? '<span class="sb-badge" data-rsvpending hidden></span>' : '') + '</button>'; });
    html += '<button class="sb-link" data-nk-license><i class="fa-solid fa-key"></i>Lisensi</button>';
    html += '<button class="sb-link" data-act="logout"><i class="fa-solid fa-right-from-bracket"></i>Keluar</button>';
    html += '<div class="sb-foot"><span class="js-copy-own"></span><span data-nk-copy></span></div>';
    $('#sidebar').innerHTML = html;
    const main = ['ringkasan', 'pesanan', 'reservasi', 'menu'];
    $('#bnav').innerHTML = main.map(id => { const n = NAV.find(x => x.id === id); return '<button data-go="' + id + '"><i class="' + n.i + '"></i>' + n.t + (id === 'pesanan' ? '<span class="dot" data-pending hidden></span>' : id === 'reservasi' ? '<span class="dot" data-rsvpending hidden></span>' : '') + '</button>'; }).join('') + '<button data-act="more"><i class="fa-solid fa-grip"></i>Lainnya</button>';
    $('#avatarBtn').textContent = (ST.user.nama || 'A').trim().charAt(0).toUpperCase();
    $$('.js-copy-own').forEach(e => e.textContent = '© ' + new Date().getFullYear() + ' ' + ((ST.boot && ST.boot.settings && ST.boot.settings.brand_name) || 'Nabire Resto') + '.');
    applyBrand();
  }
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); closeLayer(); location.hash = '#/' + go.dataset.go; return; }
    const a = e.target.closest('[data-act="logout"]'); if (a) { confirmBox('Keluar?', 'Anda akan keluar dari dasbor di perangkat ini.', 'Keluar').then(y => y && logout()); return; }
    if (e.target.closest('[data-act="more"]')) { moreSheet(); return; }
    if (e.target.closest('#avatarBtn')) { location.hash = '#/pengaturan'; }
  });
  function moreSheet() {
    drawer('Menu lainnya', '<div class="more-grid">' + navItems().map(n => '<button data-go="' + n.id + '"><i class="' + n.i + '"></i>' + n.t + '</button>').join('') +
      '<button data-nk-license><i class="fa-solid fa-key"></i>Lisensi</button><button data-act="logout"><i class="fa-solid fa-right-from-bracket"></i>Keluar</button></div>' +
      '<p class="xs muted" style="margin-top:16px;text-align:center"><span class="js-copy-own"></span> <span data-nk-copy></span></p>');
  }

  function route() {
    if (!ST.user) return;
    const id = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'ringkasan';
    const n = navItems().find(x => x.id === id) || navItems()[0];
    if (location.hash === '#key') return;   // panel lisensi (SDK Nabire Kreatif)
    ST.page = n.id;
    $('#pageTitle').textContent = n.t; $('#pageSub').textContent = n.sub();
    $$('[data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === n.id));
    $$('#content > .page').forEach(p => p.hidden = p.dataset.page !== n.id);
    let el = $('#content > .page[data-page="' + n.id + '"]');
    const P = PAGES[n.id];
    if (!el) { el = document.createElement('section'); el.className = 'page'; el.dataset.page = n.id; $('#content').appendChild(el); P.mount(el); }
    else { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    P.show && P.show(el);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  function enterApp(boot) {
    $('#authView').hidden = true; $('#appView').hidden = false;
    if (boot) { ST.boot = boot; C.putCache(ukey('boot'), boot); }
    buildNav(); route(); updatePending();
    refreshBoot(!boot);
    startPoll();
    if (window.requestIdleCallback) requestIdleCallback(prefetch, { timeout: 4000 }); else setTimeout(prefetch, 1500);
  }
  /** Segarkan data inti (SWR). render ulang hanya bila berubah. */
  async function refreshBoot(force) {
    return swr('boot', 'adminBoot', {}, (d) => { ST.boot = d; applyBrand(); rerender(); updatePending(); }, { fresh: force ? 0 : 20000, force });
  }
  function rerender() { Object.keys(PAGES).forEach(id => { const el = $('#content > .page[data-page="' + id + '"]'); if (el && PAGES[id].refresh) PAGES[id].refresh(el); }); }
  function prefetch() {
    if (DEMO || !ST.user) return;
    const calls = [];
    if (can('admin')) calls.push({ action: 'crm.stats' }, { action: 'wa.blastList' });
    if (can('superadmin')) calls.push({ action: 'notif.config' }, { action: 'usersList' });
    if (!calls.length) return;
    call('batch', { calls }).then(r => { if (!r.success) return; Object.keys(r.data).forEach(a => { const x = r.data[a]; if (x.success) C.putCache(ukey('p:' + a), x.data); }); });
  }

  // ---------- Polling pesanan baru (hanya saat tab terlihat, makin jarang bila sepi) ----------
  function startPoll() { stopPoll(); if (DEMO) return; ST.poll.delay = 15000; ST.poll.t = setTimeout(pollOnce, ST.poll.delay); }
  function stopPoll() { clearTimeout(ST.poll.t); }
  async function pollOnce() {
    if (!ST.user) return;
    if (document.visibilityState === 'visible') {
      const r = await C.api('ordersSince', { v: ST.boot && ST.boot.ordersV });
      if (r.success && r.data.changed) {
        const lama = {}; (ST.boot.orders || []).forEach(o => lama[o.id] = 1);
        const baru = r.data.orders.filter(o => !lama[o.id] && o.status === 'Menunggu');
        const rLama = {}; (ST.boot.reservasi || []).forEach(x => rLama[x.id] = 1);
        const rBaru = (r.data.reservasi || []).filter(x => !rLama[x.id] && x.status === 'Menunggu');
        if (rBaru.length) toast('📅 Reservasi baru: ' + rBaru.map(x => x.nama + ' (' + x.orang + ' org)').join(', '));
        Object.assign(ST.boot, { orders: r.data.orders, dashboard: r.data.dashboard, ordersV: r.data.v, reservasi: r.data.reservasi || ST.boot.reservasi });
        C.putCache(ukey('boot'), ST.boot);
        if (baru.length) { baru.forEach(o => ST.newIds[o.id] = 1); beep(); toast('🔔 ' + baru.length + ' pesanan baru masuk: ' + baru.map(o => o.nama).join(', ')); }
        rerender(); updatePending(); ST.poll.delay = 15000;
      } else ST.poll.delay = Math.min(60000, ST.poll.delay * 1.5);
    }
    ST.poll.t = setTimeout(pollOnce, ST.poll.delay);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ST.user && !DEMO) { stopPoll(); ST.poll.delay = 15000; pollOnce(); } });
  function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.15, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .5); o.start(); o.stop(a.currentTime + .5); } catch (e) { } }
  function updatePending() {
    const n = ((ST.boot && ST.boot.orders) || []).filter(o => o.status === 'Menunggu').length;
    $$('[data-pending]').forEach(b => { b.hidden = !n; b.textContent = n; });
    const rn = ((ST.boot && ST.boot.reservasi) || []).filter(r => r.status === 'Menunggu').length;
    $$('[data-rsvpending]').forEach(b => { b.hidden = !rn; b.textContent = rn; });
  }

  // =================================================================
  //  HALAMAN
  // =================================================================
  const PAGES = {};

  // ---------------- RINGKASAN ----------------
  PAGES.ringkasan = {
    mount(el) { el.addEventListener('click', e => { const o = e.target.closest('[data-order]'); if (o) openOrder(o.dataset.order); const f = e.target.closest('[data-filter]'); if (f) { ST.orderFilter = f.dataset.filter; location.hash = '#/pesanan'; } const m = e.target.closest('[data-tmode]'); if (m) setTokoMode(m.dataset.tmode); }); this.refresh(el); },
    refresh(el) {
      const b = ST.boot; if (!b) { el.innerHTML = skel(); return; }
      const d = b.dashboard, t = d.today, y = d.yesterday;
      const delta = (a, z) => { if (!z) return a ? '<span class="up">▲ baru</span>' : '<span class="muted">sama</span>'; const p = Math.round((a - z) / z * 100); return p >= 0 ? '<span class="up">▲ naik ' + p + '%</span>' : '<span class="down">▼ turun ' + Math.abs(p) + '%</span>'; };
      const max = Math.max(1, ...d.chart.map(c => c.omzet));
      const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const topMax = Math.max(1, ...(d.top.map(x => x.qty)));
      const recent = (b.orders || []).slice(0, 6);
      const todo = [];
      const pv = (b.orders || []).filter(o => o.statusBayar === 'Menunggu verifikasi' && o.status !== 'Batal').length;
      const rv = (b.reservasi || []).filter(r => r.status === 'Menunggu').length;
      if (d.menunggu) todo.push('<div class="todo"><i class="ic fa-solid fa-bell"></i><div class="t"><b>' + d.menunggu + ' pesanan</b> menunggu konfirmasi</div><button class="btn btn-primary btn-sm" data-filter="Menunggu">Proses</button></div>');
      if (pv) todo.push('<div class="todo"><i class="ic fa-solid fa-money-check-dollar" style="background:var(--info-bg);color:var(--info)"></i><div class="t"><b>' + pv + ' bukti bayar</b> perlu diverifikasi</div><button class="btn btn-primary btn-sm" data-filter="Bayar">Cek</button></div>');
      if (rv) todo.push('<div class="todo"><i class="ic fa-solid fa-calendar-check"></i><div class="t"><b>' + rv + ' reservasi</b> menunggu konfirmasi</div><button class="btn btn-primary btn-sm" data-go="reservasi">Lihat</button></div>');
      if (d.diproses) todo.push('<div class="todo"><i class="ic fa-solid fa-fire-burner" style="background:var(--info-bg);color:var(--info)"></i><div class="t"><b>' + d.diproses + ' pesanan</b> sedang di dapur / siap</div><button class="btn btn-ghost btn-sm" data-filter="Diproses">Lihat</button></div>');
      const off = ((b.menu && b.menu.items) || []).filter(m => !m.aktif).length;
      if (off) todo.push('<div class="todo"><i class="ic fa-solid fa-eye-slash" style="background:var(--slate-100);color:var(--muted)"></i><div class="t"><b>' + off + ' menu</b> sedang disembunyikan (habis)</div><button class="btn btn-ghost btn-sm" data-go="menu">Cek</button></div>');
      if (b.demo && b.demo.total) todo.push('<div class="todo"><i class="ic fa-solid fa-flask"></i><div class="t">Masih ada <b>' + b.demo.total + ' data contoh</b>. Hapus sebelum tayang.</div><button class="btn btn-ghost btn-sm" data-go="pengaturan">Atur</button></div>');
      const tk = tokoNow();
      el.innerHTML =
        tokoStrip(tk) +
        '<div class="grid g4">' +
          '<div class="kpi dark"><div class="k-lbl"><i class="fa-solid fa-sack-dollar"></i>Omzet hari ini</div><div class="k-num mono">' + rp(t.omzet) + '</div><div class="k-sub">' + delta(t.omzet, y.omzet) + ' vs kemarin</div></div>' +
          '<div class="kpi"><div class="k-lbl"><i class="fa-solid fa-receipt"></i>Pesanan hari ini</div><div class="k-num mono">' + t.pesanan + '</div><div class="k-sub">' + delta(t.pesanan, y.pesanan) + '</div></div>' +
          '<div class="kpi click" data-filter="Menunggu"><div class="k-lbl"><i class="fa-solid fa-bell"></i>Perlu tindakan</div><div class="k-num mono">' + (d.menunggu + pv + rv) + '</div><div class="k-sub">' + d.menunggu + ' pesanan · ' + pv + ' bayar · ' + rv + ' reservasi</div></div>' +
          '<div class="kpi click" data-go="reservasi"><div class="k-lbl"><i class="fa-solid fa-calendar-day"></i>Reservasi hari ini</div><div class="k-num mono">' + (b.reservasi || []).filter(r => r.tanggal === tk.tgl && ['Menunggu', 'Dikonfirmasi', 'Datang'].indexOf(r.status) > -1).length + '</div><div class="k-sub">7 hari: ' + rp(d.mingguOmzet) + ' · ' + d.mingguPesanan + ' pesanan</div></div>' +
        '</div>' +
        '<div class="grid g-main" style="margin-top:16px">' +
          '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-chart-column"></i>Omzet 7 hari</h3><span class="xs muted">Batal tidak dihitung</span></div><div class="bars">' +
            d.chart.map((c, i) => '<div class="bar' + (i === 6 ? ' today' : '') + '" title="' + esc(c.tgl) + ': ' + rp(c.omzet) + ' (' + c.pesanan + ' pesanan)"><span class="v">' + (c.omzet >= 1e6 ? (c.omzet / 1e6).toFixed(1) + 'jt' : Math.round(c.omzet / 1000) + 'rb') + '</span><div class="b" style="height:' + Math.max(3, c.omzet / max * 100) + '%"></div><span class="d">' + (i === 6 ? 'Hari ini' : hari[new Date(c.tgl + 'T00:00:00').getDay()]) + '</span></div>').join('') +
          '</div></div>' +
          '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-list-check"></i>Perlu tindakan</h3></div>' + (todo.length ? todo.join('') : '<div class="empty"><i class="fa-solid fa-mug-hot"></i>Semua beres. Santai sejenak ☕</div>') + '</div>' +
        '</div>' +
        '<div class="grid g-main" style="margin-top:16px">' +
          '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-clock-rotate-left"></i>Pesanan terbaru</h3><button class="btn btn-ghost btn-sm" data-go="pesanan">Semua</button></div><div class="olist">' + (recent.length ? recent.map(orderCard).join('') : '<div class="empty"><i class="fa-solid fa-receipt"></i>Belum ada pesanan.</div>') + '</div></div>' +
          '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-fire"></i>Menu terlaris (7 hari)</h3></div>' + (d.top.length ? d.top.map(x => '<div class="hbar"><span>' + esc(x.nama) + '</span><b class="mono">' + x.qty + '</b><div class="track"><div class="fill" style="width:' + (x.qty / topMax * 100) + '%"></div></div></div>').join('') : '<div class="empty">Belum ada data.</div>') +
            '<div class="card-h" style="margin:18px 0 8px"><h3><i class="fa-solid fa-motorcycle"></i>Jenis layanan</h3></div><div class="row">' + Object.keys(LAYANAN).map(k => '<span class="badge b-mute">' + LAYANAN[k] + ': <b>' + (d.layanan[k] || 0) + '</b></span>').join('') + '</div></div>' +
        '</div>';
    }
  };
  function skel() { return '<div class="grid g4">' + '<div class="sk" style="height:110px"></div>'.repeat(4) + '</div><div class="sk" style="height:260px;margin-top:16px"></div>'; }

  // ---------------- PESANAN ----------------
  function orderCard(o) {
    const items = (o.items || []).map(i => i.qty + '× ' + i.name).join(', ');
    const next = { Menunggu: ['Diproses', 'fa-fire-burner', 'Proses'], Diproses: ['Siap', 'fa-bell-concierge', o.layanan === 'delivery' ? 'Antar' : 'Siap'], Siap: ['Selesai', 'fa-check', 'Selesai'] }[o.status];
    return '<div class="ocard' + (ST.newIds[o.id] ? ' new' : '') + '" data-order="' + esc(o.id) + '">' +
      '<div><div class="o-id">' + esc(o.nama) + ' <span class="xs muted mono">#' + esc(o.id) + '</span></div><div class="o-meta"><span><i class="fa-regular fa-clock"></i> ' + ago(o.waktu) + '</span><span>' + (LAYANAN[o.layanan] || o.layanan) + (o.meja ? ' · Meja ' + esc(o.meja) : '') + (o.layanan === 'takeaway' && o.waktuAmbil ? ' · ' + esc(o.waktuAmbil) : '') + '</span><span>' + (BAYAR[o.pembayaran] || o.pembayaran) + '</span>' + payBadge(o) + (o.is_demo ? '<span class="badge b-mute">contoh</span>' : '') + '</div></div>' +
      '<div><div class="o-total mono">' + rp(o.total) + '</div><div style="text-align:right;margin-top:4px"><span class="badge b-' + o.status + '">' + o.status + '</span></div></div>' +
      '<div class="o-items">' + esc(items) + '</div>' +
      (next ? '<div class="o-act"><button class="btn btn-primary btn-sm" data-st="' + next[0] + '" data-id="' + esc(o.id) + '"><i class="fa-solid ' + next[1] + '"></i> ' + next[2] + '</button>' + (o.status === 'Menunggu' ? '<button class="btn btn-ghost btn-sm" data-st="Batal" data-id="' + esc(o.id) + '">Batalkan</button>' : '') + (o.noWA ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + wa62(o.noWA) + '"><i class="fa-brands fa-whatsapp"></i> Chat</a>' : '') + '</div>' : '') +
      '</div>';
  }
  /** Ubah status: optimistic (layar berubah seketika), rollback bila server gagal. */
  async function setStatus(ids, status, catatan) {
    ids = [].concat(ids);
    if (status === 'Batal' && !(await confirmBox('Batalkan pesanan?', 'Pelanggan akan diberi tahu (bila notifikasi aktif).', 'Ya, batalkan', { danger: true }))) return;
    const prev = {};
    (ST.boot.orders || []).forEach(o => { if (ids.indexOf(o.id) > -1) { prev[o.id] = o.status; o.status = status; delete ST.newIds[o.id]; } });
    rerender(); updatePending(); toast(ids.length + ' pesanan → ' + status, 'ok');
    const r = await call('orderStatus', { ids, status, catatan });
    if (!r.success) { (ST.boot.orders || []).forEach(o => { if (prev[o.id]) o.status = prev[o.id]; }); rerender(); updatePending(); toast(r.message, 'err'); }
    else { C.putCache(ukey('boot'), ST.boot); refreshBoot(true); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-st][data-id]'); if (!b) return; e.stopPropagation(); setStatus(b.dataset.id, b.dataset.st);
  }, true);
  function openOrder(id) {
    const o = (ST.boot.orders || []).find(x => x.id === id); if (!o) return; delete ST.newIds[id];
    const items = (o.items || []).map(i => '<div class="sumrow" style="color:var(--text)"><span>' + i.qty + '× <b>' + esc(i.name) + '</b>' + (i.variationName ? ' <span class="muted">(' + esc(i.variationName) + ')</span>' : '') + (i.addonNames ? '<br><span class="xs muted">+ ' + esc(i.addonNames) + '</span>' : '') + (i.note ? '<br><span class="xs muted">📝 ' + esc(i.note) + '</span>' : '') + '</span><span class="mono">' + rp(i.unit * i.qty) + '</span></div>').join('');
    const msg = encodeURIComponent('Halo ' + o.nama + ', pesanan #' + o.id + ' Anda: ');
    const ov = drawer('Pesanan #' + esc(o.id),
      '<div class="row" style="margin-bottom:14px"><span class="badge b-' + o.status + '">' + o.status + '</span><span class="xs muted">' + fmtTgl(o.waktu) + '</span></div>' +
      '<dl class="kv"><dt>Pelanggan</dt><dd>' + esc(o.nama) + '</dd><dt>WhatsApp</dt><dd>' + (o.noWA ? '<a href="https://wa.me/' + wa62(o.noWA) + '?text=' + msg + '" target="_blank" rel="noopener" style="color:var(--ok);font-weight:600"><i class="fa-brands fa-whatsapp"></i> ' + esc(o.noWA) + '</a>' : '<span class="muted">tidak diisi</span>') + '</dd>' +
      '<dt>Layanan</dt><dd>' + (LAYANAN[o.layanan] || o.layanan) + '</dd><dt>Pembayaran</dt><dd>' + (BAYAR[o.pembayaran] || o.pembayaran) + '</dd>' +
      (o.meja ? '<dt>Meja</dt><dd><b>' + esc(o.meja) + '</b></dd>' : '') + (o.layanan === 'takeaway' ? '<dt>Ambil</dt><dd>' + esc(o.waktuAmbil || 'Secepatnya') + '</dd>' : '') + (o.catatan ? '<dt>Catatan</dt><dd>' + esc(o.catatan) + '</dd>' : '') +
      (o.layanan === 'delivery' ? '<dt>Alamat</dt><dd>' + esc(o.alamat || '-') + (o.lat ? ' · <a href="https://maps.google.com/?q=' + o.lat + ',' + o.lng + '" target="_blank" rel="noopener" style="color:var(--info)">Buka peta</a>' : '') + '</dd><dt>Jarak</dt><dd>' + o.jarakKm + ' km</dd>' : '') + '</dl>' +
      '<div class="card" style="margin-top:16px;padding:14px 16px">' + items + '<div class="sumrow"><span>Subtotal</span><span class="mono">' + rp(o.subtotal) + '</span></div>' + (o.ongkir ? '<div class="sumrow"><span>Ongkir</span><span class="mono">' + rp(o.ongkir) + '</span></div>' : '') + (o.pajak ? '<div class="sumrow"><span>Pajak & layanan</span><span class="mono">' + rp(o.pajak) + '</span></div>' : '') + '<div class="sumrow total"><span>Total</span><span class="mono">' + rp(o.total) + '</span></div></div>' +
      payBlock(o) +
      '<div class="field" style="margin-top:16px"><label>Catatan admin <span class="opt">(ikut di notifikasi siap/batal)</span></label><textarea class="input" id="odNote" rows="2">' + esc(o.catatanAdmin || '') + '</textarea></div>' +
      '<div class="field"><label>Ubah status</label><div class="chips" style="flex-wrap:wrap">' + STATUS.map(s => '<button class="chip' + (s === o.status ? ' active' : '') + '" data-ost="' + s + '">' + s + '</button>').join('') + '</div></div>' +
      (can('admin') ? '<button class="btn btn-danger btn-sm" id="odDel" style="margin-top:8px"><i class="fa-solid fa-trash"></i> Hapus pesanan</button>' : ''),
      '<button class="btn btn-ghost" data-close>Tutup</button>' + (o.noWA ? '<a class="btn btn-ok" style="flex:1" target="_blank" rel="noopener" href="https://wa.me/' + wa62(o.noWA) + '?text=' + msg + '"><i class="fa-brands fa-whatsapp"></i> Chat pelanggan</a>' : ''));
    $$('[data-ost]', ov).forEach(b => b.onclick = () => { closeLayer(); setStatus(o.id, b.dataset.ost, $('#odNote') ? undefined : undefined); });
    $('#odNote', ov).addEventListener('change', async e => { const r = await call('orderStatus', { ids: [o.id], status: o.status, catatan: e.target.value }); if (res2toast(r, 'Catatan tersimpan')) o.catatanAdmin = e.target.value; });
    $$('[data-pay]', ov).forEach(b => b.onclick = () => setPay(o, b.dataset.pay));
    const del = $('#odDel', ov); if (del) del.onclick = async () => { if (!(await confirmBox('Hapus pesanan #' + o.id + '?', 'Pesanan akan dihapus permanen dari laporan.', 'Hapus', { danger: true }))) return;
      const r = await call('orderDelete', { ids: [o.id] }); if (res2toast(r)) { ST.boot.orders = ST.boot.orders.filter(x => x.id !== o.id); rerender(); updatePending(); refreshBoot(true); } };
  }
  function payBadge(o) { const s = o.statusBayar; if (!s || s === 'Bayar di tempat') return ''; return '<span class="badge ' + ({ Lunas: 'b-ok', 'Menunggu verifikasi': 'b-info', 'Belum bayar': 'b-warn', Ditolak: 'b-err' }[s] || 'b-mute') + '">' + esc(s) + '</span>'; }
  function payBlock(o) {
    if (o.pembayaran !== 'transfer' && o.pembayaran !== 'qris') return '<div class="todo" style="margin-top:14px"><i class="ic fa-solid fa-cash-register" style="background:var(--slate-100);color:var(--muted)"></i><div class="t small">Dibayar di tempat (' + (BAYAR[o.pembayaran] || o.pembayaran) + ').</div></div>';
    return '<div class="card" style="margin-top:14px;padding:14px 16px" data-testid="pay-block"><div class="row" style="justify-content:space-between;margin-bottom:10px"><b style="color:var(--dark)"><i class="fa-solid fa-money-check-dollar" style="color:var(--accent)"></i> Pembayaran ' + (BAYAR[o.pembayaran] || '') + '</b>' + (payBadge(o) || '<span class="badge b-mute">-</span>') + '</div>' +
      (o.buktiBayar ? '<a href="' + esc(o.buktiBayar) + '" target="_blank" rel="noopener"><img src="' + esc(o.buktiBayar) + '" alt="Bukti bayar" style="width:100%;max-height:320px;object-fit:contain;border-radius:12px;background:var(--slate-100)" /></a><p class="hint">Ketuk foto untuk memperbesar.</p>' : '<p class="small muted">Belum ada bukti pembayaran dari pelanggan.</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn btn-ok btn-sm" data-pay="Lunas"><i class="fa-solid fa-check"></i> Tandai lunas</button>' + (o.buktiBayar ? '<button class="btn btn-danger btn-sm" data-pay="Ditolak"><i class="fa-solid fa-xmark"></i> Tolak bukti</button>' : '') + '<button class="btn btn-ghost btn-sm" data-pay="Belum bayar">Belum bayar</button></div></div>';
  }
  async function setPay(o, st) {
    let catatan = '';
    if (st === 'Ditolak') { catatan = await askText('Tolak bukti pembayaran', 'Alasan (dikirim ke pelanggan):', 'Nominal tidak sesuai / bukti tidak terbaca'); if (catatan === null) return; }
    const prev = o.statusBayar; o.statusBayar = st; closeLayer(); rerender();
    const r = await call('orderPay', { id: o.id, statusBayar: st, catatan });
    if (!r.success) { o.statusBayar = prev; rerender(); toast(r.message, 'err'); } else { toast(r.message, 'ok'); refreshBoot(true); }
  }
  /** Dialog isian teks (pengganti prompt). Hasil null bila dibatalkan. */
  function askText(title, label, def, extraHtml) {
    return new Promise(res => {
      const ov = openLayer('<div class="dialog"><h3>' + esc(title) + '</h3>' + (extraHtml || '') + '<div class="field" style="margin-top:12px"><label>' + label + '</label><input class="input" id="askIn" value="' + esc(def || '') + '" /></div><div class="acts"><button class="btn btn-ghost" data-no>Batal</button><button class="btn btn-primary" data-yes>Simpan</button></div></div>', true);
      ov.querySelector('[data-no]').onclick = () => { closeLayer(); res(null); };
      ov.querySelector('[data-yes]').onclick = () => { const v = ov.querySelector('#askIn').value; const ex = ov.querySelector('[data-extra]'); closeLayer(); res(ex ? { text: v, extra: ex.value } : v); };
    });
  }
  function tokoNow() { const ops = Object.assign({}, window.DEMO_DATA.settings, (ST.boot && ST.boot.settings) || {}, (ST.boot && ST.boot.ops) || {}); const t = statusToko(ops, 0); t.tgl = partsNow(ops.zona_waktu).tgl; t.mode = ops.mode_toko || 'otomatis'; return t; }
  function tokoStrip(t) {
    return '<div class="card" style="margin-bottom:16px;padding:14px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap" data-testid="toko-strip"><span class="badge ' + (t.buka ? 'b-ok' : 'b-err') + '" style="font-size:14px;padding:6px 14px">● ' + (t.buka ? 'BUKA' : 'TUTUP') + '</span><span class="small" style="flex:1;min-width:180px">' + esc(t.info || '') + (t.mode !== 'otomatis' ? ' <b>(diatur manual)</b>' : '') + '</span>' +
      (can('admin') ? '<div class="seg">' + [['otomatis', 'Otomatis'], ['buka', 'Buka'], ['tutup', 'Tutup / Libur']].map(m => '<button data-tmode="' + m[0] + '"' + (t.mode === m[0] ? ' class="active"' : '') + '>' + m[1] + '</button>').join('') + '</div>' : '') + '</div>';
  }
  async function setTokoMode(mode) {
    if (mode === 'tutup' && !(await confirmBox('Tutup toko sekarang?', 'Semua menu tidak bisa dipesan sampai Anda memilih <b>Otomatis</b> atau <b>Buka</b> lagi. Reservasi untuk hari ini juga ditutup.', 'Tutup toko', { danger: true }))) return;
    const r = await call('tokoMode', { mode });
    if (!r.success) return toast(r.message, 'err');
    ST.boot.ops = r.data.ops; ST.boot.toko = r.data.toko; if (ST.boot.settings) Object.assign(ST.boot.settings, r.data.ops); C.putCache(ukey('boot'), ST.boot); rerender(); toast(r.message, 'ok');
  }

  PAGES.pesanan = {
    mount(el) {
      el.innerHTML = '<div class="row" style="margin-bottom:12px"><div class="grow"><input class="input" id="oq" placeholder="Cari nama, nomor, atau kode pesanan…" /></div><button class="btn btn-ghost" id="oRefresh"><i class="fa-solid fa-rotate"></i> Segarkan</button><button class="btn btn-ghost" id="oCsv"><i class="fa-solid fa-file-csv"></i> Ekspor</button></div><div class="chips" id="ochips" style="margin-bottom:14px"></div><div class="olist" id="olist"></div>';
      $('#oq', el).addEventListener('input', debounce(e => { ST.orderQ = e.target.value.toLowerCase(); this.refresh(el); }, 250));
      $('#ochips', el).addEventListener('click', e => { const c = e.target.closest('[data-f]'); if (c) { ST.orderFilter = c.dataset.f; this.refresh(el); } });
      $('#olist', el).addEventListener('click', e => { const o = e.target.closest('[data-order]'); if (o && !e.target.closest('a,button')) openOrder(o.dataset.order); });
      $('#oRefresh', el).onclick = e => busy(e.currentTarget, () => refreshBoot(true));
      $('#oCsv', el).onclick = () => download('pesanan-' + new Date().toISOString().slice(0, 10) + '.csv', toCsv(this.list().map(o => Object.assign({}, o, { items: (o.items || []).map(i => i.qty + 'x ' + i.name).join('; ') })), ['id', 'waktu', 'nama', 'noWA', 'layanan', 'pembayaran', 'alamat', 'items', 'subtotal', 'ongkir', 'pajak', 'total', 'status']));
      this.refresh(el);
    },
    list() { const all = (ST.boot && ST.boot.orders) || [], q = ST.orderQ; return all.filter(o => (ST.orderFilter === 'Semua' || (ST.orderFilter === 'Bayar' ? (o.statusBayar === 'Menunggu verifikasi' && o.status !== 'Batal') : o.status === ST.orderFilter)) && (!q || (o.nama + ' ' + o.id + ' ' + o.noWA).toLowerCase().indexOf(q) > -1)); },
    refresh(el) {
      const all = (ST.boot && ST.boot.orders) || [], cnt = { Semua: all.length }; STATUS.forEach(s => cnt[s] = all.filter(o => o.status === s).length);
      cnt.Bayar = all.filter(o => o.statusBayar === 'Menunggu verifikasi' && o.status !== 'Batal').length;
      $('#ochips', el).innerHTML = ['Menunggu', 'Bayar', 'Diproses', 'Siap', 'Selesai', 'Batal', 'Semua'].map(s => '<button class="chip' + (ST.orderFilter === s ? ' active' : '') + '" data-f="' + s + '">' + (s === 'Bayar' ? '<i class="fa-solid fa-money-check-dollar"></i> Verifikasi bayar' : s) + ' <span class="n">' + cnt[s] + '</span></button>').join('');
      const L = this.list().slice(0, 200);
      $('#olist', el).innerHTML = L.length ? L.map(orderCard).join('') : '<div class="empty"><i class="fa-solid fa-receipt"></i>Tidak ada pesanan ' + (ST.orderFilter === 'Semua' ? '' : 'berstatus ' + ST.orderFilter) + '.</div>';
    }
  };

  // ---------------- MENU & KATEGORI ----------------
  PAGES.menu = {
    mount(el) {
      el.innerHTML = '<div class="tabs" role="tablist"><button data-tab="menu">Menu</button><button data-tab="kategori">Kategori</button></div><div id="mBody"></div>';
      el.addEventListener('click', e => {
        const t = e.target.closest('[data-tab]'); if (t) { ST.menuTab = t.dataset.tab; this.refresh(el); return; }
        const a = e.target.closest('[data-ma]'); if (!a) return; const id = a.dataset.id;
        if (a.dataset.ma === 'add') menuEditor({}); if (a.dataset.ma === 'edit') menuEditor(menuById(id));
        if (a.dataset.ma === 'del') delMenu(id); if (a.dataset.ma === 'cat') { ST.menuCat = a.dataset.cat; this.refresh(el); }
        if (a.dataset.ma === 'catadd') catEditor({ baru: true }); if (a.dataset.ma === 'catedit') catEditor(catById(id));
        if (a.dataset.ma === 'catdel') delCat(id); if (a.dataset.ma === 'catup' || a.dataset.ma === 'catdown') moveCat(id, a.dataset.ma === 'catup' ? -1 : 1);
        if (a.dataset.ma === 'up' || a.dataset.ma === 'down') moveMenu(id, a.dataset.ma === 'up' ? -1 : 1);
      });
      el.addEventListener('change', e => { const s = e.target.closest('[data-toggle]'); if (s) toggleMenu(s.dataset.toggle, s.checked); });
      el.addEventListener('input', debounce(e => { if (e.target.id === 'mq') { ST.menuQ = e.target.value.toLowerCase(); this.renderList(el); } }, 200));
      this.refresh(el);
    },
    refresh(el) {
      $$('[data-tab]', el).forEach(b => b.classList.toggle('active', b.dataset.tab === ST.menuTab));
      const M = ST.boot && ST.boot.menu; if (!M) { $('#mBody', el).innerHTML = skel(); return; }
      if (ST.menuTab === 'kategori') return this.renderCats(el);
      const cats = M.categories;
      $('#mBody', el).innerHTML = '<div class="row" style="margin-bottom:12px"><div class="grow"><input class="input" id="mq" placeholder="Cari menu…" value="' + esc(ST.menuQ || '') + '" /></div>' + (can('admin') ? '<button class="btn btn-primary" data-ma="add"><i class="fa-solid fa-plus"></i> Tambah menu</button>' : '') + '</div>' +
        '<div class="chips" style="margin-bottom:14px"><button class="chip' + (!ST.menuCat ? ' active' : '') + '" data-ma="cat" data-cat="">Semua <span class="n">' + M.items.length + '</span></button>' + cats.map(c => '<button class="chip' + (ST.menuCat === c.id ? ' active' : '') + '" data-ma="cat" data-cat="' + esc(c.id) + '"><i class="' + esc(c.ikon) + '"></i>' + esc(c.nama) + ' <span class="n">' + M.items.filter(i => i.kategori === c.id).length + '</span></button>').join('') + '</div><div class="mgrid" id="mgrid"></div>' +
        (can('admin') ? '' : '<p class="hint" style="margin-top:12px">Kasir hanya dapat menandai menu habis/tersedia.</p>');
      this.renderList(el);
    },
    renderList(el) {
      const M = ST.boot.menu, q = ST.menuQ || '', cats = {}; M.categories.forEach(c => cats[c.id] = c.nama);
      const L = M.items.filter(i => (!ST.menuCat || i.kategori === ST.menuCat) && (!q || String(i.nama).toLowerCase().indexOf(q) > -1));
      $('#mgrid', el).innerHTML = L.length ? L.map(i => '<div class="mcard' + (i.aktif ? '' : ' off') + '"><div class="mimg"><img src="' + esc(i.gambar || PLACEHOLDER) + '" alt="" loading="lazy" onerror="this.src=\'' + PLACEHOLDER + '\'" />' + (i.is_demo ? '<span class="badge b-mute">contoh</span>' : (i.tag ? '<span class="badge b-dark">' + esc(i.tag) + '</span>' : '')) + '</div>' +
        '<div class="mb"><span class="xs muted">' + esc(cats[i.kategori] || 'Tanpa kategori') + '</span><span class="mn">' + esc(i.nama) + '</span><span class="mp mono">' + rp(i.harga) + '</span><span class="xs muted">' + (i.variasi.length ? i.variasi.length + ' ukuran · ' : '') + (i.tambahan.length ? i.tambahan.length + ' tambahan · ' : '') + C.esc(i.terjual) + ' terjual</span></div>' +
        '<div class="mf"><label class="switch" title="Tampil di web"><input type="checkbox" data-toggle="' + esc(i.id) + '"' + (i.aktif ? ' checked' : '') + ' /><span class="tr"></span><span class="xs">' + (i.aktif ? 'Tersedia' : 'Habis') + '</span></label>' +
        (can('admin') ? '<div class="row" style="gap:4px"><button class="btn btn-ghost btn-icon btn-sm" data-ma="up" data-id="' + esc(i.id) + '" aria-label="Naikkan"><i class="fa-solid fa-arrow-up"></i></button><button class="btn btn-ghost btn-icon btn-sm" data-ma="edit" data-id="' + esc(i.id) + '" aria-label="Ubah"><i class="fa-solid fa-pen"></i></button><button class="btn btn-danger btn-icon btn-sm" data-ma="del" data-id="' + esc(i.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></div>' : '') + '</div></div>').join('')
        : '<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-bowl-rice"></i>Belum ada menu.' + (can('admin') ? ' Klik <b>Tambah menu</b>.' : '') + '</div>';
    },
    renderCats(el) {
      const cats = ST.boot.menu.categories;
      $('#mBody', el).innerHTML = (can('admin') ? '<div class="row" style="margin-bottom:12px;justify-content:flex-end"><button class="btn btn-primary" data-ma="catadd"><i class="fa-solid fa-plus"></i> Tambah kategori</button></div>' : '') +
        '<div class="tbl-wrap stack"><table class="tbl"><thead><tr><th>Urutan</th><th>Kategori</th><th>Jumlah menu</th><th>Status</th><th></th></tr></thead><tbody>' +
        cats.map((c, i) => '<tr><td data-label="Urutan"><div class="row" style="gap:4px"><button class="btn btn-ghost btn-icon btn-sm" data-ma="catup" data-id="' + esc(c.id) + '" ' + (i ? '' : 'disabled') + ' aria-label="Naik"><i class="fa-solid fa-arrow-up"></i></button><button class="btn btn-ghost btn-icon btn-sm" data-ma="catdown" data-id="' + esc(c.id) + '" ' + (i < cats.length - 1 ? '' : 'disabled') + ' aria-label="Turun"><i class="fa-solid fa-arrow-down"></i></button></div></td>' +
          '<td data-label="Kategori"><i class="' + esc(c.ikon) + '" style="color:var(--accent);width:20px"></i> <b>' + esc(c.nama) + '</b> <span class="xs muted">' + esc(c.id) + '</span></td><td data-label="Menu">' + ST.boot.menu.items.filter(m => m.kategori === c.id).length + '</td>' +
          '<td data-label="Status">' + (c.aktif ? '<span class="badge b-ok">Tampil</span>' : '<span class="badge b-mute">Disembunyikan</span>') + '</td>' +
          '<td data-label="">' + (can('admin') ? '<div class="row" style="gap:4px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-ma="catedit" data-id="' + esc(c.id) + '"><i class="fa-solid fa-pen"></i> Ubah</button><button class="btn btn-danger btn-icon btn-sm" data-ma="catdel" data-id="' + esc(c.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></div>' : '') + '</td></tr>').join('') +
        '</tbody></table></div>';
    }
  };
  const menuById = id => ST.boot.menu.items.find(i => i.id === id);
  const catById = id => ST.boot.menu.categories.find(c => c.id === id);
  function setMenu(d) { ST.boot.menu = d; C.putCache(ukey('boot'), ST.boot); rerender(); }
  async function toggleMenu(id, aktif) {
    const m = menuById(id); if (!m) return; const prev = m.aktif; m.aktif = aktif; rerender();
    const r = await call('menuToggle', { id, aktif });
    if (!r.success) { m.aktif = prev; rerender(); toast(r.message, 'err'); } else toast(r.message, 'ok');
  }
  async function delMenu(id) {
    const m = menuById(id); if (!(await confirmBox('Hapus "' + m.nama + '"?', 'Menu dihapus permanen dari web. Riwayat pesanan tetap aman. Ingin sementara saja? Matikan saklar "Tersedia".', 'Hapus', { danger: true }))) return;
    const backup = ST.boot.menu.items.slice(); ST.boot.menu.items = backup.filter(x => x.id !== id); rerender();
    const r = await call('menuDelete', { id }); if (res2toast(r)) setMenu(r.data); else { ST.boot.menu.items = backup; rerender(); }
  }
  async function moveMenu(id, dir) {
    const L = ST.boot.menu.items, i = L.findIndex(x => x.id === id), j = i + dir; if (j < 0 || j >= L.length) return;
    [L[i], L[j]] = [L[j], L[i]]; rerender();
    const r = await call('menuReorder', { ids: L.map(x => x.id) }); if (!r.success) toast(r.message, 'err');
  }
  function optRows(list, kind) { return (list || []).map((o, i) => '<div class="opt-row" data-opt="' + kind + '"><input class="input" placeholder="Nama (cth: Jumbo)" value="' + esc(o.name) + '" data-on /><input class="input" type="number" min="0" step="500" placeholder="+ Rp" value="' + (o.price || 0) + '" data-op /><button class="btn btn-ghost btn-icon" data-rm aria-label="Hapus"><i class="fa-solid fa-xmark"></i></button></div>').join(''); }
  function menuEditor(m) {
    const cats = ST.boot.menu.categories, baru = !m.id;
    const ov = drawer(baru ? 'Tambah menu' : 'Ubah menu',
      imgField('gambar', 'Foto menu', m.gambar) +
      '<div class="field"><label>Nama menu</label><input class="input" data-k="nama" value="' + esc(m.nama || '') + '" maxlength="100" /></div>' +
      '<div class="split2"><div class="field"><label>Kategori</label><select class="input" data-k="kategori">' + cats.map(c => '<option value="' + esc(c.id) + '"' + (c.id === (m.kategori || ST.menuCat) ? ' selected' : '') + '>' + esc(c.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Harga mulai (Rp)</label><input class="input mono" type="number" min="0" step="500" data-k="harga" value="' + (m.harga || '') + '" /></div></div>' +
      '<div class="field"><label>Deskripsi singkat</label><textarea class="input" data-k="deskripsi" rows="3" maxlength="400">' + esc(m.deskripsi || '') + '</textarea></div>' +
      '<div class="field"><label>Label di foto <span class="opt">(opsional, cth: Best Seller, Pedas)</span></label><input class="input" data-k="tag" value="' + esc(m.tag || '') + '" maxlength="30" /></div>' +
      '<div class="field"><label>Pilihan ukuran <span class="opt">(wajib pilih 1; harga tambahan)</span></label><div id="optVar">' + optRows(m.variasi && m.variasi.length ? m.variasi : [{ name: 'Reguler', price: 0 }], 'v') + '</div><button class="btn btn-ghost btn-sm" data-addopt="v"><i class="fa-solid fa-plus"></i> Ukuran</button></div>' +
      '<div class="field"><label>Tambahan <span class="opt">(opsional)</span></label><div id="optAdd">' + optRows(m.tambahan, 'a') + '</div><button class="btn btn-ghost btn-sm" data-addopt="a"><i class="fa-solid fa-plus"></i> Tambahan</button></div>' +
      '<label class="switch"><input type="checkbox" data-k="aktif"' + (m.aktif === false ? '' : ' checked') + ' /><span class="tr"></span>Tersedia di web</label>',
      '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" style="flex:1" id="meSave"><i class="fa-solid fa-floppy-disk"></i> Simpan menu</button>');
    bindUploads(ov);
    ov.addEventListener('click', e => {
      const a = e.target.closest('[data-addopt]'); if (a) { e.preventDefault(); const box = $(a.dataset.addopt === 'v' ? '#optVar' : '#optAdd', ov); box.insertAdjacentHTML('beforeend', optRows([{ name: '', price: 0 }], a.dataset.addopt)); box.lastElementChild.querySelector('input').focus(); }
      const rm = e.target.closest('[data-rm]'); if (rm) rm.parentElement.remove();
    });
    $('#meSave', ov).onclick = e => busy(e.currentTarget, async () => {
      const g = k => $('[data-k="' + k + '"]', ov), opts = kind => $$('[data-opt="' + kind + '"]', ov).map(r => ({ name: r.querySelector('[data-on]').value.trim(), price: Number(r.querySelector('[data-op]').value) || 0 })).filter(o => o.name);
      const item = { id: m.id, nama: g('nama').value.trim(), kategori: g('kategori').value, harga: Number(g('harga').value), deskripsi: g('deskripsi').value.trim(), tag: g('tag').value.trim(), rating: m.rating == null ? 5 : m.rating, terjual: m.terjual || 0, gambar: g('gambar').value.trim(), aktif: g('aktif').checked, variasi: opts('v'), tambahan: opts('a') };
      if (!item.nama) return toast('Nama menu wajib diisi.', 'err'); if (!(item.harga >= 0) || g('harga').value === '') return toast('Isi harga.', 'err');
      const r = await call('menuSave', { item }); if (res2toast(r)) { closeLayer(); setMenu(r.data); }
    });
  }
  function catEditor(c) {
    const ov = drawer(c.baru ? 'Tambah kategori' : 'Ubah kategori',
      '<div class="field"><label>Nama kategori</label><input class="input" id="ceNama" value="' + esc(c.nama || '') + '" maxlength="50" /></div>' +
      '<div class="field"><label>Ikon</label><div class="chips" style="flex-wrap:wrap" id="ceIcons">' + ICONS.map(i => '<button class="chip' + (i === (c.ikon || ICONS[0]) ? ' active' : '') + '" data-ic="' + i + '" aria-label="' + i + '"><i class="' + i + '"></i></button>').join('') + '</div></div>' +
      '<label class="switch"><input type="checkbox" id="ceAktif"' + (c.aktif === false ? '' : ' checked') + ' /><span class="tr"></span>Tampilkan di web</label>',
      '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" style="flex:1" id="ceSave">Simpan</button>');
    let ikon = c.ikon || ICONS[0];
    $('#ceIcons', ov).onclick = e => { const b = e.target.closest('[data-ic]'); if (!b) return; ikon = b.dataset.ic; $$('[data-ic]', ov).forEach(x => x.classList.toggle('active', x === b)); };
    $('#ceSave', ov).onclick = e => busy(e.currentTarget, async () => {
      const r = await call('categorySave', { category: { id: c.id, baru: !!c.baru, nama: $('#ceNama', ov).value.trim(), ikon, aktif: $('#ceAktif', ov).checked } });
      if (res2toast(r)) { closeLayer(); setMenu(r.data); }
    });
  }
  async function delCat(id) { const c = catById(id); if (!(await confirmBox('Hapus kategori "' + c.nama + '"?', 'Hanya bisa bila tidak ada menu di kategori ini.', 'Hapus', { danger: true }))) return; const r = await call('categoryDelete', { id }); if (res2toast(r)) setMenu(r.data); }
  async function moveCat(id, dir) {
    const L = ST.boot.menu.categories, i = L.findIndex(x => x.id === id), j = i + dir; if (j < 0 || j >= L.length) return;
    [L[i], L[j]] = [L[j], L[i]]; rerender();
    for (let k = 0; k < L.length; k++) if (L[k].urutan !== k + 1) { L[k].urutan = k + 1; await call('categorySave', { category: { id: L[k].id, nama: L[k].nama, ikon: L[k].ikon, aktif: L[k].aktif, urutan: k + 1 } }); }
    refreshBoot(true);
  }

  // ---------------- RESERVASI & MEJA ----------------
  const RSV_BADGE = { Menunggu: 'b-warn', Dikonfirmasi: 'b-ok', Datang: 'b-info', Selesai: 'b-mute', Ditolak: 'b-err', Batal: 'b-err' };
  const tglLabel = t => { const d = new Date(t + 'T00:00:00Z'); return HARI[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getUTCMonth()]; };
  PAGES.reservasi = {
    f: 'mendatang', tab: 'reservasi',
    mount(el) {
      el.innerHTML = '<div class="tabs"><button data-rt="reservasi"><i class="fa-solid fa-calendar-check"></i> Reservasi</button><button data-rt="meja"><i class="fa-solid fa-chair"></i> Daftar Meja</button></div><div id="rsBody"></div>';
      el.addEventListener('click', e => {
        const t = e.target.closest('[data-rt]'); if (t) { this.tab = t.dataset.rt; return this.refresh(el); }
        const f = e.target.closest('[data-rf]'); if (f) { this.f = f.dataset.rf; return this.refresh(el); }
        const a = e.target.closest('[data-ra]'); if (a) return this.act(el, a.dataset.ra, a.dataset.id);
        const m = e.target.closest('[data-ma2]'); if (m) return this.meja(el, m.dataset.ma2, m.dataset.id);
      });
      this.refresh(el);
    },
    show(el) { this.refresh(el); },
    list() {
      const L = (ST.boot && ST.boot.reservasi) || [], today = tokoNow().tgl, aktif = ['Menunggu', 'Dikonfirmasi', 'Datang'];
      return { hari: L.filter(r => r.tanggal === today && aktif.indexOf(r.status) > -1), mendatang: L.filter(r => r.tanggal >= today && aktif.indexOf(r.status) > -1), menunggu: L.filter(r => r.status === 'Menunggu'), lewat: L.filter(r => r.tanggal < today || aktif.indexOf(r.status) === -1).reverse(), semua: L.slice().reverse() };
    },
    refresh(el) {
      $$('[data-rt]', el).forEach(b => b.classList.toggle('active', b.dataset.rt === this.tab));
      if (!ST.boot) { $('#rsBody', el).innerHTML = skel(); return; }
      if (this.tab === 'meja') return this.renderMeja(el);
      const G = this.list(), L = G[this.f] || [];
      let html = '<div class="chips" style="margin-bottom:14px">' + [['hari', 'Hari ini'], ['mendatang', 'Mendatang'], ['menunggu', 'Perlu konfirmasi'], ['lewat', 'Selesai / lewat'], ['semua', 'Semua']].map(x => '<button class="chip' + (this.f === x[0] ? ' active' : '') + '" data-rf="' + x[0] + '">' + x[1] + ' <span class="n">' + G[x[0]].length + '</span></button>').join('') + '</div>';
      if (!L.length) html += '<div class="empty"><i class="fa-solid fa-calendar"></i>Tidak ada reservasi di daftar ini.</div>';
      let tg = '';
      L.forEach(r => {
        if (r.tanggal !== tg) { tg = r.tanggal; html += '<h4 class="small" style="margin:16px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">' + tglLabel(r.tanggal) + '</h4>'; }
        html += '<div class="ocard" data-testid="rsv-' + esc(r.id) + '" style="cursor:default"><div><div class="o-id"><span class="mono" style="font-size:18px">' + esc(r.jam) + '</span> · ' + esc(r.nama) + ' <span class="xs muted mono">#' + esc(r.id) + '</span></div>' +
          '<div class="o-meta"><span><i class="fa-solid fa-users"></i> ' + r.orang + ' orang</span>' + (r.area ? '<span>' + esc(r.area) + '</span>' : '') + (r.meja ? '<span><b>Meja ' + esc(r.meja) + '</b></span>' : '') + (r.is_demo ? '<span class="badge b-mute">contoh</span>' : '') + '</div></div>' +
          '<div style="text-align:right"><span class="badge ' + (RSV_BADGE[r.status] || 'b-mute') + '">' + r.status + '</span></div>' +
          (r.catatan || r.catatanAdmin ? '<div class="o-items" style="white-space:normal">' + (r.catatan ? '📝 ' + esc(r.catatan) : '') + (r.catatanAdmin ? ' · <i>Admin: ' + esc(r.catatanAdmin) + '</i>' : '') + '</div>' : '') +
          '<div class="o-act">' + (r.status === 'Menunggu' ? '<button class="btn btn-primary btn-sm" data-ra="konfirmasi" data-id="' + esc(r.id) + '"><i class="fa-solid fa-check"></i> Konfirmasi</button><button class="btn btn-ghost btn-sm" data-ra="tolak" data-id="' + esc(r.id) + '">Tolak</button>' : '') +
          (r.status === 'Dikonfirmasi' ? '<button class="btn btn-primary btn-sm" data-ra="datang" data-id="' + esc(r.id) + '"><i class="fa-solid fa-person-walking-arrow-right"></i> Tamu datang</button><button class="btn btn-ghost btn-sm" data-ra="meja" data-id="' + esc(r.id) + '">Ganti meja</button><button class="btn btn-ghost btn-sm" data-ra="batal" data-id="' + esc(r.id) + '">Batalkan</button>' : '') +
          (r.status === 'Datang' ? '<button class="btn btn-ok btn-sm" data-ra="selesai" data-id="' + esc(r.id) + '"><i class="fa-solid fa-flag-checkered"></i> Selesai</button>' : '') +
          '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + wa62(r.noWA) + '?text=' + encodeURIComponent('Halo ' + r.nama + ', terkait reservasi #' + r.id + ' (' + tglLabel(r.tanggal) + ' ' + r.jam + '): ') + '"><i class="fa-brands fa-whatsapp"></i> Chat</a>' +
          (can('admin') ? '<button class="btn btn-danger btn-icon btn-sm" data-ra="hapus" data-id="' + esc(r.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button>' : '') + '</div></div>';
      });
      $('#rsBody', el).innerHTML = html;
    },
    async act(el, a, id) {
      const r = (ST.boot.reservasi || []).find(x => x.id === id); if (!r) return;
      let status = { konfirmasi: 'Dikonfirmasi', tolak: 'Ditolak', datang: 'Datang', selesai: 'Selesai', batal: 'Batal', meja: 'Dikonfirmasi' }[a], data = { ids: [id] };
      if (a === 'hapus') { if (!(await confirmBox('Hapus reservasi #' + id + '?', 'Data dihapus permanen.', 'Hapus', { danger: true }))) return; const x = await call('reservasiDelete', { ids: [id] }); if (res2toast(x)) { ST.boot.reservasi = x.data.reservasi; rerender(); updatePending(); } return; }
      if (a === 'konfirmasi' || a === 'meja') {
        const meja = (ST.boot.meja || []).filter(m => m.aktif);
        const opts = '<option value="">— belum ditentukan —</option>' + meja.map(m => '<option value="' + esc(m.nama) + '"' + (m.nama === r.meja ? ' selected' : '') + (m.kapasitas < r.orang ? ' disabled' : '') + '>' + esc(m.nama) + ' · ' + esc(m.area) + ' · ' + m.kapasitas + ' org' + (m.kapasitas < r.orang ? ' (kurang)' : '') + '</option>').join('');
        const v = await askText('Konfirmasi reservasi', 'Catatan untuk tamu (opsional):', '', '<p>' + esc(r.nama) + ' · ' + tglLabel(r.tanggal) + ' ' + r.jam + ' · ' + r.orang + ' orang</p><div class="field" style="margin-top:12px"><label>Meja</label><select class="input" data-extra>' + opts + '</select></div>');
        if (v === null) return; data.meja = v.extra; data.catatan = v.text;
      }
      if (a === 'tolak' || a === 'batal') { const v = await askText(a === 'tolak' ? 'Tolak reservasi' : 'Batalkan reservasi', 'Alasan (dikirim ke tamu):', a === 'tolak' ? 'Mohon maaf, meja pada jam tersebut sudah penuh.' : ''); if (v === null) return; data.catatan = v; }
      data.status = status;
      const prev = r.status; r.status = status; if (data.meja !== undefined) r.meja = data.meja; rerender(); updatePending();
      const x = await call('reservasiStatus', data);
      if (!x.success) { r.status = prev; rerender(); toast(x.message, 'err'); } else { if (x.data && x.data.reservasi) ST.boot.reservasi = x.data.reservasi; C.putCache(ukey('boot'), ST.boot); rerender(); updatePending(); toast(x.message, 'ok'); }
    },
    renderMeja(el) {
      const M = ST.boot.meja || [];
      $('#rsBody', el).innerHTML = (can('admin') ? '<div class="row" style="justify-content:space-between;margin-bottom:12px"><p class="small muted">Meja tampil sebagai pilihan saat pelanggan memesan Dine-In dan saat Anda mengonfirmasi reservasi.</p><button class="btn btn-primary" data-ma2="add"><i class="fa-solid fa-plus"></i> Tambah meja</button></div>' : '') +
        (M.length ? '<div class="tbl-wrap stack"><table class="tbl"><thead><tr><th>Meja</th><th>Area</th><th>Kapasitas</th><th>Status</th><th></th></tr></thead><tbody>' + M.map(m => '<tr><td data-label="Meja"><b>' + esc(m.nama) + '</b>' + (m.is_demo ? ' <span class="badge b-mute">contoh</span>' : '') + '</td><td data-label="Area">' + esc(m.area) + '</td><td data-label="Kapasitas">' + m.kapasitas + ' orang</td><td data-label="Status">' + (m.aktif ? '<span class="badge b-ok">aktif</span>' : '<span class="badge b-mute">nonaktif</span>') + '</td><td data-label="">' + (can('admin') ? '<div class="row" style="gap:4px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-ma2="edit" data-id="' + esc(m.id) + '">Ubah</button><button class="btn btn-danger btn-icon btn-sm" data-ma2="del" data-id="' + esc(m.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></div>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty"><i class="fa-solid fa-chair"></i>Belum ada meja.</div>');
    },
    async meja(el, a, id) {
      const m = (ST.boot.meja || []).find(x => x.id === id) || {};
      if (a === 'del') { if (!(await confirmBox('Hapus meja ' + m.nama + '?', '', 'Hapus', { danger: true }))) return; const r = await call('mejaDelete', { id }); if (res2toast(r)) { ST.boot.meja = r.data; this.refresh(el); } return; }
      const ov = drawer(a === 'add' ? 'Tambah meja' : 'Ubah meja', '<div class="split2"><div class="field"><label>Nama / nomor meja</label><input class="input" id="mjN" value="' + esc(m.nama || '') + '" placeholder="cth: M5" /></div><div class="field"><label>Kapasitas (orang)</label><input class="input" type="number" min="1" max="50" id="mjK" value="' + (m.kapasitas || 4) + '" /></div></div><div class="field"><label>Area</label><input class="input" id="mjA" value="' + esc(m.area || 'Indoor') + '" list="mjAreas" /><datalist id="mjAreas"><option>Indoor</option><option>Teras</option><option>VIP</option><option>Lesehan</option><option>Taman</option></datalist></div><label class="switch"><input type="checkbox" id="mjAk"' + (m.aktif === false ? '' : ' checked') + ' /><span class="tr"></span>Meja aktif</label>',
        '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" style="flex:1" id="mjS">Simpan</button>');
      $('#mjS', ov).onclick = e => busy(e.currentTarget, async () => { const r = await call('mejaSave', { meja: { id: m.id, nama: $('#mjN', ov).value, kapasitas: +$('#mjK', ov).value, area: $('#mjA', ov).value, aktif: $('#mjAk', ov).checked } }); if (res2toast(r)) { closeLayer(); ST.boot.meja = r.data; this.refresh(el); } });
    }
  };

  // ---------------- JAM & OPERASIONAL ----------------
  PAGES.operasional = {
    mount(el) { this.el = el; this.refresh(el); },
    show(el) { this.refresh(el); },
    refresh(el) { if (!this.dirty) this.render(el); },   // jangan buang isian yang belum disimpan saat data disegarkan
    render(el) {
      const o = Object.assign({}, window.DEMO_DATA.settings, (ST.boot && ST.boot.settings) || {}, (ST.boot && ST.boot.ops) || {});
      this.d = o; this.dirty = false;
      let jad = {}; try { jad = JSON.parse(o.jadwal_json || '{}'); } catch (e) { }
      let rek = []; try { rek = JSON.parse(o.rekening_json || '[]'); } catch (e) { }
      const t = tokoNow(), num = (k, l, h, step) => '<div class="field"><label>' + l + '</label><input class="input mono" type="number" min="0" step="' + (step || 1) + '" data-o="' + k + '" value="' + esc(o[k]) + '" />' + (h ? '<p class="hint">' + h + '</p>' : '') + '</div>';
      const tog = (k, l) => '<label class="switch" style="margin-bottom:12px"><input type="checkbox" data-ob="' + k + '"' + (o[k] !== 'TIDAK' ? ' checked' : '') + ' /><span class="tr"></span>' + l + '</label>';
      const multi = (k, l, opts) => '<div class="field"><label>' + l + '</label><div class="row" data-om="' + k + '">' + Object.keys(opts).map(x => '<label class="switch"><input type="checkbox" value="' + x + '"' + (String(o[k]).split(',').indexOf(x) > -1 ? ' checked' : '') + ' /><span class="tr"></span>' + opts[x] + '</label>').join('') + '</div></div>';
      el.innerHTML =
        '<div class="card" data-testid="ops-status"><div class="card-h"><h3><i class="fa-solid fa-store"></i>Status toko sekarang</h3><span class="badge ' + (t.buka ? 'b-ok' : 'b-err') + '" style="font-size:14px;padding:6px 14px">● ' + (t.buka ? 'BUKA' : 'TUTUP') + '</span></div>' +
          '<p class="small" style="margin-bottom:14px">' + esc(t.info || '') + '</p><div class="seg" style="margin-bottom:12px">' + [['otomatis', 'Otomatis (ikut jadwal)'], ['buka', 'Buka manual'], ['tutup', 'Tutup / Libur']].map(m => '<button data-tm="' + m[0] + '"' + ((o.mode_toko || 'otomatis') === m[0] ? ' class="active"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<div class="field"><label>Pesan saat tutup (tampil di web)</label><input class="input" data-o="pesan_tutup" value="' + esc(o.pesan_tutup) + '" /></div><p class="hint">Saat <b>Tutup</b>, semua tombol pesan di web nonaktif dan server menolak pesanan baru. Pilih <b>Otomatis</b> agar buka/tutup mengikuti jadwal di bawah.</p></div>' +
        '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="card-h"><h3><i class="fa-solid fa-clock"></i>Jadwal mingguan</h3><span class="xs muted">Jam tutup lewat tengah malam boleh (mis. 17:00–02:00)</span></div>' +
          [1, 2, 3, 4, 5, 6, 0].map(d => { const x = jad[d] || {}; return '<div class="day-row" data-day="' + d + '"><b>' + HARI[d] + '</b><label class="switch"><input type="checkbox" data-buka' + (x.libur ? '' : ' checked') + ' /><span class="tr"></span></label><input class="input mono" type="time" data-jb value="' + esc(x.buka || '09:00') + '" aria-label="Buka" /><span class="dash">–</span><input class="input mono" type="time" data-jt value="' + esc(x.tutup || '22:00') + '" aria-label="Tutup" /></div>'; }).join('') +
          '<div class="split2" style="margin-top:14px">' + num('batas_pesan_menit', 'Tutup pesanan online … menit sebelum jam tutup') + num('estimasi_menit', 'Estimasi siap / antar (menit)') + '</div>' +
          '<div class="field"><label>Tanggal libur khusus</label><div class="row"><input class="input" type="date" id="opLibur" style="max-width:200px" /><button class="btn btn-ghost btn-sm" id="opLiburAdd"><i class="fa-solid fa-plus"></i> Tambah</button></div><div class="row" id="opLiburList" style="margin-top:8px"></div></div></div>' +
          '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-money-check-dollar"></i>Layanan & pembayaran</h3></div>' + multi('layanan_aktif', 'Layanan tersedia', { dinein: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery' }) + multi('bayar_aktif', 'Metode bayar', { kasir: 'Kasir', cod: 'COD', transfer: 'Transfer', qris: 'QRIS' }) +
          '<div class="field"><label>Rekening transfer</label><div id="opRek"></div><button class="btn btn-ghost btn-sm" id="opRekAdd"><i class="fa-solid fa-plus"></i> Tambah rekening</button></div>' +
          imgField('qris_image', 'Gambar QRIS', o.qris_image) + tog('bukti_wajib', 'Bukti transfer/QRIS wajib diunggah saat pesan') +
          '<div class="field"><label>Nomor WhatsApp resto (penerima detail pesanan)</label><input class="input mono" data-o="wa_number" value="' + esc(o.wa_number) + '" /></div></div></div>' +
        '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="card-h"><h3><i class="fa-solid fa-motorcycle"></i>Ongkir delivery</h3></div><div class="split2">' + num('ongkir_dasar', 'Ongkir dasar (Rp)', '', 500) + num('ongkir_km_dasar', 'Sudah termasuk … km', '', 0.5) + num('ongkir_per_km', 'Per km berikutnya (Rp)', '', 500) + num('ongkir_max_km', 'Jarak antar maks (km)', '0 = tanpa batas', 0.5) + num('ongkir_gratis_min', 'Gratis ongkir bila belanja ≥ (Rp)', '0 = tidak ada', 1000) + num('min_order_delivery', 'Minimal belanja delivery (Rp)', '', 1000) + num('faktor_jalan', 'Faktor jalan', 'Jarak lurus × faktor ≈ jarak jalan (1,3)', 0.1) + num('pajak_persen', 'Pajak & layanan (%)', '', 0.5) + '</div>' +
          '<div class="field"><label>Koordinat resto</label><div class="row"><input class="input mono grow" data-o="resto_lat" value="' + esc(o.resto_lat) + '" placeholder="lintang" /><input class="input mono grow" data-o="resto_lng" value="' + esc(o.resto_lng) + '" placeholder="bujur" /><button class="btn btn-ghost btn-sm" id="opHere"><i class="fa-solid fa-location-crosshairs"></i> Lokasi saya</button></div><p class="hint">Tekan "Lokasi saya" saat berada di resto, atau salin dari Google Maps (klik kanan → koordinat).</p></div>' +
          '<div class="todo" id="opCalc"></div></div>' +
          '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-calendar-check"></i>Reservasi meja</h3></div>' + tog('reservasi_aktif', 'Terima reservasi online') + '<div class="split2">' + num('reservasi_kapasitas', 'Kapasitas kursi per jam', 'Total tamu yang bisa reservasi bersamaan') + num('reservasi_maks_orang', 'Maks orang per reservasi') + num('reservasi_durasi', 'Lama 1 reservasi (menit)', '', 15) + num('reservasi_interval', 'Pilihan jam tiap … menit', '', 15) + num('reservasi_hari_maks', 'Bisa dipesan … hari ke depan') + num('reservasi_min_jam', 'Minimal … jam sebelumnya', '', 0.5) + '</div>' +
          '<div class="field"><label>Catatan di form reservasi</label><textarea class="input" data-o="reservasi_info" rows="2">' + esc(o.reservasi_info) + '</textarea></div></div></div>' +
        '<div class="savebar"><span class="grow" id="opState">Ubah pengaturan lalu simpan.</span><button class="btn btn-primary" id="opSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div>';
      this.rek = Array.isArray(rek) ? rek : []; this.libur = String(o.tanggal_libur || '').split(',').filter(Boolean);
      this.renderRek(el); this.renderLibur(el); this.calc(el);
      bindUploads(el, () => this.mark(el));
      el.oninput = e => { if (e.target.closest('#opRek')) this.syncRek(el); this.mark(el); if (/ongkir|faktor|resto_/.test(e.target.dataset.o || '')) this.calc(el); };
      el.onchange = () => this.mark(el);
      el.onclick = async e => {
        const tm = e.target.closest('[data-tm]'); if (tm) { await setTokoMode(tm.dataset.tm); const keep = this.dirty; this.dirty = false; if (!keep) this.render(el); else { $$('[data-tm]', el).forEach(b => b.classList.toggle('active', b.dataset.tm === ((ST.boot.ops || {}).mode_toko))); this.dirty = true; } return; }
        if (e.target.closest('#opRekAdd')) { this.syncRek(el); this.rek.push({ bank: '', nomor: '', nama: '' }); this.renderRek(el); this.mark(el); }
        const rm = e.target.closest('[data-rekdel]'); if (rm) { this.syncRek(el); this.rek.splice(+rm.dataset.rekdel, 1); this.renderRek(el); this.mark(el); }
        if (e.target.closest('#opLiburAdd')) { const v = $('#opLibur', el).value; if (v && this.libur.indexOf(v) === -1) { this.libur.push(v); this.libur.sort(); this.renderLibur(el); this.mark(el); } }
        const lx = e.target.closest('[data-libdel]'); if (lx) { this.libur = this.libur.filter(x => x !== lx.dataset.libdel); this.renderLibur(el); this.mark(el); }
        if (e.target.closest('#opHere')) navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { $('[data-o="resto_lat"]', el).value = p.coords.latitude.toFixed(6); $('[data-o="resto_lng"]', el).value = p.coords.longitude.toFixed(6); this.mark(el); toast('Koordinat diisi dari lokasi Anda.', 'ok'); }, () => toast('Izin lokasi ditolak.', 'err'));
      };
      $('#opSave', el).onclick = e => busy(e.currentTarget, () => this.save(el));
    },
    mark(el) { this.dirty = true; $('#opState', el).textContent = 'Ada perubahan belum disimpan.'; },
    renderRek(el) { $('#opRek', el).innerHTML = this.rek.map((r, i) => '<div class="rek-row" data-rek="' + i + '"><input class="input" data-rb placeholder="Bank" value="' + esc(r.bank) + '" /><input class="input mono" data-rn placeholder="No. rekening" value="' + esc(r.nomor) + '" /><input class="input" data-ra2 placeholder="Atas nama" value="' + esc(r.nama) + '" /><button class="btn btn-ghost btn-icon" data-rekdel="' + i + '" aria-label="Hapus"><i class="fa-solid fa-xmark"></i></button></div>').join('') || '<p class="small muted">Belum ada rekening.</p>'; },
    syncRek(el) { this.rek = $$('[data-rek]', el).map(r => ({ bank: $('[data-rb]', r).value.trim(), nomor: $('[data-rn]', r).value.trim(), nama: $('[data-ra2]', r).value.trim() })); },
    renderLibur(el) { $('#opLiburList', el).innerHTML = this.libur.map(d => '<span class="badge b-warn">' + tglLabel(d) + ' ' + d.slice(0, 4) + ' <button data-libdel="' + d + '" aria-label="Hapus" style="margin-left:4px">✕</button></span>').join('') || '<span class="xs muted">Tidak ada.</span>'; },
    calc(el) {
      const g = k => Number(($('[data-o="' + k + '"]', el) || {}).value || 0), f = km => Math.ceil((g('ongkir_dasar') + Math.max(0, km - g('ongkir_km_dasar')) * g('ongkir_per_km')) / 500) * 500;
      $('#opCalc', el).innerHTML = '<i class="ic fa-solid fa-calculator"></i><div class="t small">Contoh ongkir: 1 km → <b>' + rp(f(1)) + '</b> · 3 km → <b>' + rp(f(3)) + '</b> · 5 km → <b>' + rp(f(5)) + '</b> · 10 km → <b>' + rp(f(10)) + '</b></div>';
    },
    async save(el) {
      this.syncRek(el);
      const jad = {}; $$('[data-day]', el).forEach(r => { jad[r.dataset.day] = { libur: !$('[data-buka]', r).checked, buka: $('[data-jb]', r).value || '09:00', tutup: $('[data-jt]', r).value || '22:00' }; });
      const st = { jadwal_json: JSON.stringify(jad), rekening_json: JSON.stringify(this.rek.filter(r => r.nomor)), tanggal_libur: this.libur.join(',') };
      $$('[data-o]', el).forEach(i => st[i.dataset.o] = i.value.trim());
      $$('[data-ob]', el).forEach(i => st[i.dataset.ob] = i.checked ? 'YA' : 'TIDAK');
      $$('[data-om]', el).forEach(m => { const v = $$('input:checked', m).map(x => x.value).join(','); if (v) st[m.dataset.om] = v; });
      const q = $('[data-k="qris_image"]', el); if (q) st.qris_image = q.value.trim();
      const r = await call('opsSave', { settings: st });
      if (!res2toast(r)) return;
      ST.boot.ops = r.data.ops; ST.boot.toko = r.data.toko; if (r.data.settings) ST.boot.settings = r.data.settings; C.putCache(ukey('boot'), ST.boot);
      this.dirty = false; rerender();
    }
  };

  // ---------------- TAMPILAN (TEMA) ----------------
  const PALET = [
    { n: 'Emas Nabire', c: { color_primary: '#ffc107', color_primary_deep: '#f2aa02', color_dark: '#0f172a', color_dark2: '#131c31', color_text: '#2b3a67', color_accent: '#c5a059', color_bg: '#f8fafc' } },
    { n: 'Alam', c: { color_primary: '#86efac', color_primary_deep: '#22c55e', color_dark: '#14281d', color_dark2: '#1c3a29', color_text: '#24402f', color_accent: '#7c9a3d', color_bg: '#f6f8f3' } },
    { n: 'Terakota', c: { color_primary: '#fdba74', color_primary_deep: '#ea580c', color_dark: '#2a1611', color_dark2: '#3b1f17', color_text: '#4a2c21', color_accent: '#b45f3c', color_bg: '#fbf6f1' } },
    { n: 'Laut Papua', c: { color_primary: '#67e8f9', color_primary_deep: '#06b6d4', color_dark: '#082f49', color_dark2: '#0c4a6e', color_text: '#164e63', color_accent: '#0e7490', color_bg: '#f0f9ff' } },
    { n: 'Korporat', c: { color_primary: '#93c5fd', color_primary_deep: '#3b82f6', color_dark: '#111827', color_dark2: '#1f2937', color_text: '#1f2a44', color_accent: '#6b7280', color_bg: '#f9fafb' } },
    { n: 'Merah Cabai', c: { color_primary: '#fca5a5', color_primary_deep: '#dc2626', color_dark: '#1c1917', color_dark2: '#292524', color_text: '#3f2a2a', color_accent: '#b91c1c', color_bg: '#fffaf5' } }
  ];
  const FONTS_BODY = ['Outfit', 'Poppins', 'Inter', 'Roboto', 'Plus Jakarta Sans', 'Nunito', 'DM Sans', 'Montserrat', 'Lato'];
  const FONTS_DISP = ['Playfair Display', 'DM Serif Display', 'Lora', 'Cormorant Garamond', 'Fraunces', 'Merriweather', 'Outfit', 'Montserrat', 'Poppins'];
  const THEME_GROUPS = [
    { t: 'Merek & Logo', i: 'fa-solid fa-store', open: true, scroll: '#top', f: [['brand_name', 'Nama usaha'], ['brand_sub', 'Teks kecil di bawah nama'], ['logo_url', 'Logo (opsional, menggantikan ikon)', 'img'], ['brand_icon', 'Ikon logo (bila tanpa gambar)', 'icon'], ['meta_desc', 'Deskripsi untuk Google & WhatsApp', 'area']] },
    { t: 'Warna & Huruf', i: 'fa-solid fa-palette', scroll: '#menu', f: [['_palet', '', 'palet'], ['color_primary', 'Warna utama', 'color'], ['color_primary_deep', 'Warna utama gelap', 'color'], ['color_dark', 'Warna gelap (navbar/footer)', 'color'], ['color_dark2', 'Warna gelap kedua', 'color'], ['color_text', 'Warna teks', 'color'], ['color_accent', 'Warna aksen', 'color'], ['color_bg', 'Warna latar', 'color'], ['font_display', 'Huruf judul', 'fontd'], ['font_body', 'Huruf isi', 'fontb'], ['radius', 'Kelengkungan sudut kartu (0–40 px)', 'range']] },
    { t: 'Hero (layar pembuka)', i: 'fa-solid fa-image', scroll: '#top', f: [['hero_image', 'Foto latar', 'img'], ['hero_eyebrow', 'Teks kecil di atas judul'], ['hero_line1', 'Judul baris 1'], ['hero_line2', 'Judul baris 2 (miring berwarna)'], ['hero_line3', 'Judul baris 3'], ['hero_desc', 'Deskripsi', 'area'], ['hero_btn1', 'Tombol utama'], ['hero_btn2', 'Tombol kedua'], ['meta1_num', 'Angka 1'], ['meta1_lbl', 'Label 1'], ['meta2_num', 'Angka 2'], ['meta2_lbl', 'Label 2'], ['meta3_num', 'Angka 3'], ['meta3_lbl', 'Label 3']] },
    { t: 'Pita berjalan & Menu', i: 'fa-solid fa-bowl-food', scroll: '#menu', f: [['show_marquee', 'Tampilkan pita berjalan', 'toggle'], ['marquee_text', 'Isi pita (pisahkan dengan |)', 'area'], ['menu_eyebrow', 'Teks kecil'], ['menu_title', 'Judul bagian menu'], ['menu_desc', 'Deskripsi', 'area']] },
    { t: 'Filosofi', i: 'fa-solid fa-leaf', scroll: '#filosofi', f: [['show_filosofi', 'Tampilkan bagian ini', 'toggle'], ['filo_eyebrow', 'Teks kecil'], ['filo_title', 'Judul (pisah baris dengan |)'], ['filo1_title', 'Poin 1 — judul'], ['filo1_text', 'Poin 1 — isi', 'area'], ['filo2_title', 'Poin 2 — judul'], ['filo2_text', 'Poin 2 — isi', 'area'], ['filo3_title', 'Poin 3 — judul'], ['filo3_text', 'Poin 3 — isi', 'area']] },
    { t: 'Cerita & Tentang Kami', i: 'fa-solid fa-book-open', scroll: '#cerita', f: [['show_cerita', 'Tampilkan bagian cerita', 'toggle'], ['story_eyebrow', 'Teks kecil'], ['story_title', 'Judul'], ['story_desc', 'Isi', 'area'], ['story_img_a', 'Foto besar', 'img'], ['story_img_b', 'Foto kecil', 'img'], ['story_badge_num', 'Lencana angka'], ['story_badge_lbl', 'Lencana label'], ['stat1_num', 'Statistik 1'], ['stat1_lbl', 'Label 1'], ['stat2_num', 'Statistik 2'], ['stat2_lbl', 'Label 2'], ['stat3_num', 'Statistik 3'], ['stat3_lbl', 'Label 3'], ['about_title', 'Judul jendela Tentang'], ['about_img', 'Foto jendela Tentang', 'img'], ['about_desc', 'Isi Tentang', 'area'], ['about_points', 'Poin keunggulan (pisahkan |)']] },
    { t: 'Kontak & Footer', i: 'fa-solid fa-location-dot', scroll: 'footer', f: [['wa_number', 'Nomor WhatsApp penerima pesanan'], ['address', 'Alamat'], ['hours', 'Jam buka'], ['email', 'Email'], ['instagram', 'URL Instagram'], ['facebook', 'URL Facebook'], ['tiktok', 'URL TikTok'], ['footer_text', 'Teks footer']] }
  ];
  PAGES.tampilan = {
    mount(el) {
      const s = Object.assign({}, window.DEMO_DATA.settings, (ST.boot && ST.boot.settings) || {});
      this.draft = s; this.dirty = false;
      const field = (f) => {
        const [k, label, type, opts] = f, v = s[k] == null ? '' : String(s[k]);
        if (type === 'palet') return '<div class="palettes">' + PALET.map((p, i) => '<button class="pal" data-pal="' + i + '"><div class="sw">' + ['color_dark', 'color_primary', 'color_primary_deep', 'color_accent', 'color_bg'].map(x => '<span style="background:' + p.c[x] + '"></span>').join('') + '</div>' + p.n + '</button>').join('') + '</div>';
        if (type === 'img') return imgField(k, label, v, true);
        if (type === 'color') return '<div class="field"><label>' + label + '</label><div class="color-row"><input type="color" data-color="' + k + '" value="' + esc(v) + '" aria-label="' + label + '" /><input class="input mono" data-k="' + k + '" value="' + esc(v) + '" maxlength="9" /></div></div>';
        if (type === 'area') return '<div class="field"><label>' + label + '</label><textarea class="input" data-k="' + k + '" rows="3">' + esc(v) + '</textarea></div>';
        if (type === 'toggle') return '<div class="field"><label class="switch"><input type="checkbox" data-k="' + k + '" data-bool' + (v !== 'TIDAK' ? ' checked' : '') + ' /><span class="tr"></span>' + label + '</label></div>';
        if (type === 'range') return '<div class="field"><label>' + label + ': <b data-rv>' + esc(v) + '</b> px</label><input type="range" min="0" max="40" data-k="' + k + '" value="' + esc(v) + '" style="width:100%" /></div>';
        if (type === 'fontd' || type === 'fontb') return '<div class="field"><label>' + label + '</label><select class="input" data-k="' + k + '">' + (type === 'fontd' ? FONTS_DISP : FONTS_BODY).map(x => '<option' + (x === v ? ' selected' : '') + ' style="font-family:\'' + x + '\'">' + x + '</option>').join('') + '</select></div>';
        if (type === 'icon') return '<div class="field"><label>' + label + '</label><div class="chips" style="flex-wrap:wrap">' + ICONS.map(i => '<button class="chip' + (i === v ? ' active' : '') + '" data-icon="' + i + '" aria-label="' + i + '"><i class="' + i + '"></i></button>').join('') + '</div><input type="hidden" data-k="' + k + '" value="' + esc(v) + '" /></div>';
        if (type === 'multi') { const on = v.split(','); return '<div class="field"><label>' + label + '</label><div class="row" data-multi="' + k + '">' + Object.keys(opts).map(o => '<label class="switch"><input type="checkbox" value="' + o + '"' + (on.indexOf(o) > -1 ? ' checked' : '') + ' /><span class="tr"></span>' + opts[o] + '</label>').join('') + '</div></div>'; }
        if (type === 'num') return '<div class="field"><label>' + label + '</label><input class="input mono" type="number" min="0" data-k="' + k + '" value="' + esc(v) + '" /></div>';
        return '<div class="field"><label>' + label + '</label><input class="input" data-k="' + k + '" value="' + esc(v) + '" /></div>';
      };
      el.innerHTML = '<div class="theme-wrap"><div id="thForm"><div class="todo"><i class="ic fa-solid fa-store"></i><div class="t small">Jam buka, pembayaran, ongkir & reservasi diatur di menu <b>Jam & Operasional</b>.</div><button class="btn btn-ghost btn-sm" data-go="operasional">Buka</button></div>' +
        THEME_GROUPS.map(g => '<details class="acc"' + (g.open ? ' open' : '') + ' data-scroll="' + g.scroll + '"><summary><i class="lead ' + g.i + '"></i>' + g.t + '</summary><div class="acc-b">' + g.f.map(field).join('') + '</div></details>').join('') +
        '<div class="savebar"><span class="grow" id="thState">Semua perubahan langsung terlihat di pratinjau.</span><button class="btn btn-ghost btn-sm" id="thPrevM" style="background:rgba(255,255,255,.1);color:#fff;border:none"><i class="fa-solid fa-eye"></i> Pratinjau</button><button class="btn btn-primary" id="thSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div></div>' +
        '<div class="preview-box hide-m" id="pvBox"><div class="preview-bar"><span class="dots"><i></i><i></i><i></i></span><span style="flex:1">Pratinjau langsung</span><button class="btn btn-ghost btn-sm" id="pvDev"><i class="fa-solid fa-mobile-screen"></i> HP</button><button class="btn btn-dark btn-sm" id="pvClose" style="display:none"><i class="fa-solid fa-xmark"></i> Tutup</button></div><iframe class="preview-frame" id="pvFrame" title="Pratinjau web" loading="lazy"></iframe></div></div>';
      const frame = $('#pvFrame', el), send = debounce((scroll) => { try { frame.contentWindow.postMessage({ type: 'nr-preview', settings: this.draft, scrollTo: scroll }, location.origin); } catch (e) { } }, 120);
      this.send = send;
      window.addEventListener('message', e => { if (e.data && e.data.type === 'nr-preview-ready') send(); });
      const setVal = (k, v) => { this.draft[k] = v; this.dirty = true; $('#thState', el).textContent = 'Ada perubahan belum disimpan.'; send(); };
      bindUploads(el, (k, v) => setVal(k, v));
      el.addEventListener('input', e => {
        const t = e.target;
        if (t.dataset.color) { const x = $('[data-k="' + t.dataset.color + '"]', el); x.value = t.value; return setVal(t.dataset.color, t.value); }
        if (t.dataset.k && !t.dataset.bool && t.type !== 'checkbox') { if (/^color_/.test(t.dataset.k) && /^#[0-9a-f]{6}$/i.test(t.value)) $('[data-color="' + t.dataset.k + '"]', el).value = t.value; if (t.type === 'range') t.closest('.field').querySelector('[data-rv]').textContent = t.value; setVal(t.dataset.k, t.value); }
      });
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.bool !== undefined) return setVal(t.dataset.k, t.checked ? 'YA' : 'TIDAK');
        const m = t.closest('[data-multi]'); if (m) { const v = $$('input:checked', m).map(x => x.value).join(','); if (!v) { t.checked = true; return toast('Minimal satu pilihan aktif.', 'err'); } return setVal(m.dataset.multi, v); }
        if (t.tagName === 'SELECT') setVal(t.dataset.k, t.value);
      });
      el.addEventListener('click', e => {
        const p = e.target.closest('[data-pal]'); if (p) { e.preventDefault(); const c = PALET[+p.dataset.pal].c; Object.keys(c).forEach(k => { $('[data-k="' + k + '"]', el).value = c[k]; $('[data-color="' + k + '"]', el).value = c[k]; this.draft[k] = c[k]; }); $$('[data-pal]', el).forEach(x => x.classList.toggle('active', x === p)); setVal('color_primary', c.color_primary); return; }
        const ic = e.target.closest('[data-icon]'); if (ic) { e.preventDefault(); $$('[data-icon]', el).forEach(x => x.classList.toggle('active', x === ic)); $('[data-k="brand_icon"]', el).value = ic.dataset.icon; setVal('brand_icon', ic.dataset.icon); }
      });
      $$('details.acc', el).forEach(d => d.addEventListener('toggle', () => { if (d.open) send(d.dataset.scroll); }));
      $('#pvDev', el).onclick = () => { frame.classList.toggle('mobile'); $('#pvDev', el).innerHTML = frame.classList.contains('mobile') ? '<i class="fa-solid fa-desktop"></i> Desktop' : '<i class="fa-solid fa-mobile-screen"></i> HP'; };
      $('#thPrevM', el).onclick = () => { $('#pvBox', el).classList.remove('hide-m'); $('#pvClose', el).style.display = ''; if (!frame.src) frame.src = 'index.html?preview=1'; };
      $('#pvClose', el).onclick = () => $('#pvBox', el).classList.add('hide-m');
      if (innerWidth >= 1100) frame.src = 'index.html?preview=1';
      $('#thSave', el).onclick = e => busy(e.currentTarget, async () => {
        const changed = {}, base = (ST.boot && ST.boot.settings) || {};
        Object.keys(this.draft).forEach(k => { if (String(this.draft[k]) !== String(base[k] == null ? '' : base[k])) changed[k] = this.draft[k]; });
        if (!Object.keys(changed).length) return toast('Tidak ada perubahan.');
        const r = await call('settingsSave', { settings: changed });
        if (res2toast(r)) { ST.boot.settings = r.data; this.draft = Object.assign({}, r.data); this.dirty = false; C.putCache(ukey('boot'), ST.boot); applyBrand(); $('#thState', el).textContent = 'Tersimpan. Pengunjung melihat versi baru dalam ±30 detik.'; }
      });
    },
    show(el) { if (this.send) this.send(); }
  };

  // ---------------- PELANGGAN (CRM) ----------------
  PAGES.pelanggan = {
    mount(el) {
      el.innerHTML = '<div class="grid g4" id="crmKpi" style="margin-bottom:14px"></div>' +
        '<div class="row" style="margin-bottom:10px"><div class="grow"><input class="input" id="crmQ" placeholder="Cari nama, email, nomor, tag…" /></div>' +
        '<select class="input" id="crmWA" style="max-width:180px"><option value="">Semua status WA</option><option value="Terdaftar">✓ Terdaftar WA</option><option value="Tidak Terdaftar">✕ Bukan WA</option><option value="belum">? Belum dicek</option></select>' +
        '<button class="btn btn-ghost" id="crmSync"><i class="fa-solid fa-rotate"></i> Sinkron</button><label class="btn btn-ghost"><i class="fa-solid fa-file-import"></i> Import CSV<input type="file" accept=".csv,text/csv" id="crmCsv" hidden /></label>' +
        '<button class="btn btn-ghost" id="crmTpl"><i class="fa-solid fa-download"></i> Template</button>' + (can('superadmin') ? '<button class="btn btn-ghost" id="crmExp"><i class="fa-solid fa-file-export"></i> Ekspor</button>' : '') + '</div>' +
        '<div class="chips" id="crmSeg" style="margin-bottom:12px"></div><div id="crmBulk"></div><div id="crmList"></div><div class="row" id="crmPager" style="justify-content:center;margin-top:12px"></div><p class="xs muted" id="crmSyncInfo" style="text-align:center;margin-top:8px"></p>';
      const F = ST.crm.f;
      $('#crmQ', el).addEventListener('input', debounce(e => { F.cari = e.target.value; F.halaman = 1; this.load(el); }, 350));
      $('#crmWA', el).onchange = e => { F.statusWA = e.target.value; F.halaman = 1; this.load(el); };
      $('#crmSync', el).onclick = e => busy(e.currentTarget, async () => { const r = await call('crm.sync'); res2toast(r); this.load(el, true); this.loadStats(el, true); });
      $('#crmTpl', el).onclick = () => download('template-kontak.csv', '﻿nama,email,wa,segmen,tag\nBudi Santoso,budi@email.com,081234567890,Calon Katering,VIP\n');
      $('#crmCsv', el).onchange = async e => { const f = e.target.files[0]; if (!f) return; const rows = parseCsv(await f.text()); e.target.value = '';
        if (!rows.length) return toast('CSV kosong / format salah. Pakai template.', 'err');
        if (!(await confirmBox('Import ' + rows.length + ' kontak?', 'Nomor yang sudah ada akan diperbarui, bukan diduplikasi.', 'Import'))) return;
        const r = await call('crm.import', { rows }); res2toast(r); this.load(el, true); this.loadStats(el, true); };
      const exp = $('#crmExp', el); if (exp) exp.onclick = e => busy(e.currentTarget, async () => { const r = await call('crm.export', F); if (!r.success) return toast(r.message, 'err');
        download('kontak-' + new Date().toISOString().slice(0, 10) + '.csv', toCsv(r.data.map(k => Object.assign({}, k, { OptOut: k.OptOut ? 'YA' : 'TIDAK' })), ['Nama', 'Email', 'NoWA', 'Segmen', 'Tag', 'StatusWA', 'OptOut', 'JumlahPesan', 'TerakhirDihubungi', 'Catatan'])); });
      el.addEventListener('click', e => {
        const k = e.target.closest('[data-kpi]'); if (k) { Object.assign(F, { statusWA: '', optOut: '', duplikat: '', masalah: '', emailValid: '' }, JSON.parse(k.dataset.kpi)); F.halaman = 1; $('#crmWA', el).value = F.statusWA || ''; this.load(el); return; }
        const sg = e.target.closest('[data-seg]'); if (sg) { F.segmen = sg.dataset.seg; F.halaman = 1; this.load(el); return; }
        const pg = e.target.closest('[data-pg]'); if (pg) { F.halaman = +pg.dataset.pg; this.load(el); return; }
        const row = e.target.closest('[data-kontak]'); if (row && !e.target.closest('input,a,button')) { kontakDetail(row.dataset.kontak, () => { this.load(el, true); this.loadStats(el, true); }); return; }
        const b = e.target.closest('[data-bulk]'); if (b) this.bulk(el, b.dataset.bulk);
      });
      el.addEventListener('change', e => {
        if (e.target.matches('[data-pick]')) { ST.crm.sel[e.target.dataset.pick] = e.target.checked; if (!e.target.checked) delete ST.crm.sel[e.target.dataset.pick]; this.renderBulk(el); }
        if (e.target.id === 'crmAll') { $$('[data-pick]', el).forEach(c => { c.checked = e.target.checked; if (c.checked) ST.crm.sel[c.dataset.pick] = 1; else delete ST.crm.sel[c.dataset.pick]; }); this.renderBulk(el); }
      });
    },
    show(el) { this.loadStats(el); this.load(el); },
    loadStats(el, force) {
      swr('p:crm.stats', 'crm.stats', {}, s => {
        const k = (lbl, num, ic, f, sub) => '<div class="kpi click" data-kpi=\'' + JSON.stringify(f) + '\'><div class="k-lbl"><i class="' + ic + '"></i>' + lbl + '</div><div class="k-num mono">' + num + '</div>' + (sub ? '<div class="k-sub">' + sub + '</div>' : '') + '</div>';
        $('#crmKpi', el).innerHTML = k('Total kontak', s.total, 'fa-solid fa-address-book', {}, s.baru7 + ' baru 7 hari') + k('WA terverifikasi', s.waTerdaftar, 'fa-brands fa-whatsapp', { statusWA: 'Terdaftar' }, s.belumCek + ' belum dicek') +
          k('Opt-out', s.optOut, 'fa-solid fa-ban', { optOut: 'YA' }, 'tidak ikut blast') + k('Perlu dirapikan', s.duplikat + s.tidakBisa, 'fa-solid fa-triangle-exclamation', { masalah: 1 }, s.duplikat + ' duplikat · ' + s.tidakBisa + ' tanpa kontak');
      }, { fresh: 60000, force });
    },
    load(el, force) {
      const F = ST.crm.f;
      if (!$('#crmList', el).innerHTML) $('#crmList', el).innerHTML = '<div class="sk" style="height:300px"></div>';
      return swr('crm:' + JSON.stringify(F), 'crm.list', F, d => this.render(el, d), { fresh: 30000, force, onError: r => { $('#crmList', el).innerHTML = '<div class="empty"><i class="fa-solid fa-plug-circle-xmark"></i>' + esc(r.message) + '<br><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="location.reload()">Coba lagi</button></div>'; } });
    },
    render(el, d) {
      const F = ST.crm.f; this.rows = d.rows;
      $('#crmSeg', el).innerHTML = '<button class="chip' + (!F.segmen ? ' active' : '') + '" data-seg="">Semua</button>' + Object.keys(d.facet.segmen).map(s => '<button class="chip' + (F.segmen === s ? ' active' : '') + '" data-seg="' + esc(s) + '">' + esc(s) + ' <span class="n">' + d.facet.segmen[s] + '</span></button>').join('');
      const wab = s => s === 'Terdaftar' ? '<span class="wa-badge ya">✓ WA</span>' : s === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">✕ bukan WA</span>' : '<span class="wa-badge belum">? belum dicek</span>';
      $('#crmList', el).innerHTML = d.rows.length ? '<div class="tbl-wrap stack"><table class="tbl"><thead><tr><th style="width:36px"><input type="checkbox" id="crmAll" aria-label="Pilih semua" /></th><th>Nama</th><th>WhatsApp</th><th>Email</th><th>Tag</th><th>Terakhir dihubungi</th><th>Pesan</th></tr></thead><tbody>' +
        d.rows.map(k => '<tr class="click' + (!k.NoWA || k.duplikat || k.EmailValid === 'TIDAK' ? ' warn' : '') + '" data-kontak="' + esc(k.KontakID) + '"><td data-label="Pilih"><input type="checkbox" data-pick="' + esc(k.KontakID) + '"' + (ST.crm.sel[k.KontakID] ? ' checked' : '') + ' aria-label="Pilih" /></td>' +
          '<td data-label="Nama"><b>' + esc(k.Nama || '-') + '</b> <span class="badge b-mute">' + esc(k.Segmen) + '</span>' + (k.OptOut ? ' <span class="badge b-err">opt-out</span>' : '') + (k.duplikat ? ' <span class="badge b-warn">duplikat</span>' : '') + '</td>' +
          '<td data-label="WhatsApp">' + (k.NoWA ? '<span class="mono">' + esc(k.NoWA) + '</span> ' + wab(k.StatusWA) + ' <a href="https://wa.me/' + wa62(k.NoWA) + '" target="_blank" rel="noopener" aria-label="Chat" style="color:var(--ok)"><i class="fa-brands fa-whatsapp"></i></a>' : '<span class="muted">-</span>') + '</td>' +
          '<td data-label="Email">' + (k.Email ? esc(k.Email) + (k.EmailValid === 'TIDAK' ? ' ⚠' : '') : '<span class="muted">-</span>') + '</td><td data-label="Tag">' + String(k.Tag || '').split(',').filter(Boolean).map(t => '<span class="tag">' + esc(t) + '</span>').join('') + '</td>' +
          '<td data-label="Dihubungi">' + (k.TerakhirDihubungi ? ago(k.TerakhirDihubungi) : '<span class="muted">belum</span>') + '</td><td data-label="Pesan" class="mono">' + k.JumlahPesan + '</td></tr>').join('') + '</tbody></table></div>'
        : '<div class="empty"><i class="fa-solid fa-address-book"></i>Tidak ada kontak cocok. Klik <b>Sinkron</b> untuk menarik data pelanggan terbaru.</div>';
      const pages = Math.ceil(d.total / d.per);
      $('#crmPager', el).innerHTML = pages > 1 ? '<button class="btn btn-ghost btn-sm" data-pg="' + Math.max(1, d.halaman - 1) + '"' + (d.halaman === 1 ? ' disabled' : '') + '>‹ Sebelumnya</button><span class="small muted">Halaman ' + d.halaman + ' / ' + pages + ' · ' + d.total + ' kontak</span><button class="btn btn-ghost btn-sm" data-pg="' + Math.min(pages, d.halaman + 1) + '"' + (d.halaman === pages ? ' disabled' : '') + '>Berikutnya ›</button>' : '<span class="small muted">' + d.total + ' kontak</span>';
      $('#crmSyncInfo', el).textContent = d.sinkron ? 'Sinkron terakhir ' + ago(new Date(d.sinkron).toISOString()) : '';
      this.renderBulk(el);
    },
    renderBulk(el) {
      const n = Object.keys(ST.crm.sel).length;
      $('#crmBulk', el).innerHTML = n ? '<div class="bulkbar"><b>' + n + ' dipilih</b><button class="btn btn-ghost btn-sm" data-bulk="deteksiWA"><i class="fa-brands fa-whatsapp"></i> Deteksi WA</button><button class="btn btn-ghost btn-sm" data-bulk="tag"><i class="fa-solid fa-tag"></i> Beri tag</button><button class="btn btn-ghost btn-sm" data-bulk="blast"><i class="fa-solid fa-bullhorn"></i> Blast</button><button class="btn btn-ghost btn-sm" data-bulk="optout"><i class="fa-solid fa-ban"></i> Opt-out</button><button class="btn btn-ghost btn-sm" data-bulk="optin">Opt-in</button><button class="btn btn-ghost btn-sm" data-bulk="clear">Batal pilih</button></div>' : '';
    },
    async bulk(el, aksi) {
      const ids = Object.keys(ST.crm.sel);
      if (aksi === 'clear') { ST.crm.sel = {}; $$('[data-pick]', el).forEach(c => c.checked = false); return this.renderBulk(el); }
      if (aksi === 'blast') { ST.wa.preIds = ids; ST.wa.tab = 'blast'; location.hash = '#/whatsapp'; return; }
      let nilai = '';
      if (aksi === 'tag') { nilai = await askText('Beri tag', 'Nama tag (cth: VIP, Katering):', ''); if (!nilai) return; }
      const r = await call('crm.bulk', { ids, aksi, nilai }); res2toast(r);
      if (r.success) { ST.crm.sel = {}; this.load(el, true); this.loadStats(el, true); }
    }
  };
  async function kontakDetail(id, onSaved) {
    const ov = drawer('Kontak', '<div class="sk" style="height:220px"></div>');
    const r = await call('crm.detail', { kontakId: id }); if (!r.success) { closeLayer(); return toast(r.message, 'err'); }
    const k = r.data.kontak;
    $('.dr-h h3', ov).textContent = k.Nama || 'Kontak';
    $('.dr-b', ov).innerHTML =
      '<div class="row" style="margin-bottom:14px">' + (k.NoWA ? '<a class="btn btn-ok btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + wa62(k.NoWA) + '"><i class="fa-brands fa-whatsapp"></i> Chat</a>' : '') + (k.Email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(k.Email) + '"><i class="fa-solid fa-envelope"></i> Email</a>' : '') + (k.NoWA ? '<button class="btn btn-ghost btn-sm" id="kdCopy"><i class="fa-regular fa-copy"></i> Salin nomor</button>' : '') + '<span class="badge b-mute">' + esc(k.Segmen) + ' · ' + esc(k.Sumber) + '</span></div>' +
      '<div class="field"><label>Nama</label><input class="input" id="kdNama" value="' + esc(k.Nama) + '" /></div><div class="split2"><div class="field"><label>WhatsApp</label><input class="input mono" id="kdWA" value="' + esc(k.NoWA) + '" /></div><div class="field"><label>Email</label><input class="input" id="kdEmail" value="' + esc(k.Email) + '" /></div></div>' +
      '<div class="field"><label>Tag <span class="opt">(pisahkan koma)</span></label><input class="input" id="kdTag" value="' + esc(k.Tag) + '" /></div><div class="field"><label>Catatan</label><textarea class="input" id="kdCat" rows="2">' + esc(k.Catatan) + '</textarea></div>' +
      '<label class="switch" style="margin-bottom:16px"><input type="checkbox" id="kdOpt"' + (k.OptOut ? ' checked' : '') + ' /><span class="tr"></span>Opt-out (tidak menerima blast promosi)</label>' +
      (r.data.pesanan.length ? '<h4 style="margin:10px 0 8px;color:var(--dark)">Riwayat pesanan</h4>' + r.data.pesanan.map(o => '<div class="sumrow"><span>#' + esc(o.id) + ' · ' + fmtTgl(o.waktu, false) + ' <span class="badge b-' + o.status + '">' + o.status + '</span></span><span class="mono">' + rp(o.total) + '</span></div>').join('') : '') +
      '<h4 style="margin:16px 0 8px;color:var(--dark)">Catat interaksi</h4><div class="row"><select class="input" id="kdKanal" style="max-width:150px"><option>Telepon</option><option>WA Manual</option><option>Kunjungan</option><option>Catatan</option></select><input class="input grow" id="kdRing" placeholder="Ringkasan singkat…" /><button class="btn btn-dark" id="kdAddInt">Catat</button></div>' +
      '<h4 style="margin:18px 0 10px;color:var(--dark)">Linimasa</h4><div class="timeline">' + (r.data.timeline.length ? r.data.timeline.map(t => '<div class="tl"><div class="when">' + fmtTgl(t.tanggal) + ' · ' + esc(t.kanal) + (t.status ? ' · ' + esc(t.status) : '') + '</div>' + esc(t.ringkasan) + '</div>').join('') : '<div class="tl muted">Belum ada interaksi.</div>') + '</div>';
    $('.drawer', ov).insertAdjacentHTML('beforeend', '<div class="dr-f"><button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-primary" style="flex:1" id="kdSave">Simpan kontak</button></div>');
    const cp = $('#kdCopy', ov); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(k.NoWA); toast('Nomor disalin', 'ok'); };
    $('#kdAddInt', ov).onclick = e => busy(e.currentTarget, async () => { const x = await call('crm.interaksi', { kontakId: id, kanal: $('#kdKanal', ov).value, ringkasan: $('#kdRing', ov).value }); if (res2toast(x)) kontakDetail(id, onSaved); });
    $('#kdSave', ov).onclick = e => busy(e.currentTarget, async () => {
      const x = await call('crm.save', { kontak: { KontakID: id, Nama: $('#kdNama', ov).value, NoWA: $('#kdWA', ov).value, Email: $('#kdEmail', ov).value, Tag: $('#kdTag', ov).value, Catatan: $('#kdCat', ov).value, OptOut: $('#kdOpt', ov).checked } });
      if (res2toast(x)) { closeLayer(); onSaved && onSaved(); }
    });
  }

  // ---------------- WHATSAPP (blast, antrean, konfigurasi) ----------------
  PAGES.whatsapp = {
    mount(el) {
      el.innerHTML = '<div class="tabs"><button data-wt="blast"><i class="fa-solid fa-bullhorn"></i> Blast WhatsApp</button><button data-wt="antrean"><i class="fa-solid fa-inbox"></i> Antrean & Riwayat</button>' + (can('superadmin') ? '<button data-wt="konfig"><i class="fa-solid fa-sliders"></i> Konfigurasi</button>' : '') + '</div><div id="waBody"></div>';
      el.addEventListener('click', e => { const t = e.target.closest('[data-wt]'); if (t) { ST.wa.tab = t.dataset.wt; this.show(el); } });
    },
    show(el) { $$('[data-wt]', el).forEach(b => b.classList.toggle('active', b.dataset.wt === ST.wa.tab)); const b = $('#waBody', el); ({ blast: waBlast, antrean: waQueue, konfig: waConfig })[ST.wa.tab](b); }
  };
  function waBlast(box) {
    const B = ST.wa.b || (ST.wa.b = { rows: [], ringkas: null, pesan: 'Halo {nama} 👋\nAda menu spesial minggu ini di {institusi}! Pesan sekarang: {link}', ukuran: 20, jeda: '5', hanyaWA: false, sel: {}, sumber: 'crm' });
    box.innerHTML = '<div class="grid g2"><div class="card"><div class="card-h"><h3><i class="fa-solid fa-users"></i>1. Pilih sasaran</h3></div>' +
      '<div class="split2"><div class="field"><label>Sumber</label><select class="input" id="bSrc"><option value="crm">Kontak CRM</option><option value="manual">Tempel manual</option></select></div><div class="field" id="bSegBox"><label>Segmen</label><select class="input" id="bSeg"><option value="">Semua</option><option>Pelanggan</option><option>Staf</option><option>Manual</option></select></div></div>' +
      '<div class="field" id="bManBox" hidden><label>Nomor | Nama (satu per baris)</label><textarea class="input mono" id="bMan" rows="4" placeholder="081234567890|Budi&#10;081298765432|Sari"></textarea></div>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn btn-dark" id="bLoad"><i class="fa-solid fa-users"></i> Muat penerima</button><button class="btn btn-ghost" id="bCheck"><i class="fa-brands fa-whatsapp"></i> Deteksi nomor WA</button></div>' +
      '<div id="bSum"></div><label class="switch" style="margin:8px 0 10px"><input type="checkbox" id="bOnlyWA"' + (B.hanyaWA ? ' checked' : '') + ' /><span class="tr"></span>Kirim hanya ke nomor terdeteksi WhatsApp</label><div id="bRows" style="max-height:340px;overflow:auto"></div></div>' +
      '<div><div class="card"><div class="card-h"><h3><i class="fa-solid fa-pen-to-square"></i>2. Tulis pesan</h3></div><div class="field"><label>Judul internal</label><input class="input" id="bJudul" placeholder="cth: Promo Jumat Berkah" /></div>' +
      '<div class="row" style="margin-bottom:6px">' + ['{nama}', '{institusi}', '{link}'].map(v => '<button class="btn btn-ghost btn-sm" data-var="' + v + '">' + v + '</button>').join('') + '</div>' +
      '<div class="field"><textarea class="input" id="bPesan" rows="6">' + esc(B.pesan) + '</textarea><p class="hint">*tebal* · _miring_ · tambahkan "Balas STOP untuk berhenti." agar sopan.</p></div><div class="wa-preview"><div class="wa-bubble" id="bPrev"></div></div></div>' +
      '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-gauge"></i>3. Ukuran batch & jeda</h3></div><div class="row"><div class="seg" id="bSize">' + [10, 20, 50].map(n => '<button data-size="' + n + '"' + (B.ukuran === n ? ' class="active"' : '') + '>' + n + '</button>').join('') + '</div><div class="field" style="margin:0;max-width:140px"><input class="input mono" id="bJeda" value="' + esc(B.jeda) + '" aria-label="Jeda detik" /></div><span class="xs muted">jeda detik (boleh "3-8")</span></div>' +
      '<p class="small" id="bEst" style="margin:12px 0"></p><button class="btn btn-primary btn-block" id="bGo"><i class="fa-solid fa-rocket"></i> Mulai Blast</button><p class="hint">Server mengirim 1 batch per menit walau halaman ditutup. Tips anti-blokir: mulai batch 10, jeda acak ≥5 detik.</p></div></div></div>' +
      '<div class="card" id="bActive" style="margin-top:16px" hidden></div><div class="card" style="margin-top:16px"><div class="card-h"><h3><i class="fa-solid fa-clock-rotate-left"></i>Riwayat blast</h3><button class="btn btn-ghost btn-sm" id="bHistR"><i class="fa-solid fa-rotate"></i></button></div><div id="bHist"></div></div>';
    const set = k => $(k, box);
    const est = () => { const n = sendList().length, b = B.ukuran, j = String(B.jeda).split('-').map(Number), avg = j.length > 1 ? (j[0] + j[1]) / 2 : j[0] || 5;
      set('#bEst').innerHTML = '<b>' + n + ' penerima</b> → ' + Math.ceil(n / b) + ' batch · perkiraan ±' + Math.max(1, Math.ceil(Math.max(n * avg, Math.ceil(n / b) * 60) / 60)) + ' menit'; set('#bGo').innerHTML = '<i class="fa-solid fa-rocket"></i> Mulai Blast (' + n + ' nomor)'; };
    const sendList = () => B.rows.filter(r => r.valid && !r.ganda && !r.optOut && B.sel[r.hp] !== false && (!B.hanyaWA || r.statusWA === 'Terdaftar'));
    const prev = () => { const r = sendList()[0] || { nama: 'Budi' }, s = ST.boot.settings || {}; set('#bPrev').innerHTML = esc(set('#bPesan').value.replace(/\{nama\}/g, r.nama || 'Kak').replace(/\{institusi\}/g, s.brand_name || '').replace(/\{link\}/g, s.APP_URL || location.origin)).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>'); };
    const renderRows = () => {
      const R = B.ringkas;
      set('#bSum').innerHTML = R ? '<div class="row" style="margin-bottom:6px">' + [['Total', R.total, 'b-mute'], ['Valid', R.valid, 'b-ok'], ['Tidak valid', R.tidakValid, 'b-err'], ['Ganda', R.ganda, 'b-warn'], ['Opt-out', R.optOut, 'b-mute'], ['✓ WA', R.terdaftarWA, 'b-ok']].map(x => '<span class="badge ' + x[2] + '">' + x[0] + ': ' + x[1] + '</span>').join('') + '</div>' : '<p class="small muted">Klik <b>Muat penerima</b>.</p>';
      set('#bRows').innerHTML = B.rows.length ? '<table class="tbl"><tbody>' + B.rows.map(r => '<tr style="' + (!r.valid || r.ganda || r.optOut ? 'opacity:.45' : '') + '"><td style="width:30px"><input type="checkbox" data-hp="' + esc(r.hp) + '"' + (r.valid && !r.ganda && !r.optOut && B.sel[r.hp] !== false ? ' checked' : '') + (r.valid && !r.ganda && !r.optOut ? '' : ' disabled') + ' aria-label="Pilih" /></td><td>' + esc(r.nama || '-') + '</td><td class="mono">' + esc(r.hp) + '</td><td>' + (r.statusWA === 'Terdaftar' ? '<span class="wa-badge ya">✓ WA</span>' : r.statusWA === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">✕</span>' : '<span class="wa-badge belum">?</span>') + (r.optOut ? ' <span class="badge b-err">opt-out</span>' : '') + (r.ganda ? ' <span class="badge b-warn">ganda</span>' : '') + '</td></tr>').join('') + '</tbody></table>' : '';
      est(); prev();
    };
    const load = async (btn) => busy(btn, async () => {
      const q = { sumber: B.sumber, segmen: set('#bSeg').value, manual: set('#bMan').value }; if (ST.wa.preIds) { q.ids = ST.wa.preIds; ST.wa.preIds = null; }
      const r = await call('wa.audience', q); if (!r.success) return toast(r.message, 'err'); B.rows = r.data.rows; B.ringkas = r.data.ringkas; B.sel = {}; renderRows();
    });
    set('#bSrc').value = B.sumber; set('#bManBox').hidden = B.sumber !== 'manual'; set('#bSegBox').hidden = B.sumber === 'manual';
    set('#bSrc').onchange = e => { B.sumber = e.target.value; set('#bManBox').hidden = B.sumber !== 'manual'; set('#bSegBox').hidden = B.sumber === 'manual'; };
    set('#bLoad').onclick = e => load(e.currentTarget);
    set('#bCheck').onclick = e => busy(e.currentTarget, async () => {
      const nomor = B.rows.filter(r => r.valid && !r.statusWA).map(r => r.hp); if (!nomor.length) return toast(B.rows.length ? 'Semua nomor sudah dicek.' : 'Muat penerima dulu.');
      for (let i = 0; i < nomor.length; i += 50) { e.currentTarget.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Mengecek ' + Math.min(i + 50, nomor.length) + '/' + nomor.length;
        const r = await call('wa.validate', { nomor: nomor.slice(i, i + 50) }); if (!r.success) { toast(r.message, 'err'); break; }
        B.rows.forEach(x => { if (r.data.hasil[x.hp]) x.statusWA = r.data.hasil[x.hp]; }); }
      B.ringkas.terdaftarWA = B.rows.filter(x => x.statusWA === 'Terdaftar').length; renderRows();
    });
    set('#bOnlyWA').onchange = e => { B.hanyaWA = e.target.checked; est(); prev(); };
    set('#bRows').onchange = e => { const c = e.target.closest('[data-hp]'); if (c) { B.sel[c.dataset.hp] = c.checked; est(); } };
    set('#bPesan').oninput = () => { B.pesan = set('#bPesan').value; prev(); };
    box.addEventListener('click', e => { const v = e.target.closest('[data-var]'); if (v) { const t = set('#bPesan'), p = t.selectionStart || t.value.length; t.value = t.value.slice(0, p) + v.dataset.var + t.value.slice(p); B.pesan = t.value; t.focus(); prev(); }
      const s = e.target.closest('[data-size]'); if (s) { B.ukuran = +s.dataset.size; $$('[data-size]', box).forEach(x => x.classList.toggle('active', x === s)); est(); } });
    set('#bJeda').oninput = e => { B.jeda = e.target.value.trim(); est(); };
    set('#bGo').onclick = e => busy(e.currentTarget, async () => {
      const L = sendList(); if (!L.length) return toast('Belum ada penerima valid. Klik Muat penerima.', 'err'); if (!B.pesan.trim()) return toast('Tulis pesan dulu.', 'err');
      if (!(await confirmBox('Mulai blast ke ' + L.length + ' nomor?', 'Dikirim bertahap ' + B.ukuran + ' nomor per batch. Bisa dihentikan kapan saja.', 'Mulai blast'))) return;
      const r = await call('wa.blastCreate', { judul: set('#bJudul').value, pesan: B.pesan, ukuranBatch: B.ukuran, jeda: B.jeda, sasaran: B.sumber === 'crm' ? (set('#bSeg').value || 'Semua kontak') : 'Manual', penerima: L.map(x => ({ hp: x.hp, nama: x.nama })) });
      if (res2toast(r)) { ST.wa.active = r.data.blastId; loadHist(true); }
    });
    const loadHist = (force) => swr('p:wa.blastList', 'wa.blastList', {}, list => {
      set('#bHist').innerHTML = list.length ? '<div class="tbl-wrap stack"><table class="tbl"><thead><tr><th>Blast</th><th>Batch · jeda</th><th>Progres</th><th>Status</th><th></th></tr></thead><tbody>' + list.map(b => '<tr><td data-label="Blast"><b>' + esc(b.Judul) + '</b><div class="xs muted">' + fmtTgl(b.Tanggal) + ' · ' + esc(b.Sasaran || '') + '</div></td><td data-label="Batch">' + b.UkuranBatch + ' · ' + esc(b.JedaDetik) + ' dtk</td><td data-label="Progres" style="min-width:160px"><div class="progress"><div style="width:' + b.persen + '%"></div></div><span class="xs muted">' + b.Terkirim + ' terkirim · ' + b.Gagal + ' gagal · ' + b.sisa + ' sisa</span></td><td data-label="Status"><span class="badge ' + (b.Status === 'Selesai' ? 'b-ok' : b.Status === 'Berjalan' ? 'b-info' : 'b-mute') + '">' + b.Status + '</span></td><td data-label="">' + (b.Status === 'Berjalan' ? '<button class="btn btn-ghost btn-sm" data-watch="' + b.BlastID + '">Pantau</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">Belum ada blast.</div>';
      const act = list.find(b => b.BlastID === ST.wa.active && b.Status === 'Berjalan') || (!ST.wa.active && list.find(b => b.Status === 'Berjalan'));
      renderActive(act);
    }, { fresh: 10000, force });
    const renderActive = (b) => {
      const A = set('#bActive'); if (!b) { A.hidden = true; clearInterval(ST.wa.auto); return; } ST.wa.active = b.BlastID; A.hidden = false;
      A.innerHTML = '<div class="card-h"><h3><i class="fa-solid fa-paper-plane"></i>Blast berjalan: ' + esc(b.Judul) + '</h3><span class="badge b-info">' + b.persen + '%</span></div><div class="progress" style="height:14px"><div style="width:' + b.persen + '%"></div></div><p class="small" style="margin:10px 0">' + b.Terkirim + ' terkirim · ' + b.Gagal + ' gagal · <b>' + b.sisa + ' sisa</b> dari ' + b.Total + '</p>' +
        '<div class="row"><button class="btn btn-primary" id="bNext"><i class="fa-solid fa-forward"></i> Kirim batch berikutnya sekarang</button><label class="switch"><input type="checkbox" id="bAuto"' + (ST.wa.autoOn ? ' checked' : '') + ' /><span class="tr"></span>Otomatis <span class="xs muted" id="bCount"></span></label><button class="btn btn-danger" id="bStop"><i class="fa-solid fa-stop"></i> Hentikan</button></div>';
      const next = async (btn) => busy(btn, async () => { const r = await call('wa.blastProcess', { blastId: b.BlastID }); if (r.success && r.data) { renderActive(r.data.Status === 'Berjalan' ? r.data : null); loadHist(true); } else if (!r.success) toast(r.message, 'err'); });
      $('#bNext', A).onclick = e => next(e.currentTarget);
      $('#bStop', A).onclick = async () => { if (!(await confirmBox('Hentikan blast?', 'Pesan yang belum terkirim dibatalkan.', 'Hentikan', { danger: true }))) return; const r = await call('wa.blastStop', { blastId: b.BlastID }); res2toast(r); ST.wa.autoOn = false; clearInterval(ST.wa.auto); loadHist(true); };
      $('#bAuto', A).onchange = e => { ST.wa.autoOn = e.target.checked; clearInterval(ST.wa.auto); if (!ST.wa.autoOn) return $('#bCount', A).textContent = '';
        const j = String(b.JedaDetik).split('-').map(Number), avg = j.length > 1 ? (j[0] + j[1]) / 2 : j[0] || 5; let left = Math.max(30, Math.round(b.UkuranBatch * avg));
        ST.wa.auto = setInterval(() => { left--; const c = $('#bCount'); if (c) c.textContent = '(' + left + ' dtk)'; if (left <= 0) { clearInterval(ST.wa.auto); const nb = $('#bNext'); if (nb) next(nb).then(() => { const a = $('#bAuto'); if (a && a.checked) a.dispatchEvent(new Event('change')); }); } }, 1000); };
      if (ST.wa.autoOn) $('#bAuto', A).dispatchEvent(new Event('change'));
    };
    set('#bHistR').onclick = () => loadHist(true);
    box.addEventListener('click', e => { const w = e.target.closest('[data-watch]'); if (w) { ST.wa.active = w.dataset.watch; loadHist(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    renderRows(); loadHist();
    if (ST.wa.preIds) { set('#bSrc').value = 'crm'; B.sumber = 'crm'; load(set('#bLoad')); }
  }
  function waQueue(box) {
    const Q = ST.wa.q || (ST.wa.q = { status: '', kanal: '' });
    box.innerHTML = '<div class="grid g4" id="qKpi" style="margin-bottom:14px"></div><div class="row" style="margin-bottom:12px"><select class="input" id="qSt" style="max-width:170px"><option value="">Semua status</option><option>Antri</option><option>Terkirim</option><option>Gagal</option><option>Batal</option></select><select class="input" id="qKn" style="max-width:150px"><option value="">Semua kanal</option><option value="WA">WhatsApp</option><option value="EMAIL">Email</option></select><span class="grow"></span><button class="btn btn-dark" id="qNow"><i class="fa-solid fa-play"></i> Proses sekarang</button>' + (can('superadmin') ? '<button class="btn btn-ghost" id="qRetry"><i class="fa-solid fa-rotate-right"></i> Ulangi yang gagal</button>' : '') + '</div><div id="qList"><div class="sk" style="height:240px"></div></div>';
    $('#qSt', box).value = Q.status; $('#qKn', box).value = Q.kanal;
    const load = (force) => swr('q:' + Q.status + Q.kanal, 'notif.queue', Q, d => {
      const R = d.ringkas; $('#qKpi', box).innerHTML = [['Menunggu', R.Antri, 'fa-solid fa-hourglass-half'], ['Terkirim', R.Terkirim, 'fa-solid fa-check-double'], ['Gagal', R.Gagal, 'fa-solid fa-xmark'], ['Dibatalkan', R.Batal, 'fa-solid fa-ban']].map(x => '<div class="kpi"><div class="k-lbl"><i class="' + x[2] + '"></i>' + x[0] + '</div><div class="k-num mono">' + (x[1] || 0) + '</div></div>').join('');
      $('#qList', box).innerHTML = (!d.waAktif && !d.emailAktif ? '<div class="todo"><i class="ic fa-solid fa-power-off"></i><div class="t">Notifikasi WA & Email <b>sedang nonaktif</b>. Aktifkan di tab Konfigurasi.</div></div>' : '') +
        (d.rows.length ? '<div class="tbl-wrap stack"><table class="tbl"><thead><tr><th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Event</th><th>Pesan</th><th>Status</th></tr></thead><tbody>' + d.rows.map(r => '<tr><td data-label="Waktu">' + fmtTgl(r.DikirimPada || r.DibuatPada) + '</td><td data-label="Kanal"><span class="badge ' + (r.Kanal === 'WA' ? 'b-ok' : 'b-info') + '">' + (r.Kanal === 'WA' ? 'WhatsApp' : 'Email') + '</span></td><td data-label="Tujuan" class="mono">' + esc(r.Tujuan) + '<div class="xs muted">' + esc(r.NamaPenerima) + '</div></td><td data-label="Event" class="xs">' + esc(r.Event) + '</td><td data-label="Pesan" class="full xs muted">' + esc(r.Pesan) + '</td><td data-label="Status"><span class="badge ' + ({ Terkirim: 'b-ok', Gagal: 'b-err', Antri: 'b-warn', Batal: 'b-mute' })[r.Status] + '">' + r.Status + '</span>' + (r.Respon && r.Status !== 'Terkirim' ? '<div class="xs muted">' + esc(r.Respon) + '</div>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty"><i class="fa-solid fa-inbox"></i>Antrean kosong.</div>');
    }, { fresh: 8000, force });
    $('#qSt', box).onchange = e => { Q.status = e.target.value; load(); }; $('#qKn', box).onchange = e => { Q.kanal = e.target.value; load(); };
    $('#qNow', box).onclick = e => busy(e.currentTarget, async () => { const r = await call('notif.processNow'); if (r.success) toast('Diproses: ' + (r.data.wa || 0) + ' WA, ' + (r.data.email || 0) + ' email' + (r.data.info ? ' (' + r.data.info + ')' : ''), 'ok'); else toast(r.message, 'err'); load(true); });
    const rt = $('#qRetry', box); if (rt) rt.onclick = e => busy(e.currentTarget, async () => { res2toast(await call('notif.retry', {})); load(true); });
    load(true);
  }
  function waConfig(box) {
    box.innerHTML = '<div class="sk" style="height:300px"></div>';
    swr('p:notif.config', 'notif.config', {}, cfg => {
      box.innerHTML = '<div class="grid g2"><div class="card"><div class="card-h"><h3><i class="fa-brands fa-whatsapp"></i>WhatsApp (Fonnte)</h3></div>' +
        '<label class="switch" style="margin-bottom:14px"><input type="checkbox" id="cWa"' + (cfg.waAktif ? ' checked' : '') + ' /><span class="tr"></span><b>Notifikasi WhatsApp ' + (cfg.waAktif ? 'AKTIF' : 'NONAKTIF') + '</b></label>' +
        '<div class="field"><label>Token Fonnte</label><input class="input" type="password" id="cTok" placeholder="' + (cfg.adaToken ? esc(cfg.token) + ' (tersimpan — isi hanya bila ganti)' : 'Tempel token dari fonnte.com → Device') + '" autocomplete="off" /><p class="hint">Disimpan aman di Script Properties, tidak pernah tampil utuh.' + (cfg.adaToken ? ' <a href="#" id="cTokDel" style="color:var(--err)">Hapus token</a>' : '') + '</p></div>' +
        '<div class="row" style="margin-bottom:14px"><button class="btn btn-ghost btn-sm" id="cDev"><i class="fa-solid fa-satellite-dish"></i> Cek perangkat</button><input class="input" id="cTestNo" placeholder="08… untuk tes" style="max-width:170px" /><button class="btn btn-ghost btn-sm" id="cTestWa">Kirim tes WA</button></div><div id="cDevInfo" class="small"></div>' +
        '<div class="field"><label>Nomor WA admin penerima "pesanan baru"</label><input class="input mono" id="cAdmin" value="' + esc(cfg.adminWa) + '" placeholder="0812…, 0813…" /></div>' +
        '<div class="split2"><div class="field"><label>Batch blast bawaan</label><select class="input" id="cBatch">' + [10, 20, 50].map(n => '<option' + (cfg.batchDefault === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div><div class="field"><label>Jeda (detik)</label><input class="input mono" id="cJeda" value="' + esc(cfg.jeda) + '" /></div></div>' +
        '<label class="switch"><input type="checkbox" id="cDet"' + (cfg.deteksiOtomatis ? ' checked' : '') + ' /><span class="tr"></span>Cek otomatis nomor kontak baru terdaftar WA</label></div>' +
        '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-envelope"></i>Email</h3></div><label class="switch" style="margin-bottom:14px"><input type="checkbox" id="cEm"' + (cfg.emailAktif ? ' checked' : '') + ' /><span class="tr"></span><b>Notifikasi Email ' + (cfg.emailAktif ? 'AKTIF' : 'NONAKTIF') + '</b></label>' +
        '<p class="small muted" style="margin-bottom:12px">Sisa kuota email hari ini: <b>' + cfg.kuotaEmail + '</b> (Gmail biasa ±100/hari).</p><div class="field"><label>Nama pengirim</label><input class="input" id="cNama" value="' + esc(cfg.namaPengirim) + '" /></div>' +
        '<div class="row" style="margin-bottom:14px"><input class="input" id="cTestEm" placeholder="email untuk tes" style="max-width:220px" /><button class="btn btn-ghost btn-sm" id="cTestEmail">Kirim tes email</button></div>' +
        '<div class="field"><label>URL web publik (untuk {link})</label><input class="input" id="cUrl" value="' + esc(cfg.appUrl || location.origin + location.pathname.replace(/admin\.html$/, '')) + '" /></div>' +
        '<p class="small">Pemicu antrean (tiap 1 menit): ' + (cfg.trigger ? '<span class="badge b-ok">aktif</span>' : '<span class="badge b-err">belum ada — jalankan pasangTrigger() di Apps Script</span>') + '</p></div></div>' +
        '<div class="card" style="margin-top:16px"><div class="card-h"><h3><i class="fa-solid fa-table-cells"></i>Notifikasi otomatis per kejadian</h3><span class="xs muted">Variabel: {nama} {kode} {total} …</span></div><div class="tbl-wrap stack"><table class="tbl matrix"><thead><tr><th>Kejadian</th><th style="text-align:center">WhatsApp</th><th style="text-align:center">Email</th><th></th></tr></thead><tbody>' +
        Object.keys(cfg.matriks).map(k => { const m = cfg.matriks[k]; return '<tr><td data-label="Kejadian"><b>' + esc(m.label) + '</b><div class="xs muted">' + k + '</div></td><td data-label="WhatsApp"><label class="switch"><input type="checkbox" data-mx="' + k + '" data-ch="wa"' + (m.wa ? ' checked' : '') + ' /><span class="tr"></span></label></td><td data-label="Email"><label class="switch"><input type="checkbox" data-mx="' + k + '" data-ch="email"' + (m.email ? ' checked' : '') + ' /><span class="tr"></span></label></td><td data-label=""><button class="btn btn-ghost btn-sm" data-edit="' + k + '"><i class="fa-solid fa-pen"></i> Ubah pesan</button></td></tr><tr data-ed="' + k + '" hidden><td colspan="4" class="full"><div class="field"><label>Subjek email</label><input class="input" data-sub="' + k + '" value="' + esc(m.subjek) + '" /></div><div class="field"><label>Isi pesan</label><textarea class="input" data-msg="' + k + '" rows="5">' + esc(m.pesan) + '</textarea><p class="hint">Variabel: ' + m.vars.map(v => '{' + v + '}').join(' ') + '</p></div><button class="btn btn-ghost btn-sm" data-def="' + k + '">↺ Kembalikan bawaan</button></td></tr>'; }).join('') +
        '</tbody></table></div></div><div class="savebar"><span class="grow">Simpan agar perubahan berlaku.</span><button class="btn btn-primary" id="cSave"><i class="fa-solid fa-floppy-disk"></i> Simpan konfigurasi</button></div>';
      let tokDel = false;
      const del = $('#cTokDel', box); if (del) del.onclick = e => { e.preventDefault(); tokDel = true; $('#cTok', box).placeholder = 'Token akan dihapus saat disimpan'; toast('Klik Simpan untuk menghapus token.'); };
      box.addEventListener('click', e => {
        const ed = e.target.closest('[data-edit]'); if (ed) { const r = $('[data-ed="' + ed.dataset.edit + '"]', box); r.hidden = !r.hidden; }
        const df = e.target.closest('[data-def]'); if (df) { const m = cfg.matriks[df.dataset.def]; $('[data-msg="' + df.dataset.def + '"]', box).value = m.pesanDefault; $('[data-sub="' + df.dataset.def + '"]', box).value = m.subjekDefault; }
      });
      $('#cDev', box).onclick = e => busy(e.currentTarget, async () => { const r = await call('wa.device'); $('#cDevInfo', box).innerHTML = r.success ? '<p style="margin-bottom:12px">📱 ' + esc(r.data.device || '-') + ' · <span class="badge ' + (r.data.device_status === 'connect' ? 'b-ok' : 'b-err') + '">' + esc(r.data.device_status || '-') + '</span> · paket ' + esc(r.data.package || '-') + ' · kuota ' + esc(r.data.quota || '-') + '</p>' : '<p style="color:var(--err);margin-bottom:12px">' + esc(r.message) + '</p>'; });
      $('#cTestWa', box).onclick = e => busy(e.currentTarget, async () => res2toast(await call('wa.test', { nomor: $('#cTestNo', box).value })));
      $('#cTestEmail', box).onclick = e => busy(e.currentTarget, async () => res2toast(await call('email.test', { email: $('#cTestEm', box).value })));
      $('#cSave', box).onclick = e => busy(e.currentTarget, async () => {
        const matriks = {}; Object.keys(cfg.matriks).forEach(k => { matriks[k] = { wa: $('[data-mx="' + k + '"][data-ch="wa"]', box).checked, email: $('[data-mx="' + k + '"][data-ch="email"]', box).checked, pesan: $('[data-msg="' + k + '"]', box).value, subjek: $('[data-sub="' + k + '"]', box).value }; });
        const r = await call('notif.configSave', { waAktif: $('#cWa', box).checked, emailAktif: $('#cEm', box).checked, token: tokDel ? '__HAPUS__' : $('#cTok', box).value.trim(), batchDefault: +$('#cBatch', box).value, jeda: $('#cJeda', box).value.trim(), deteksiOtomatis: $('#cDet', box).checked, namaPengirim: $('#cNama', box).value, appUrl: $('#cUrl', box).value, adminWa: $('#cAdmin', box).value, matriks });
        if (res2toast(r)) { C.putCache(ukey('p:notif.config'), r.data); waConfig(box); }
      });
    }, { fresh: 30000 });
  }

  // ---------------- PENGGUNA ----------------
  PAGES.pengguna = {
    mount(el) {
      el.innerHTML = '<div class="row" style="justify-content:space-between;margin-bottom:12px"><p class="small muted">Superadmin: akses penuh. <b>Admin</b>: menu, pesanan, pelanggan, WhatsApp. <b>Kasir</b>: pesanan & ketersediaan menu.</p><button class="btn btn-primary" id="uAdd"><i class="fa-solid fa-user-plus"></i> Tambah pengguna</button></div><div id="uList"><div class="sk" style="height:200px"></div></div>';
      $('#uAdd', el).onclick = () => this.edit(el, {});
      el.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; const u = (this.users || []).find(x => x.id === b.dataset.id); if (b.dataset.u === 'edit') this.edit(el, u); if (b.dataset.u === 'reset') this.reset(el, u); if (b.dataset.u === 'del') this.del(el, u); });
    },
    show(el) { swr('p:usersList', 'usersList', {}, L => this.render(el, L), { fresh: 30000 }); },
    render(el, L) {
      this.users = L;
      $('#uList', el).innerHTML = '<div class="tbl-wrap stack"><table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>WhatsApp</th><th>Status</th><th></th></tr></thead><tbody><tr><td data-label="Nama"><b>Superadmin</b></td><td data-label="Username" class="mono">superadmin</td><td data-label="Peran"><span class="badge b-dark">superadmin</span></td><td data-label="WA">-</td><td data-label="Status"><span class="badge b-ok">aktif</span></td><td data-label="" class="xs muted">password diatur dari Pengaturan / Apps Script</td></tr>' +
        L.map(u => '<tr><td data-label="Nama"><b>' + esc(u.nama) + '</b></td><td data-label="Username" class="mono">' + esc(u.username) + '</td><td data-label="Peran"><span class="badge ' + (u.role === 'admin' ? 'b-info' : 'b-mute') + '">' + u.role + '</span></td><td data-label="WA" class="mono">' + esc(u.noWA || '-') + '</td><td data-label="Status">' + (u.aktif ? '<span class="badge b-ok">aktif</span>' : '<span class="badge b-mute">nonaktif</span>') + (u.mustChange ? ' <span class="badge b-warn">pw sementara</span>' : '') + '</td><td data-label=""><div class="row" style="gap:4px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-u="edit" data-id="' + u.id + '">Ubah</button><button class="btn btn-ghost btn-sm" data-u="reset" data-id="' + u.id + '">Reset pw</button><button class="btn btn-danger btn-icon btn-sm" data-u="del" data-id="' + u.id + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></div></td></tr>').join('') + '</tbody></table></div>';
    },
    edit(el, u) {
      const ov = drawer(u.id ? 'Ubah pengguna' : 'Tambah pengguna', '<div class="field"><label>Nama</label><input class="input" id="ueNama" value="' + esc(u.nama || '') + '" /></div><div class="field"><label>Username <span class="opt">(huruf kecil, tanpa spasi)</span></label><input class="input mono" id="ueUser" value="' + esc(u.username || '') + '" autocomplete="off" /></div>' +
        '<div class="split2"><div class="field"><label>Peran</label><select class="input" id="ueRole"><option value="kasir"' + (u.role === 'admin' ? '' : ' selected') + '>Kasir</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option></select></div><div class="field"><label>No. WhatsApp</label><input class="input mono" id="ueWA" value="' + esc(u.noWA || '') + '" /></div></div>' +
        '<div class="field"><label>Email <span class="opt">(opsional)</span></label><input class="input" id="ueEmail" value="' + esc(u.email || '') + '" /></div><label class="switch"><input type="checkbox" id="ueAktif"' + (u.aktif === false ? '' : ' checked') + ' /><span class="tr"></span>Akun aktif</label>' + (u.id ? '' : '<p class="hint" style="margin-top:12px">Password sementara dibuat otomatis & ditampilkan sekali.</p>'),
        '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" style="flex:1" id="ueSave">Simpan</button>');
      $('#ueSave', ov).onclick = e => busy(e.currentTarget, async () => {
        const r = await call('userSave', { user: { id: u.id, nama: $('#ueNama', ov).value, username: $('#ueUser', ov).value, role: $('#ueRole', ov).value, noWA: $('#ueWA', ov).value, email: $('#ueEmail', ov).value, aktif: $('#ueAktif', ov).checked } });
        if (!r.success) return toast(r.message, 'err'); closeLayer(); C.putCache(ukey('p:usersList'), r.data.users); this.render(el, r.data.users);
        if (r.data.tempPassword) showSecret('Password sementara', 'Berikan ke <b>' + esc($('#ueUser') ? '' : '') + '</b> secara langsung. Ia wajib menggantinya saat masuk pertama.', r.data.tempPassword); else toast(r.message, 'ok');
      });
    },
    async reset(el, u) { if (!(await confirmBox('Reset password ' + u.nama + '?', 'Password lama tidak berlaku & sesi di semua perangkat dikeluarkan.', 'Reset'))) return; const r = await call('userResetPassword', { id: u.id }); if (r.success) showSecret('Password sementara baru', 'Berikan ke ' + esc(u.nama) + ' secara langsung.', r.data.tempPassword); else toast(r.message, 'err'); },
    async del(el, u) { if (!(await confirmBox('Hapus ' + u.nama + '?', 'Akun tidak bisa masuk lagi.', 'Hapus', { danger: true }))) return; const r = await call('userDelete', { id: u.id }); if (res2toast(r)) { C.putCache(ukey('p:usersList'), r.data.users); this.render(el, r.data.users); } }
  };

  // ---------------- MIGRASI ----------------
  PAGES.migrasi = {
    mount(el) {
      const SH = [['Kategori', 'Kategori menu', true], ['Menu', 'Menu & harga', true], ['Pelanggan', 'Pelanggan', true], ['Pesanan', 'Riwayat pesanan', true], ['Users', 'Akun staf', false], ['Pengaturan', 'Teks & tema', true]];
      el.innerHTML = '<div class="grid g2"><div class="card"><div class="card-h"><h3><i class="fa-solid fa-database"></i>Import dari spreadsheet app lama</h3></div>' +
        '<p class="small muted" style="margin-bottom:14px">Spreadsheet lama <b>hanya dibaca</b>, tidak diubah. Aman dijalankan berulang (tidak ada data ganda). Harus milik akun Google yang sama dengan backend ini.</p>' +
        '<div class="field"><label>URL / ID spreadsheet lama</label><input class="input" id="mgSrc" placeholder="https://docs.google.com/spreadsheets/d/…" /></div>' +
        '<div class="field"><label>Data yang dipindahkan</label><div class="grid g2" style="gap:6px">' + SH.map(s => '<label class="switch"><input type="checkbox" value="' + s[0] + '"' + (s[2] ? ' checked' : '') + ' data-mgs /><span class="tr"></span>' + s[1] + '</label>').join('') + '</div></div>' +
        '<label class="switch" style="margin-bottom:16px"><input type="checkbox" id="mgOver" /><span class="tr"></span>Timpa data yang sudah ada (bawaan: tidak)</label>' +
        '<div class="row"><button class="btn btn-dark" id="mgScan"><i class="fa-solid fa-magnifying-glass"></i> Pindai (uji coba)</button><button class="btn btn-primary" id="mgRun"><i class="fa-solid fa-file-import"></i> Jalankan import</button></div><div id="mgOut" style="margin-top:16px"></div></div>' +
        '<div><div class="card"><div class="card-h"><h3><i class="fa-solid fa-file-csv"></i>Import menu dari CSV / Excel</h3></div><p class="small muted" style="margin-bottom:12px">Kolom: <code>nama, kategori, harga, deskripsi, gambar, tag</code>. Menu dengan nama sama akan diperbarui. Simpan Excel sebagai CSV.</p><div class="row"><button class="btn btn-ghost" id="mgTpl"><i class="fa-solid fa-download"></i> Unduh template</button><label class="btn btn-primary"><i class="fa-solid fa-upload"></i> Pilih CSV<input type="file" accept=".csv,text/csv" id="mgCsv" hidden /></label></div></div>' +
        '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-list-ol"></i>Langkah pindah (cutover)</h3></div><ol class="small" style="padding-left:18px;display:grid;gap:6px"><li>Klik <b>Pindai</b> → cek angka ditambah/diperbarui.</li><li>Klik <b>Jalankan import</b>.</li><li>Cek menu, foto, pelanggan. Uji 1 pesanan.</li><li>Tepat sebelum pindah alamat: <b>jalankan import sekali lagi</b> (menangkap data baru).</li><li>Umumkan alamat baru (blast WA dari menu WhatsApp).</li></ol><p class="hint">Sesi login lama tidak ikut pindah; akun superadmin lama tidak diimpor.</p></div></div></div>';
      const go = (dry, btn) => busy(btn, async () => {
        const sheets = $$('[data-mgs]:checked', el).map(x => x.value); if (!$('#mgSrc', el).value.trim()) return toast('Tempel URL spreadsheet lama.', 'err');
        if (!dry && !(await confirmBox('Jalankan import?', 'Data dari app lama akan ditambahkan ke app ini.', 'Jalankan'))) return;
        const r = await call(dry ? 'migrasi.scan' : 'migrasi.run', { source: $('#mgSrc', el).value.trim(), sheets, overwrite: $('#mgOver', el).checked });
        if (!r.success) { $('#mgOut', el).innerHTML = '<div class="todo"><i class="ic fa-solid fa-triangle-exclamation" style="background:var(--err-bg);color:var(--err)"></i><div class="t">' + esc(r.message) + '</div></div>'; return; }
        const d = r.data;
        $('#mgOut', el).innerHTML = '<p class="small" style="margin-bottom:8px">' + (d.dryRun ? '🔎 <b>Hasil pindai</b> (belum ada yang ditulis)' : '✅ <b>Import selesai</b>') + ' dari <b>' + esc(d.source.name) + '</b></p><div class="tbl-wrap stack"><table class="tbl"><thead><tr><th>Data</th><th>Di app lama</th><th>Ditambah</th><th>Diperbarui</th><th>Dilewati</th></tr></thead><tbody>' +
          Object.keys(d.report).map(k => { const x = d.report[k]; return '<tr><td data-label="Data"><b>' + k + '</b>' + (x.catatan ? ' <span class="xs muted">(' + esc(x.catatan) + ')</span>' : '') + '</td><td data-label="Lama" class="mono">' + x.source + '</td><td data-label="Ditambah" class="mono up">' + x.inserted + '</td><td data-label="Diperbarui" class="mono">' + x.updated + '</td><td data-label="Dilewati" class="mono muted">' + x.skipped + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          (d.warnings.length ? '<div style="margin-top:12px">' + d.warnings.map(w => '<div class="todo"><i class="ic fa-solid fa-circle-info"></i><div class="t small">' + esc(w) + '</div></div>').join('') + '</div>' : '');
        if (!d.dryRun) refreshBoot(true);
      });
      $('#mgScan', el).onclick = e => go(true, e.currentTarget); $('#mgRun', el).onclick = e => go(false, e.currentTarget);
      $('#mgTpl', el).onclick = () => download('template-menu.csv', '﻿nama,kategori,harga,deskripsi,gambar,tag\nAyam Bakar Rica,Ayam,40000,Ayam bakar bumbu rica pedas,,Pedas\nEs Teh Manis,Minuman,8000,Teh manis dingin,,\n');
      $('#mgCsv', el).onchange = async e => { const f = e.target.files[0]; if (!f) return; const rows = parseCsv(await f.text()); e.target.value = '';
        if (!rows.length || rows[0].nama === undefined) return toast('Kolom "nama" tidak ditemukan. Gunakan template.', 'err');
        if (!(await confirmBox('Import ' + rows.length + ' baris menu?', 'Kategori yang belum ada akan dibuat otomatis.', 'Import'))) return;
        const r = await call('migrasi.menuCsv', { rows }); if (res2toast(r)) setMenu(r.data); };
    }
  };

  // ---------------- PENGATURAN ----------------
  PAGES.pengaturan = {
    mount(el) { this.el = el; this.refresh(el); },
    refresh(el) {
      const b = ST.boot || {}, d = b.demo;
      el.innerHTML = '<div class="grid g2"><div><div class="card"><div class="card-h"><h3><i class="fa-solid fa-user-shield"></i>Akun saya</h3></div><dl class="kv" style="margin-bottom:16px"><dt>Nama</dt><dd>' + esc(ST.user.nama) + '</dd><dt>Username</dt><dd class="mono">' + esc(ST.user.username) + '</dd><dt>Peran</dt><dd>' + esc(ST.user.role) + '</dd></dl>' +
        '<form id="pwForm"><div class="field"><label>Password lama</label><input class="input" type="password" id="pwOld" autocomplete="current-password" required /></div><div class="split2"><div class="field"><label>Password baru</label><input class="input" type="password" id="pwNew" autocomplete="new-password" minlength="10" required /></div><div class="field"><label>Ulangi</label><input class="input" type="password" id="pwNew2" autocomplete="new-password" required /></div></div><p class="hint" style="margin:-6px 0 12px">Minimal 10 karakter, kombinasi huruf & angka.</p>' +
        '<div class="row"><button class="btn btn-primary" id="pwBtn" type="submit"><i class="fa-solid fa-key"></i> Ganti password</button><button class="btn btn-ghost" type="button" id="pwAll"><i class="fa-solid fa-right-from-bracket"></i> Keluarkan semua perangkat</button></div></form>' +
        (ST.user.role === 'superadmin' ? '<div class="todo" style="margin-top:16px"><i class="ic fa-solid fa-life-ring"></i><div class="t small"><b>Lupa password superadmin?</b> Apps Script → pilih <code>resetPasswordSuperadmin</code> → ▶ Jalankan → baca password sementara di Log eksekusi.</div></div>' : '') + '</div>' +
        '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-key"></i>Lisensi template</h3></div><p class="small muted" style="margin-bottom:12px">Template ini berlisensi per domain dari <b>Nabire Kreatif</b>. Masukkan kode lisensi sekali untuk domain Anda.</p><button class="btn btn-dark" data-nk-license><i class="fa-solid fa-key"></i> Buka menu lisensi</button></div></div>' +
        '<div>' + (ST.user.role === 'superadmin' ? '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-flask"></i>Data contoh</h3></div>' +
          '<p class="small" style="margin-bottom:12px">' + (d ? (d.total ? 'Ada <b>' + d.total + ' data contoh</b> (' + d.Menu + ' menu, ' + d.Kategori + ' kategori, ' + d.Pesanan + ' pesanan, ' + d.Pelanggan + ' pelanggan). Ditandai "contoh"; data asli Anda <b>tidak</b> ikut terhapus.' : 'Tidak ada data contoh. Web siap tayang dengan data asli.') : '…') + '</p>' +
          '<div class="row"><button class="btn btn-ghost" id="dmReset"><i class="fa-solid fa-rotate"></i> Muat ulang data contoh</button><button class="btn btn-danger" id="dmClear"><i class="fa-solid fa-broom"></i> Hapus semua data contoh</button></div><p class="hint" style="margin-top:10px">Bisa juga lewat Apps Script: <code>resetDataContoh</code> / <code>hapusDataContoh</code>.</p></div>' : '') +
        '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-plug"></i>Koneksi</h3></div><dl class="kv"><dt>Backend</dt><dd>' + (DEMO ? '<span class="badge b-warn">mode contoh</span> isi <code>GAS_URL</code> di js/config.js' : '<span class="badge b-ok">terhubung</span>') + '</dd><dt>Sinkron</dt><dd>' + (b.serverTime ? fmtTgl(b.serverTime) : '-') + '</dd></dl><div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" id="cxClear"><i class="fa-solid fa-broom"></i> Bersihkan cache perangkat</button><button class="btn btn-ghost btn-sm" id="cxPerf"><i class="fa-solid fa-gauge"></i> Lihat kecepatan</button></div><div id="cxOut" class="xs muted" style="margin-top:10px"></div></div>' +
        (ST.user.role === 'superadmin' ? '<div class="card"><div class="card-h"><h3><i class="fa-solid fa-scroll"></i>Log aktivitas</h3><button class="btn btn-ghost btn-sm" id="lgLoad">Muat</button></div><div id="lgOut" style="max-height:320px;overflow:auto"></div></div>' : '') + '</div></div>';
      $('#pwForm', el).onsubmit = e => { e.preventDefault(); busy($('#pwBtn', el), async () => {
        if ($('#pwNew', el).value !== $('#pwNew2', el).value) return toast('Ulangi password tidak sama.', 'err');
        const r = await call('changePassword', { oldPassword: $('#pwOld', el).value, newPassword: $('#pwNew', el).value });
        if (res2toast(r)) { ST.token = r.data.token; ST.user = r.data.user; C.setToken(ST.token); saveSession(); e.target.reset(); } }); };
      $('#pwAll', el).onclick = async () => { if (!(await confirmBox('Keluarkan semua perangkat?', 'Semua sesi (termasuk perangkat ini) harus masuk ulang.', 'Keluarkan'))) return; const r = await call('logoutAll'); if (res2toast(r)) logout(); };
      const rs = $('#dmReset', el); if (rs) rs.onclick = async () => { if (!(await confirmBox('Muat ulang data contoh?', 'Data contoh lama dihapus lalu diisi ulang. <b>Data asli tidak tersentuh.</b>', 'Muat ulang', { word: 'RESET' }))) return; const r = await call('demoReset', { confirm: 'RESET' }); if (res2toast(r)) { ST.boot.demo = r.data; refreshBoot(true); this.refresh(el); } };
      const cl = $('#dmClear', el); if (cl) cl.onclick = async () => { if (!(await confirmBox('Hapus semua data contoh?', 'Menu, pesanan, dan pelanggan contoh dihapus. <b>Data asli tidak tersentuh.</b>', 'Hapus', { word: 'HAPUS', danger: true }))) return; const r = await call('demoClear', { confirm: 'HAPUS' }); if (res2toast(r)) { ST.boot.demo = r.data; refreshBoot(true); this.refresh(el); } };
      $('#cxClear', el).onclick = () => { Object.keys(localStorage).filter(k => k.indexOf('nresto:') === 0 && !/:sess$/.test(k)).forEach(k => localStorage.removeItem(k)); toast('Cache perangkat dibersihkan.', 'ok'); refreshBoot(true); };
      $('#cxPerf', el).onclick = () => { const R = C.Perf.rows.slice(-8).reverse(); $('#cxOut', el).innerHTML = R.length ? R.map(r => esc(r.action) + ': total ' + r.total + ' ms · server ' + (r.server ?? '-') + ' ms').join('<br>') : 'Belum ada panggilan.'; };
      const lg = $('#lgLoad', el); if (lg) lg.onclick = e => busy(e.currentTarget, async () => { const r = await call('logs'); $('#lgOut', el).innerHTML = r.success ? r.data.slice(0, 150).map(x => '<div class="sumrow small"><span><b>' + esc(x.aksi) + '</b> · ' + esc(x.user) + '<br><span class="xs muted">' + esc(x.detail) + '</span></span><span class="xs muted">' + fmtTgl(x.waktu) + '</span></div>').join('') : esc(r.message); });
    }
  };

  // =================================================================
  //  MODE CONTOH (tanpa backend) — perubahan hanya di memori
  // =================================================================
  const DemoApi = {
    db: null,
    init() {
      if (this.db) return; const D = window.DEMO_DATA, now = Date.now();
      const items = D.menu.map((m, i) => ({ id: m.id, kategori: m.cat, nama: m.name, tag: m.tag, rating: m.rating, terjual: m.sold, harga: m.price, deskripsi: m.desc, gambar: m.img, variasi: m.variations, tambahan: m.addons, aktif: true, urutan: i + 1, is_demo: true }));
      const names = ['Rina Wulandari', 'Yusuf Ambon', 'Maria Kogoya', 'Dedi Pratama', 'Siti Aisyah', 'Yohanes Wonda'], st = ['Menunggu', 'Diproses', 'Selesai', 'Selesai', 'Batal', 'Selesai', 'Siap'];
      const orders = Array.from({ length: 24 }, (_, i) => { const m = items[i % items.length], q = 1 + i % 2, l = ['dinein', 'takeaway', 'delivery'][i % 3], ong = l === 'delivery' ? 13000 : 0, sub = m.harga * q, paj = Math.round((sub + ong) * .05);
        return { id: 'DEMO-' + (1000 + i), waktu: new Date(now - Math.floor(i / 3.5) * 864e5 - (i % 4) * 3600e3).toISOString(), nama: names[i % 6], noWA: '08123450000' + (i % 6), layanan: l, alamat: l === 'delivery' ? 'Jl. Contoh No. ' + i : '', jarakKm: l === 'delivery' ? 1 : 0, pembayaran: ['kasir', 'cod', 'transfer', 'qris'][i % 4], items: [{ name: m.nama, qty: q, unit: m.harga, variationName: m.variasi[0].name }], subtotal: sub, ongkir: ong, pajak: paj, total: sub + ong + paj, status: st[i % 7], is_demo: true }; });
      const t0 = new Date(now + 864e5).toISOString().slice(0, 10), t1 = new Date(now + 3 * 864e5).toISOString().slice(0, 10);
      this.db = { reservasi: [{ id: 'RSV-DEMO1', nama: 'Rina Wulandari', noWA: '081234500001', tanggal: t0, jam: '19:00', orang: 4, area: 'Indoor', meja: '', catatan: 'Ulang tahun', status: 'Menunggu', catatanAdmin: '', is_demo: true },
        { id: 'RSV-DEMO2', nama: 'Yohanes Wonda', noWA: '081234500006', tanggal: t0, jam: '12:00', orang: 8, area: 'VIP', meja: 'V1', catatan: '', status: 'Dikonfirmasi', catatanAdmin: '', is_demo: true },
        { id: 'RSV-DEMO3', nama: 'Maria Kogoya', noWA: '081234500003', tanggal: t1, jam: '18:30', orang: 2, area: 'Teras', meja: '', catatan: '', status: 'Menunggu', catatanAdmin: '', is_demo: true }],
        meja: (D.meja || []).map((m, i) => Object.assign({ id: 'MJ' + i, aktif: true, is_demo: true }, m)),
        settings: Object.assign({}, D.settings, { admin_wa: '' }), menu: { categories: D.categories.map((c, i) => ({ id: c.id, nama: c.name, ikon: c.icon, urutan: i + 1, aktif: true, is_demo: true })), items }, orders };
    },
    dash() {
      const fmt = d => new Date(d).toISOString().slice(0, 10), hari = [...Array(7)].map((_, i) => fmt(Date.now() - (6 - i) * 864e5)), by = {}; hari.forEach(h => by[h] = { omzet: 0, pesanan: 0 });
      const top = {}, lay = {}; let mn = 0, dp = 0;
      this.db.orders.forEach(o => { if (o.status === 'Menunggu') mn++; if (o.status === 'Diproses' || o.status === 'Siap') dp++; if (o.status === 'Batal') return; const d = fmt(o.waktu); if (by[d]) { by[d].omzet += o.total; by[d].pesanan++; lay[o.layanan] = (lay[o.layanan] || 0) + 1; o.items.forEach(i => top[i.name] = (top[i.name] || 0) + i.qty); } });
      return { today: { omzet: by[hari[6]].omzet, pesanan: by[hari[6]].pesanan }, yesterday: by[hari[5]], menunggu: mn, diproses: dp, mingguOmzet: hari.reduce((s, h) => s + by[h].omzet, 0), mingguPesanan: hari.reduce((s, h) => s + by[h].pesanan, 0), pelanggan7: 6,
        chart: hari.map(h => ({ tgl: h, omzet: by[h].omzet, pesanan: by[h].pesanan })), top: Object.keys(top).map(k => ({ nama: k, qty: top[k] })).sort((a, b) => b.qty - a.qty).slice(0, 5), layanan: lay };
    },
    boot(user) { return { user, ordersV: 'demo', dashboard: this.dash(), orders: this.db.orders, reservasi: this.db.reservasi, meja: this.db.meja, ops: this.db.settings, toko: statusToko(this.db.settings, 0), menu: this.db.menu, settings: this.db.settings, demo: { total: this.db.menu.items.length, Menu: this.db.menu.items.length, Kategori: 6, Pesanan: 24, Pelanggan: 6 }, serverTime: new Date().toISOString() }; },
    async call(a, d) {
      this.init(); await new Promise(r => setTimeout(r, 120));
      const user = { username: 'superadmin', nama: 'Pemilik (contoh)', role: 'superadmin', mustChange: false }, ok = (data, message) => ({ success: true, data, message: message || '' });
      const M = this.db.menu;
      switch (a) {
        case 'login': return ok({ token: 'demo', user, boot: this.boot(user) });
        case 'adminBoot': return ok(this.boot(user));
        case 'orderStatus': this.db.orders.forEach(o => { if (d.ids.indexOf(o.id) > -1) o.status = d.status; }); return ok({ updated: d.ids.length }, 'Mode contoh: status diubah (tidak tersimpan).');
        case 'menuToggle': (M.items.find(i => i.id === d.id) || {}).aktif = d.aktif; return ok({}, 'Mode contoh: tidak tersimpan permanen.');
        case 'menuSave': { const it = d.item; if (it.id) Object.assign(M.items.find(i => i.id === it.id), it); else M.items.push(Object.assign({ id: 'X' + Date.now(), urutan: M.items.length + 1 }, it)); return ok(M, 'Mode contoh: menu disimpan sementara.'); }
        case 'menuDelete': M.items = M.items.filter(i => i.id !== d.id); return ok(M, 'Mode contoh: dihapus sementara.');
        case 'menuReorder': return ok(M);
        case 'categorySave': { const c = d.category; if (c.baru || !c.id) M.categories.push({ id: (c.nama || 'kat').toLowerCase().replace(/\W+/g, '-'), nama: c.nama, ikon: c.ikon, aktif: c.aktif, urutan: M.categories.length + 1 }); else Object.assign(M.categories.find(x => x.id === c.id), c); return ok(M, 'Mode contoh: kategori disimpan sementara.'); }
        case 'categoryDelete': if (M.items.some(i => i.kategori === d.id)) return { success: false, message: 'Kategori masih dipakai menu.' }; M.categories = M.categories.filter(c => c.id !== d.id); return ok(M);
        case 'settingsSave': Object.assign(this.db.settings, d.settings); return ok(this.db.settings, 'Mode contoh: tampilan disimpan sementara (hubungkan backend agar permanen).');
        case 'tokoMode': this.db.settings.mode_toko = d.mode; return ok({ ops: this.db.settings, toko: statusToko(this.db.settings, 0) }, 'Mode contoh: status toko diubah sementara.');
        case 'opsSave': Object.assign(this.db.settings, d.settings); return ok({ ops: this.db.settings, toko: statusToko(this.db.settings, 0), settings: this.db.settings }, 'Mode contoh: tersimpan sementara.');
        case 'orderPay': (this.db.orders.find(o => o.id === d.id) || {}).statusBayar = d.statusBayar; return ok({}, 'Mode contoh: status bayar diubah.');
        case 'reservasiStatus': this.db.reservasi.forEach(r => { if (d.ids.indexOf(r.id) > -1) { r.status = d.status; if (d.meja !== undefined) r.meja = d.meja; } }); return ok({ reservasi: this.db.reservasi }, 'Mode contoh: reservasi → ' + d.status);
        case 'reservasiDelete': this.db.reservasi = this.db.reservasi.filter(r => d.ids.indexOf(r.id) === -1); return ok({ reservasi: this.db.reservasi });
        case 'mejaSave': { const m = d.meja; if (m.id) Object.assign(this.db.meja.find(x => x.id === m.id), m); else this.db.meja.push(Object.assign({ id: 'MJ' + Date.now() }, m)); return ok(this.db.meja, 'Mode contoh: meja disimpan sementara.'); }
        case 'mejaDelete': this.db.meja = this.db.meja.filter(x => x.id !== d.id); return ok(this.db.meja);
        default: return { success: false, message: 'Mode contoh: fitur ini aktif setelah backend dihubungkan (isi GAS_URL di js/config.js).' };
      }
    }
  };

  // =================================================================
  //  MULAI — tampil instan dari sesi & cache
  // =================================================================
  (function start() {
    applyBrand();
    const s = C.Store.get('sess', null);
    if (s && s.token && s.user && !s.user.mustChange) {
      ST.token = s.token; ST.user = s.user; C.setToken(s.token);
      const cache = C.Store.get(ukey('boot'), null);
      ST.boot = cache ? cache.data : null;
      enterApp(null);      // render dari cache seketika, lalu segarkan di latar
      return;
    }
    showAuth();
    if (DEMO) $('#lgPass').value = 'contoh123456';
  })();
})();
