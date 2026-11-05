/* =====================================================================
 *  app.js — Halaman publik v2 (Alpine.js)
 *  • Katalog rapi: grid / list bergambar / geser
 *  • Popup bisa di-scroll (scroll halaman dikunci saat popup terbuka)
 *  • Checkout lengkap: meja (dine-in), waktu ambil (takeaway), peta + ongkir otomatis
 *    (delivery), rekening + QRIS + unggah bukti, catatan; pesanan dicatat dulu ke sistem
 *  • Jam buka/tutup otomatis dari dasbor → menu tidak bisa dipesan saat tutup
 *  • Reservasi meja (slot jam & kapasitas) + "Pesanan Saya" (lacak status)
 * ===================================================================== */
const SERVICES = [
  { id: 'dinein', name: 'Dine-In', icon: 'fa-solid fa-chair' },
  { id: 'takeaway', name: 'Takeaway', icon: 'fa-solid fa-bag-shopping' },
  { id: 'delivery', name: 'Delivery', icon: 'fa-solid fa-motorcycle' }
];
const PAYMENTS = [
  { id: 'kasir', name: 'Bayar di Kasir', sub: 'tunai / kartu', icon: 'fa-solid fa-cash-register' },
  { id: 'cod', name: 'COD', sub: 'bayar ke kurir', icon: 'fa-solid fa-money-bill-wave' },
  { id: 'transfer', name: 'Transfer Bank', sub: 'lihat rekening', icon: 'fa-solid fa-building-columns' },
  { id: 'qris', name: 'QRIS', sub: 'semua e-wallet', icon: 'fa-solid fa-qrcode' }
];
const HARI3 = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e2e8f0"/><g fill="none" stroke="#94a3b8" stroke-width="10"><circle cx="200" cy="130" r="44"/></g><text x="200" y="230" font-family="sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">Foto belum tersedia</text></svg>');
const IS_PREVIEW = /[?&]preview=1/.test(location.search);
const PV_ORIGIN = location.protocol === 'file:' ? '*' : location.origin;

function compressImage(file, max = 1280, q = 0.8) {
  return new Promise((res, rej) => {
    if (!/^image\//.test(file.type)) return rej(new Error('Pilih file foto (JPG/PNG).'));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r); const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', q)); };
    img.onerror = () => rej(new Error('Foto tidak bisa dibaca.')); img.src = url;
  });
}
function waitLeaflet(ms = 8000) {
  if (window.L) return Promise.resolve();
  return new Promise((res, rej) => {
    const t0 = Date.now(); const iv = setInterval(() => { if (window.L) { clearInterval(iv); res(); } else if (Date.now() - t0 > ms) { clearInterval(iv);
      const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); } }, 100);
  });
}

