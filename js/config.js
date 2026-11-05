/* =====================================================================
 *  KONFIGURASI — satu-satunya berkas yang PERLU Anda edit.
 *  (Berkas ini bebas diedit; tidak ikut disegel lisensi.)
 *
 *  1. Buka Apps Script → Deploy → Manage deployments → salin "Web app URL"
 *     (berakhiran /exec).
 *  2. Tempel di GAS_URL di bawah, simpan, lalu push ke GitHub Pages.
 *
 *  GAS_URL kosong  → web berjalan MODE CONTOH (data dummy di browser,
 *                    pesanan tetap diteruskan ke WhatsApp, dasbor demo).
 *
 *  Semua isi lain (nama usaha, warna, huruf, teks, foto, menu, nomor WA,
 *  ongkir) diatur dari Dasbor → Tampilan, BUKAN di sini.
 * ===================================================================== */
window.APP_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyk_i2CLlWGkNuYvaBNrEUJocq5CzhcgcLw8JzeBM8jvTL3GOGRk0M2GT2vwRB9ZnxN/exec',                 // contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
  CACHE_VERSION: 'v1'          // naikkan (v2, v3, …) bila ingin memaksa semua pengunjung memuat ulang data
};
