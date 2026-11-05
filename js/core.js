/* =====================================================================
 *  core.js — lapisan API cepat & tahan jaringan HP (dipakai publik + admin)
 *  • fetch POST text/plain (tanpa CORS preflight) + timeout + retry
 *  • reqId untuk aksi tulis → aman diulang tanpa data ganda
 *  • Store localStorage berversi + SWR (tampilkan cache dulu, segarkan di latar)
 *  • Perf.table() di console untuk melihat waktu tiap panggilan
 * ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG || {};
  const GAS_URL = String(CFG.GAS_URL || '').trim();
  const LS = 'nresto:' + (CFG.CACHE_VERSION || 'v1') + ':';

  const Store = {
    get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      const s = JSON.stringify(v);
      try { localStorage.setItem(LS + k, s); }
      catch (e) { try { Object.keys(localStorage).filter(x => x.indexOf('nresto:') === 0 && x.indexOf(LS) !== 0).forEach(x => localStorage.removeItem(x)); localStorage.setItem(LS + k, s); } catch (e2) { } }
    },
    del(k) { try { localStorage.removeItem(LS + k); } catch (e) { } }
  };
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }

  const Perf = {
    rows: [],
    add(action, total, server) { this.rows.push({ action, total, server: server ?? null, net: server != null ? total - server : null }); if (this.rows.length > 200) this.rows.shift(); },
    table() { console.table(this.rows.slice(-30)); }
  };

  const READ = /^(publicBoot|adminBoot|me|batch|dashboard|ordersList|ordersSince|menuList|settingsGet|usersList|logs|demoStatus|notif\.config|notif\.queue|wa\.device|wa\.audience|wa\.blastList|crm\.list|crm\.stats|crm\.detail|crm\.export|migrasi\.scan|login|orderTrack|reservasiSlots|reservasiTrack|reservasiList)$/;
  let token = '';
  let onAuthFail = null;

  async function once(action, data, timeout, reqId) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
    try {
      const res = await fetch(GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, reqId, data: data || {} }) });
      const text = await res.text();
      try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
      catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas halaman bukan data (HTTP ' + res.status + '). Pastikan deploy Apps Script: akses "Siapa saja" & versi terbaru.' }; }
    } catch (err) {
      return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Koneksi terputus. Periksa internet Anda.' };
    } finally { clearTimeout(t); }
  }
  function waitOnline(ms) { return new Promise(r => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }

  async function api(action, data, opt = {}) {
    if (!GAS_URL) return { success: false, demo: true, message: 'Mode contoh: backend belum dihubungkan (isi GAS_URL di js/config.js).' };
    const isRead = READ.test(action);
    const reqId = isRead ? '' : (opt.reqId || uid());
    const tries = opt.tries || (isRead ? 3 : 2);
    let res;
    for (let i = 0; i < tries; i++) {
      if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
      res = await once(action, data, opt.timeout || (isRead ? (i ? 40000 : 25000) : 90000), reqId);
      if (res.success || !res.retryable) break;
    }
    if (!res.success && res.data && res.data.code === 'AUTH' && onAuthFail) onAuthFail(res);
    return res;
  }

  /** SWR: render(cache) seketika → segarkan bila lewat batas kesegaran → render lagi HANYA bila berubah. */
  async function swr(key, action, data, render, opt = {}) {
    const fresh = opt.fresh ?? 60000, c = Store.get(key, null);
    if (c) render(c.data, true);
    if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
    const res = await api(action, data);
    if (res.success) {
      const h = hashStr(JSON.stringify(res.data));
      Store.set(key, { t: Date.now(), h, data: res.data });
      if (!c || c.h !== h) render(res.data, false);
    } else if (!c && opt.onError) opt.onError(res);
    return res;
  }
  function putCache(key, data) { Store.set(key, { t: Date.now(), h: hashStr(JSON.stringify(data)), data }); }

  function warmUp() { if (GAS_URL) fetch(GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => { }); }
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 120000) warmUp(); });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function rupiah(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }

  /** Terapkan tema (warna, huruf, radius) dari pengaturan ke variabel CSS. */
  const FONT_SIAP = ['Outfit', 'Playfair Display', 'Poppins', 'Inter', 'Roboto'];
  function loadFont(name) {
    if (!name || FONT_SIAP.indexOf(name) > -1 || document.querySelector('link[data-font="' + name + '"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.font = name;
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap';
    document.head.appendChild(l);
  }
  function applyTheme(s) {
    if (!s) return;
    const r = document.documentElement.style, set = (v, k) => { if (s[k]) r.setProperty(v, s[k]); };
    set('--primary', 'color_primary'); set('--primary-deep', 'color_primary_deep'); set('--dark', 'color_dark'); set('--dark-2', 'color_dark2');
    set('--text', 'color_text'); set('--accent', 'color_accent'); set('--slate-50', 'color_bg');
    if (s.radius !== undefined && s.radius !== '') r.setProperty('--radius', Number(s.radius) + 'px');
    if (s.font_body) { loadFont(s.font_body); r.setProperty('--font', '"' + s.font_body + '", sans-serif'); }
    if (s.font_display) { loadFont(s.font_display); r.setProperty('--display', '"' + s.font_display + '", serif'); }
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta && s.color_dark) meta.content = s.color_dark;
  }

  window.Core = { GAS_URL, Store, api, swr, putCache, uid, hashStr, Perf, warmUp, esc, rupiah, applyTheme, loadFont,
    setToken(t) { token = t || ''; }, getToken() { return token; }, onAuthFail(fn) { onAuthFail = fn; } };
  window.Perf = Perf;
  warmUp();
})();