function restoApp() {
  return {
    s: Object.assign({}, window.DEMO_DATA.settings), categories: [], menu: [], meja: [], demo: false, ready: false, skew: 0,
    toko: { buka: true, bisaPesan: true, label: 'Buka', info: '' },
    scrolled: false, viewMode: 'grid', swipeMode: false, swipeIndex: 0, activeCat: 'all', favs: [], toasts: [], year: new Date().getFullYear(),
    addOpen: false, cartOpen: false, quickOpen: false, aboutOpen: false, successOpen: false, resvOpen: false, myOpen: false, badgePop: false,
    current: {}, qty: 1, selVar: 0, selAddons: [], note: '', quickMode: false,
    cart: [], quickItem: null, sending: false,
    order: { name: '', phone: '', service: 'dinein', address: '', pay: 'kasir', meja: '', waktuAmbil: 'Secepatnya', note: '' },
    ckErr: {}, bukti: '',
    distanceKm: 0, pinLat: 0, pinLng: 0, pinSet: false, map: null, marker: null, mapInited: false, gpsAsked: false, mapQ: '', mapResults: [],
    lastOrder: {},
    resv: { orang: 2, tanggal: '', jam: '', area: '', name: '', phone: '', note: '' }, slots: [], slotMsg: '', slotsLoading: false, resvDone: null, rvErr: {},
    myTab: 'order', myOrders: [], myResv: [], myLoading: false,

    init() {
      window.addEventListener('scroll', () => { this.scrolled = window.scrollY > 40; }, { passive: true });
      this.favs = Core.Store.get('favs', []);
      this.cart = Core.Store.get('cart', []);
      this.myOrders = Core.Store.get('my:orders', []); this.myResv = Core.Store.get('my:resv', []);
      const saved = Core.Store.get('pembeli', null); if (saved) { this.order.name = saved.name || ''; this.order.phone = saved.phone || ''; this.resv.name = saved.name || ''; this.resv.phone = saved.phone || ''; }
      this.$watch('cart', v => Core.Store.set('cart', v));
      this.$watch('anyModalOpen', open => this.lockScroll(open));
      this.$watch('order.service', () => { if (!this.paymentsFor.some(p => p.id === this.order.pay)) this.order.pay = (this.paymentsFor[0] || {}).id || 'kasir'; });
      this.loadData();
      if (IS_PREVIEW) this.listenPreview();
      setInterval(() => this.updateToko(), 30000);

      const observer = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); } }), { threshold: 0.1 });
      setTimeout(() => document.querySelectorAll('.reveal').forEach((el) => observer.observe(el)), 100);

      if (typeof Lenis !== 'undefined' && !IS_PREVIEW && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), prevent: (node) => !!node.closest && !!node.closest('.modal-overlay, .leaflet-container, .menu-grid-swipe, .cats') });
        const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
        window.__lenis = lenis;
      }
      if (location.hash === '#pesanan-saya') this.openMyOrders();
      if (location.hash === '#reservasi-meja') this.openResv();
    },
    /** Kunci scroll halaman saat popup terbuka → yang ter-scroll isi popup, bukan halaman di belakang. */
    lockScroll(open) {
      document.documentElement.classList.toggle('modal-open', open);
      if (window.__lenis) { if (open) window.__lenis.stop(); else window.__lenis.start(); }
    },

    // ---------- DATA ----------
    applyData(d) {
      if (!d) return;
      this.s = Object.assign({}, window.DEMO_DATA.settings, d.settings || {});
      this.categories = d.categories || []; this.menu = d.menu || []; this.meja = d.meja || window.DEMO_DATA.meja || [];
      this.demo = !!d.demo; this.ready = true;
      if (d.serverTime) this.skew = new Date(d.serverTime).getTime() - Date.now();
      Core.applyTheme(this.s);
      document.title = this.s.brand_name + ' — ' + (this.s.hero_line1 + ' ' + this.s.hero_line2 + ' ' + this.s.hero_line3).replace(/[.,]/g, '').trim();
      const md = document.querySelector('meta[name="description"]'); if (md && this.s.meta_desc) md.content = this.s.meta_desc;
      if (!this.services.some(x => x.id === this.order.service)) this.order.service = (this.services[0] || {}).id || 'dinein';
      if (this.menu.length) this.cart = this.cart.filter(l => this.menu.some(m => String(m.id) === String(l.id)));
      this.updateToko();
    },
    updateToko() { this.toko = statusToko(this.s, this.skew); },
    async loadData() {
      const loader = document.getElementById('bootLoader');
      if (!Core.GAS_URL) { this.applyData(window.DEMO_DATA); return; }
      if (!Core.Store.get('pub', null) && !IS_PREVIEW) loader.classList.remove('hide');
      const fallback = setTimeout(() => { if (!this.ready) { this.applyData(window.DEMO_DATA); loader.classList.add('hide'); } }, 9000);
      await Core.swr('pub', 'publicBoot', {}, (data) => { this.applyData(data); loader.classList.add('hide'); }, {
        fresh: 30000, onError: (r) => { this.applyData(window.DEMO_DATA); this.showToast('Menu terbaru belum termuat: ' + r.message, 'err'); }
      });
      clearTimeout(fallback); loader.classList.add('hide');
    },
    listenPreview() {
      window.addEventListener('message', (e) => {
        if (!e.data || e.data.type !== 'nr-preview' || (e.source && e.source !== window.parent)) return;
        const d = e.data;
        this.applyData({ settings: Object.assign({}, this.s, d.settings || {}), categories: d.categories || this.categories, menu: d.menu || this.menu, meja: this.meja, demo: false });
        if (d.scrollTo) { const el = document.querySelector(d.scrollTo); if (el) el.scrollIntoView({ block: 'start' }); }
      });
      try { parent.postMessage({ type: 'nr-preview-ready' }, PV_ORIGIN); } catch (e) { }
    },

    // ---------- GETTERS ----------
    get allCategories() { return [{ id: 'all', name: 'Semua', icon: 'fa-solid fa-utensils' }].concat(this.categories.filter(c => this.menu.some(m => m.cat === c.id))); },
    get marquee() { return this.split(this.s.marquee_text); },
    get services() { const a = String(this.s.layanan_aktif || '').split(','); return SERVICES.filter(x => a.indexOf(x.id) > -1); },
    get paymentsFor() {
      const a = String(this.s.bayar_aktif || '').split(',');
      return PAYMENTS.filter(x => a.indexOf(x.id) > -1 && !(x.id === 'cod' && this.order.service !== 'delivery') && !(x.id === 'kasir' && this.order.service === 'delivery'));
    },
    get rekening() { try { const r = JSON.parse(this.s.rekening_json || '[]'); return Array.isArray(r) ? r.filter(x => x && x.nomor) : []; } catch (e) { return []; } },
    get restoLat() { return Number(this.s.resto_lat) || -3.36654; },
    get restoLng() { return Number(this.s.resto_lng) || 135.49653; },
    get taxPct() { return Number(this.s.pajak_persen) || 0; },
    get filteredMenu() { return this.activeCat === 'all' ? this.menu : this.menu.filter((m) => m.cat === this.activeCat); },
    get cartCount() { return this.cart.reduce((sum, i) => sum + i.qty, 0); },
    get cartTotal() { return this.cart.reduce((sum, i) => sum + i.unit * i.qty, 0); },
    get currentUnitPrice() {
      if (!this.current.price && this.current.price !== 0) return 0;
      let t = this.current.price;
      if (this.current.variations && this.current.variations[this.selVar]) t += this.current.variations[this.selVar].price;
      if (this.current.addons) this.selAddons.forEach((i) => { t += this.current.addons[i].price; });
      return t;
    },
    get orderItems() { return this.quickItem ? [this.quickItem] : this.cart; },
    get orderSubtotal() { return this.orderItems.reduce((s, i) => s + i.unit * i.qty, 0); },
    get shipError() { const maks = Number(this.s.ongkir_max_km) || 0; return this.pinSet && maks > 0 && this.distanceKm > maks ? 'Di luar jangkauan antar (maks ' + maks + ' km, lokasi Anda ±' + this.distanceKm.toFixed(1) + ' km).' : ''; },
    get shipFree() { const g = Number(this.s.ongkir_gratis_min) || 0; return g > 0 && this.orderSubtotal >= g; },
    get minOrderShort() { const m = Number(this.s.min_order_delivery) || 0; return this.order.service === 'delivery' && m > 0 ? Math.max(0, m - this.orderSubtotal) : 0; },
    get shippingFee() {
      if (this.order.service !== 'delivery' || !this.pinSet || this.shipFree) return 0;
      const raw = Number(this.s.ongkir_dasar || 0) + Math.max(0, this.distanceKm - (Number(this.s.ongkir_km_dasar) || 0)) * Number(this.s.ongkir_per_km || 0);
      return Math.ceil(raw / 500) * 500;
    },
    get orderTax() { return Math.round((this.orderSubtotal + this.shippingFee) * this.taxPct / 100); },
    get orderGrandTotal() { return this.orderSubtotal + this.shippingFee + this.orderTax; },
    get anyModalOpen() { return this.addOpen || this.cartOpen || this.quickOpen || this.aboutOpen || this.successOpen || this.resvOpen || this.myOpen; },
    get pickupTimes() {
      const out = [{ v: 'Secepatnya', t: 'Secepatnya (±' + (this.s.estimasi_menit || 25) + ' menit)' }], n = partsNow(this.s.zona_waktu, this.skew), j = jamHari(this.s, n.tgl);
      let end = j ? j.t : n.min + 240; if (this.s.mode_toko === 'buka') end = Math.max(end, n.min + 240);
      for (let m = Math.ceil((n.min + 30) / 15) * 15; m <= end - 15 && out.length < 40; m += 15) out.push({ v: fmtMin(m), t: 'Hari ini pukul ' + fmtMin(m) });
      return out;
    },
    get hoursList() {
      const j = jadwalOf(this.s), today = partsNow(this.s.zona_waktu, this.skew).dow;
      return [1, 2, 3, 4, 5, 6, 0].map(d => ({ d, nama: HARI[d], today: d === today, jam: j[d].libur ? 'Libur' : j[d].buka.replace(':', '.') + ' – ' + j[d].tutup.replace(':', '.') }));
    },
    get areas() { return [...new Set((this.meja || []).map(m => m.area).filter(Boolean))]; },
    get resvDates() {
      const n = partsNow(this.s.zona_waktu, this.skew), out = [];
      for (let i = 0; i < 10; i++) { const t = addDays(n.tgl, i); out.push({ v: t, h: i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : HARI3[dowOf(t)], t: String(+t.slice(8)), b: BULAN[+t.slice(5, 7) - 1], libur: !jamHari(this.s, t) || (i === 0 && this.s.mode_toko === 'tutup') }); }
      return out;
    },
    get resvMaxDate() { return addDays(partsNow(this.s.zona_waktu, this.skew).tgl, Number(this.s.reservasi_hari_maks) || 30); },
    get myActiveCount() { return this.myOrders.filter(o => ['Selesai', 'Batal'].indexOf(o.status) === -1).length + this.myResv.filter(r => ['Menunggu', 'Dikonfirmasi'].indexOf(r.status || 'Menunggu') > -1).length; },

    // ---------- UTIL ----------
    on(v) { return String(v || '').toUpperCase() !== 'TIDAK'; },
    split(v) { return String(v || '').split('|').map(x => x.trim()).filter(Boolean); },
    fmt(n) { return (Number(n) || 0).toLocaleString('id-ID'); },
    fmtTgl(t) { if (!t) return ''; return HARI[dowOf(t)] + ', ' + (+t.slice(8)) + ' ' + BULAN[+t.slice(5, 7) - 1]; },
    fmtWaktu(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); },
    hasOptions(item) { return (item.variations || []).some(v => v.price > 0); },
    prettyPhone(n) { const s = String(n || ''); return s.indexOf('62') === 0 ? '+62 ' + s.slice(2).replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3') : s; },
    waLink(text) { return 'https://wa.me/' + this.s.wa_number + '?text=' + encodeURIComponent(text); },
    imgFallback(e) { if (e.target.src !== PLACEHOLDER_IMG) e.target.src = PLACEHOLDER_IMG; },
    copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => this.showToast('Disalin: ' + t)).catch(() => this.showToast(t)); },
    badgeCls(st) { return { Selesai: 'ok', Lunas: 'ok', Dikonfirmasi: 'ok', Datang: 'ok', Diproses: 'info', Siap: 'info', 'Menunggu verifikasi': 'warn', Menunggu: 'warn', 'Belum bayar': 'warn', Batal: 'err', Ditolak: 'err' }[st] || ''; },
    stepIdx(st) { return ['Menunggu', 'Diproses', 'Siap', 'Selesai'].indexOf(st || 'Menunggu'); },
    setCat(id) { this.activeCat = id; this.swipeIndex = 0; },
    setView(mode) { this.viewMode = mode; this.swipeMode = false; },
    toggleSwipe() { this.swipeMode = !this.swipeMode; this.swipeIndex = 0; },
    toggleFav(id) { const i = this.favs.indexOf(id); if (i > -1) { this.favs.splice(i, 1); this.showToast('Dihapus dari favorit'); } else { this.favs.push(id); this.showToast('Ditambahkan ke favorit'); } Core.Store.set('favs', this.favs); },
    showToast(msg, type) { const id = Date.now() + Math.random(); this.toasts.push({ id, msg, type: type || '' }); setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id); }, type === 'err' ? 5000 : 3000); },
    triggerBadgePop() { this.badgePop = true; setTimeout(() => { this.badgePop = false; }, 400); },
    guardOpen() { this.updateToko(); if (this.toko.bisaPesan) return true; this.showToast((this.toko.buka ? 'Pesanan online sudah ditutup. ' : 'Kami sedang tutup. ') + (this.toko.info || ''), 'err'); return false; },

    // ---------- KERANJANG ----------
    openAdd(item, quick) { if (!this.guardOpen()) return; this.current = item; this.qty = 1; this.selVar = 0; this.selAddons = []; this.note = ''; this.quickMode = !!quick; this.addOpen = true; },
    toggleAddon(idx) { const p = this.selAddons.indexOf(idx); if (p > -1) this.selAddons.splice(p, 1); else this.selAddons.push(idx); },
    buildLine() {
      return { id: this.current.id, name: this.current.name, img: this.current.img, unit: this.currentUnitPrice, qty: this.qty, v: this.selVar, a: this.selAddons.slice(),
        variationName: this.current.variations && this.current.variations[this.selVar] ? this.current.variations[this.selVar].name : '',
        addonNames: this.selAddons.map((i) => this.current.addons[i].name).join(', '), note: this.note };
    },
    confirmAdd() {
      const line = this.buildLine(); this.addOpen = false;
      if (this.quickMode) { this.quickItem = line; this.openCheckout(); return; }
      const same = this.cart.find(l => l.id === line.id && l.v === line.v && JSON.stringify(l.a) === JSON.stringify(line.a) && l.note === line.note);
      if (same) same.qty += line.qty; else this.cart.push(line);
      this.triggerBadgePop(); this.showToast('Masuk ke keranjang');
    },
    openCart() { this.cartOpen = true; },
    incLine(i) { this.cart[i].qty++; },
    decLine(i) { if (this.cart[i].qty > 1) this.cart[i].qty--; else this.removeLine(i); },
    removeLine(i) { this.cart.splice(i, 1); },
    ckInc(i) { if (this.quickItem) this.quickItem.qty++; else this.cart[i].qty++; },
    ckDec(i) { if (this.quickItem) { if (this.quickItem.qty > 1) this.quickItem.qty--; else this.closeQuick(); return; } if (this.cart[i].qty > 1) this.cart[i].qty--; else { this.cart.splice(i, 1); if (!this.cart.length) this.closeQuick(); } },
    openCheckout() {
      if (!this.guardOpen()) return;
      this.ckErr = {}; this.bukti = ''; this.quickOpen = true;
      if (!this.paymentsFor.some(p => p.id === this.order.pay)) this.order.pay = (this.paymentsFor[0] || {}).id || 'kasir';
      if (this.order.service === 'delivery') this.$nextTick(() => setTimeout(() => this.initMap(), 80));
    },
    checkoutFromCart() { this.quickItem = null; this.cartOpen = false; if (!this.cart.length) return; this.openCheckout(); },
    proceedCheckout() { this.checkoutFromCart(); },
    openQuick(item) { this.openAdd(item, true); },
    closeQuick() { this.quickOpen = false; this.quickItem = null; this.destroyMap(); },
    setService(srv) {
      this.order.service = srv;
      if (srv === 'delivery') this.$nextTick(() => setTimeout(() => { this.initMap(); if (!this.pinSet && !this.gpsAsked) { this.gpsAsked = true; this.useGPS(true); } }, 80));
    },

    // ---------- PETA & ONGKIR ----------
    destroyMap() { if (this.map) { try { this.map.remove(); } catch (e) { } } this.map = null; this.marker = null; this.mapInited = false; },
    async initMap() {
      const el = document.getElementById('order-map');
      if (this.order.service !== 'delivery' || !el || this.mapInited) { if (this.map) this.map.invalidateSize(); return; }
      this.mapInited = true;
      try { await waitLeaflet(); } catch (e) { this.mapInited = false; el.innerHTML = '<p style="padding:20px;font-size:13px;color:#64748b">Peta gagal dimuat (cek internet). Gunakan tombol <b>Lokasi Saya</b>.</p>'; return; }
      if (!document.getElementById('order-map')) { this.mapInited = false; return; }
      const start = this.pinSet ? [this.pinLat, this.pinLng] : [this.restoLat, this.restoLng];
      this.map = L.map(el, { scrollWheelZoom: false, tap: true }).setView(start, this.pinSet ? 16 : 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(this.map);
      const restoIcon = L.divIcon({ className: '', html: '<div style="width:34px;height:34px;border-radius:11px;background:var(--dark);color:var(--primary);display:grid;place-items:center;box-shadow:0 6px 14px rgba(0,0,0,.35)"><i class="fa-solid fa-utensils"></i></div>', iconSize: [34, 34], iconAnchor: [17, 17] });
      const pinIcon = L.divIcon({ className: '', html: '<div style="font-size:38px;color:#ef4444;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));line-height:1"><i class="fa-solid fa-location-dot"></i></div>', iconSize: [30, 40], iconAnchor: [15, 38] });
      L.marker([this.restoLat, this.restoLng], { icon: restoIcon }).addTo(this.map).bindPopup(this.s.brand_name);
      this.marker = L.marker(start, { draggable: true, icon: pinIcon }).addTo(this.map);
      this.marker.on('dragend', (e) => { const p = e.target.getLatLng(); this.setPin(p.lat, p.lng); });
      this.map.on('click', (e) => this.setPin(e.latlng.lat, e.latlng.lng, true));
      [150, 450, 900].forEach(t => setTimeout(() => this.map && this.map.invalidateSize(), t));
    },
    setPin(lat, lng, moveMarker) {
      this.pinLat = lat; this.pinLng = lng; this.pinSet = true;
      this.distanceKm = Math.round(Math.max(0.3, jarakKm(this.restoLat, this.restoLng, lat, lng) * (Number(this.s.faktor_jalan) || 1.3)) * 10) / 10;
      if (moveMarker && this.marker) this.marker.setLatLng([lat, lng]);
      this.ckErr.pin = false;
    },
    useGPS(silent) {
      if (!('geolocation' in navigator)) { if (!silent) this.showToast('Perangkat tidak mendukung GPS. Ketuk titik di peta.', 'err'); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        this.setPin(lat, lng, true); if (this.map) this.map.setView([lat, lng], 16);
        this.showToast('Lokasi ditemukan · ongkir dihitung otomatis');
      }, () => { if (!silent) this.showToast('Izin lokasi ditolak. Ketuk titik rumah Anda di peta atau cari alamat.', 'err'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    },
    resetPin() { this.pinSet = false; this.distanceKm = 0; if (this.marker) this.marker.setLatLng([this.restoLat, this.restoLng]); if (this.map) this.map.setView([this.restoLat, this.restoLng], 14); },
    async searchPlace() {
      const q = this.mapQ.trim(); if (q.length < 3) { this.mapResults = []; return; }
      const la = this.restoLat, lo = this.restoLng, box = [lo - 0.4, la + 0.4, lo + 0.4, la - 0.4].join(',');
      try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&viewbox=' + box + '&bounded=1&q=' + encodeURIComponent(q)); this.mapResults = await r.json(); if (!this.mapResults.length) this.showToast('Tempat tidak ditemukan. Ketuk peta secara manual.'); }
      catch (e) { this.mapResults = []; this.showToast('Pencarian lokasi gagal. Ketuk titik di peta.', 'err'); }
    },
    pickPlace(p) { this.mapResults = []; this.mapQ = p.display_name.split(',').slice(0, 2).join(','); this.setPin(+p.lat, +p.lon, true); if (this.map) this.map.setView([+p.lat, +p.lon], 17); if (!this.order.address) this.order.address = this.mapQ; },

    // ---------- PEMBAYARAN ----------
    async pickBukti(e) { const f = e.target.files[0]; if (!f) return; try { this.bukti = await compressImage(f); } catch (err) { this.showToast(err.message, 'err'); } e.target.value = ''; },

    // ---------- PESAN ----------
    validateOrder() {
      const e = {}, hp = String(this.order.phone || '').replace(/[^0-9]/g, '');
      if (!this.order.name.trim()) e.name = 'Isi nama pemesan.';
      else if (!/^(0|62)?8\d{8,12}$/.test(hp)) e.phone = 'Isi nomor WhatsApp yang benar (contoh 0812xxxx).';
      else if (this.order.service === 'delivery' && !this.pinSet) e.pin = 'Tentukan titik lokasi pengiriman di peta.';
      else if (this.order.service === 'delivery' && this.shipError) e.pin = this.shipError;
      else if (this.order.service === 'delivery' && !this.order.address.trim()) e.address = 'Isi alamat / patokan pengiriman.';
      else if (this.minOrderShort > 0) e.min = 'Minimal belanja delivery Rp ' + this.fmt(this.s.min_order_delivery) + '.';
      else if ((this.order.pay === 'transfer' || this.order.pay === 'qris') && this.on(this.s.bukti_wajib) && !this.bukti) e.bukti = 'Unggah foto bukti pembayaran.';
      this.ckErr = e;
      const msg = Object.values(e)[0];
      if (msg) {
        this.showToast(msg, 'err');
        const sel = e.name ? '#ordName' : e.phone ? '#ordPhone' : e.address ? '#ordAddr' : e.pin ? '#order-map' : e.bukti ? '[data-testid="bukti-drop"]' : null;
        const el = sel && document.querySelector(sel); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.focus && el.tagName === 'INPUT') setTimeout(() => el.focus(), 300); }
      }
      return !msg;
    },
    waText(o) {
      let t = `*PESANAN #${o.id}*\n----------------------------------\n*Nama:* ${o.name}\n*No. WA:* ${o.phone}\n*Layanan:* ${this.serviceLabel(o.service)}${o.meja ? ' · Meja ' + o.meja : ''}${o.service === 'takeaway' ? ' · Ambil ' + o.waktuAmbil : ''}\n*Pembayaran:* ${this.payLabel(o.pay)}${o.statusBayar ? ' (' + o.statusBayar + ')' : ''}\n`;
      if (o.service === 'delivery') t += `*Alamat:* ${o.address}\n*Jarak:* ±${o.km} km\n*Peta:* https://maps.google.com/?q=${o.lat},${o.lng}\n`;
      t += `----------------------------------\n*DETAIL MENU:*\n`;
      o.items.forEach((it, i) => { t += `${i + 1}. ${it.name} (${it.qty}x) - Rp ${this.fmt(it.unit * it.qty)}\n`; if (it.variationName) t += `   - Ukuran: ${it.variationName}\n`; if (it.addonNames) t += `   - Extra: ${it.addonNames}\n`; if (it.note) t += `   - Catatan: ${it.note}\n`; });
      t += `----------------------------------\n*Subtotal:* Rp ${this.fmt(o.subtotal)}\n`;
      if (o.service === 'delivery') t += `*Ongkir:* ${o.ongkir ? 'Rp ' + this.fmt(o.ongkir) : 'Gratis'}\n`;
      if (o.pajak) t += `*Pajak & Layanan:* Rp ${this.fmt(o.pajak)}\n`;
      t += `*TOTAL:* Rp ${this.fmt(o.total)}\n`;
      if (o.note) t += `*Catatan:* ${o.note}\n`;
      return t + `----------------------------------\nMohon diproses. Terima kasih!`;
    },
    async placeOrder() {
      if (this.sending) return;
      if (!this.guardOpen() || !this.orderItems.length || !this.validateOrder()) return;
      const hp = String(this.order.phone).replace(/[^0-9]/g, '');
      const id = 'NR-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase();
      const items = this.orderItems.map(i => Object.assign({}, i));
      const o = { id, name: this.order.name.trim(), phone: hp, service: this.order.service, pay: this.order.pay, meja: this.order.service === 'dinein' ? this.order.meja : '',
        waktuAmbil: this.order.waktuAmbil, address: this.order.address, lat: this.pinLat.toFixed(6), lng: this.pinLng.toFixed(6), km: this.distanceKm.toFixed(1), note: this.order.note,
        items, subtotal: this.orderSubtotal, ongkir: this.shippingFee, pajak: this.orderTax, total: this.orderGrandTotal, estimasi: Number(this.s.estimasi_menit) || 0, statusBayar: '' };
      Core.Store.set('pembeli', { name: o.name, phone: this.order.phone });
      if (Core.GAS_URL) {
        this.sending = true;
        const r = await Core.api('orderCreate', { id, name: o.name, phone: hp, service: o.service, pay: o.pay, meja: o.meja, waktuAmbil: o.service === 'takeaway' ? o.waktuAmbil : '', address: o.address,
          lat: this.pinLat, lng: this.pinLng, note: o.note, bukti: (o.pay === 'transfer' || o.pay === 'qris') ? this.bukti : '', items: items.map(i => ({ id: i.id, qty: i.qty, v: i.v || 0, a: i.a || [], note: i.note || '' })) }, { reqId: 'ord-' + id });
        this.sending = false;
        if (!r.success) { this.showToast(r.message || 'Pesanan gagal dikirim. Coba lagi.', 'err'); if (r.data && r.data.code === 'TUTUP') { this.updateToko(); this.loadData(); } return; }
        Object.assign(o, { id: r.data.id, subtotal: r.data.subtotal, ongkir: r.data.ongkir, pajak: r.data.pajak, total: r.data.total, statusBayar: r.data.statusBayar, km: r.data.jarakKm || o.km });
        this.myOrders.unshift({ id: o.id, phone: hp, waktu: new Date().toISOString(), layanan: o.service, pembayaran: o.pay, total: o.total, items: items.map(i => ({ name: i.name, qty: i.qty })), status: 'Menunggu', statusBayar: o.statusBayar });
        this.myOrders = this.myOrders.slice(0, 30); Core.Store.set('my:orders', this.myOrders);
      } else o.offline = true;
      o.waUrl = this.waLink(this.waText(o));
      this.lastOrder = o;
      this.quickOpen = false; if (!this.quickItem) this.cart = []; this.quickItem = null; this.destroyMap(); this.bukti = ''; this.order.note = '';
      this.successOpen = true;
    },
    serviceLabel(s) { return ({ dinein: 'Dine-In (Makan di Tempat)', takeaway: 'Takeaway (Bawa Pulang)', delivery: 'Delivery (Antar ke Rumah)' })[s] || s || ''; },
    payLabel(p) { return ({ kasir: 'Bayar di Kasir', cod: 'COD (Bayar di Tempat)', transfer: 'Transfer Bank', qris: 'QRIS' })[p] || p; },

    // ---------- PESANAN SAYA ----------
    async openMyOrders(tab) {
      this.myTab = tab || (this.myOrders.length || !this.myResv.length ? 'order' : 'resv'); this.myOpen = true;
      if (!Core.GAS_URL || (!this.myOrders.length && !this.myResv.length)) return;
      this.myLoading = true;
      const [a, b] = await Promise.all([
        this.myOrders.length ? Core.api('orderTrack', { list: this.myOrders.map(o => ({ id: o.id, phone: o.phone })) }) : { success: true, data: [] },
        this.myResv.length ? Core.api('reservasiTrack', { list: this.myResv.map(r => ({ id: r.id, phone: r.phone })) }) : { success: true, data: [] }]);
      this.myLoading = false;
      if (a.success) { this.myOrders = this.myOrders.map(o => Object.assign({}, o, a.data.find(x => x.id === o.id) || {})); Core.Store.set('my:orders', this.myOrders); }
      if (b.success) { this.myResv = this.myResv.map(r => Object.assign({}, r, b.data.find(x => x.id === r.id) || {})); Core.Store.set('my:resv', this.myResv); }
      if (!a.success) this.showToast(a.message, 'err');
    },
    async uploadBuktiLater(o, e) {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const data = await compressImage(f); const r = await Core.api('orderBukti', { id: o.id, phone: o.phone, bukti: data });
        if (r.success) { o.statusBayar = r.data.statusBayar; Core.Store.set('my:orders', this.myOrders); this.showToast(r.message); } else this.showToast(r.message, 'err');
      } catch (err) { this.showToast(err.message, 'err'); }
    },
    forgetMine(kind, id) { if (kind === 'order') { this.myOrders = this.myOrders.filter(o => o.id !== id); Core.Store.set('my:orders', this.myOrders); } else { this.myResv = this.myResv.filter(r => r.id !== id); Core.Store.set('my:resv', this.myResv); } },

    // ---------- RESERVASI ----------
    openResv() {
      if (!this.on(this.s.reservasi_aktif)) return this.showToast('Reservasi online sedang tidak dibuka.', 'err');
      this.resvDone = null; this.rvErr = {}; this.resv.jam = '';
      if (!this.resv.tanggal || this.resv.tanggal < this.resvDates[0].v) { const d = this.resvDates.find(x => !x.libur); this.resv.tanggal = d ? d.v : this.resvDates[0].v; }
      this.resvOpen = true; this.loadSlots(true);
    },
    localSlots(tgl, orang) {
      const j = jamHari(this.s, tgl); if (!j) return { slots: [], alasan: 'Kami libur pada tanggal ini.' };
      const n = partsNow(this.s.zona_waktu, this.skew), dur = Number(this.s.reservasi_durasi) || 90, step = Number(this.s.reservasi_interval) || 30, lead = (Number(this.s.reservasi_min_jam) || 0) * 60, out = [];
      for (let m = j.b; m + dur <= j.t; m += step) { if (tgl === n.tgl && m < n.min + lead) continue; out.push({ jam: fmtMin(m), sisa: 40, cukup: orang <= (Number(this.s.reservasi_kapasitas) || 40) }); }
      return { slots: out, alasan: out.length ? '' : 'Tidak ada jam tersisa pada tanggal ini.' };
    },
    async loadSlots(autoNext) {
      const tgl = this.resv.tanggal; if (!tgl) return;
      this.slotsLoading = true; this.slotMsg = '';
      let d;
      if (Core.GAS_URL) { const r = await Core.api('reservasiSlots', { tanggal: tgl, orang: this.resv.orang }); d = r.success ? r.data : { slots: [], alasan: r.message }; }
      else d = this.localSlots(tgl, this.resv.orang);
      if (tgl !== this.resv.tanggal) return;
      if (autoNext && !(d.slots || []).some(x => x.cukup)) {   // hari ini sudah habis → langsung tawarkan tanggal berikutnya
        const nx = this.resvDates.find(x => x.v > tgl && !x.libur); if (nx) { this.resv.tanggal = nx.v; return this.loadSlots(false); }
      }
      this.slotsLoading = false; this.slots = d.slots || []; this.slotMsg = d.alasan || '';
      if (!this.slots.some(x => x.jam === this.resv.jam && x.cukup)) this.resv.jam = '';
    },
    async submitResv() {
      const e = {}, hp = String(this.resv.phone || '').replace(/[^0-9]/g, '');
      if (!this.resv.jam) return this.showToast('Pilih jam kedatangan.', 'err');
      if (!this.resv.name.trim()) e.name = 1; else if (!/^(0|62)?8\d{8,12}$/.test(hp)) e.phone = 1;
      this.rvErr = e; if (e.name || e.phone) return this.showToast(e.name ? 'Isi nama pemesan.' : 'Isi nomor WhatsApp yang benar.', 'err');
      Core.Store.set('pembeli', { name: this.resv.name, phone: this.resv.phone });
      let id = 'RSV-CONTOH';
      if (Core.GAS_URL) {
        this.sending = true;
        const r = await Core.api('reservasiCreate', { name: this.resv.name, phone: hp, tanggal: this.resv.tanggal, jam: this.resv.jam, orang: this.resv.orang, area: this.resv.area, note: this.resv.note });
        this.sending = false;
        if (!r.success) { this.showToast(r.message, 'err'); this.loadSlots(); return; }
        id = r.data.id;
        this.myResv.unshift({ id, phone: hp, tanggal: this.resv.tanggal, jam: this.resv.jam, orang: this.resv.orang, status: 'Menunggu' }); this.myResv = this.myResv.slice(0, 20); Core.Store.set('my:resv', this.myResv);
      }
      const txt = `*RESERVASI #${id}*\nNama: ${this.resv.name}\nWA: ${hp}\nTanggal: ${this.fmtTgl(this.resv.tanggal)}\nJam: ${this.resv.jam}\nTamu: ${this.resv.orang} orang${this.resv.area ? '\nArea: ' + this.resv.area : ''}${this.resv.note ? '\nCatatan: ' + this.resv.note : ''}`;
      this.resvDone = { id, tanggal: this.resv.tanggal, jam: this.resv.jam, orang: this.resv.orang, waUrl: this.waLink(txt) };
      this.resv.note = '';
    },

    scrollTo(sel) { const el = document.querySelector(sel); if (!el) return; if (window.__lenis) window.__lenis.scrollTo(el, { offset: -70 }); else el.scrollIntoView({ behavior: 'smooth' }); },
    onSwipeScroll(e) { const el = e.target, w = el.firstElementChild ? el.firstElementChild.offsetWidth : 300; this.swipeIndex = Math.round(el.scrollLeft / (w + 14)); }
  };
}
