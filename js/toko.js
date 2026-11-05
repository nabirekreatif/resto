/* =====================================================================
 *  toko.js — jam buka/tutup & jarak, dipakai web publik dan dasbor.
 *  Rumusnya sama persis dengan statusToko_() di backend (Operasional.gs).
 * ===================================================================== */
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
// ---------- waktu resto (zona waktu dari dasbor) ----------
function partsNow(tz, skew) {
  const d = new Date(Date.now() + (skew || 0));
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Jayapura', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const g = t => (f.find(p => p.type === t) || {}).value;
    const tgl = g('year') + '-' + g('month') + '-' + g('day');
    return { tgl, dow: new Date(tgl + 'T00:00:00Z').getUTCDay(), min: (+g('hour')) * 60 + (+g('minute')) };
  } catch (e) { const tgl = d.toISOString().slice(0, 10); return { tgl, dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() }; }
}
const toMin = h => { const m = String(h || '').match(/^(\d{1,2})[:.](\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
const fmtMin = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const addDays = (t, n) => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = t => new Date(t + 'T00:00:00Z').getUTCDay();
function jadwalOf(s) { let j = {}; try { j = JSON.parse(s.jadwal_json || '{}'); } catch (e) { } const o = {}; for (let i = 0; i < 7; i++) { const x = j[i] || {}; o[i] = { libur: !!x.libur, buka: x.buka || '09:00', tutup: x.tutup || '22:00' }; } return o; }
function jamHari(s, tgl) {
  if (String(s.tanggal_libur || '').split(/[,\s]+/).indexOf(tgl) > -1) return null;
  const d = jadwalOf(s)[dowOf(tgl)]; if (d.libur) return null;
  const b = toMin(d.buka); let t = toMin(d.tutup); if (b < 0 || t < 0) return null; if (t <= b) t += 1440; return { b, t };
}
/** Sama persis dengan statusToko_() di server (Operasional.gs). */
function statusToko(s, skew) {
  const mode = s.mode_toko || 'otomatis', n = partsNow(s.zona_waktu, skew), batas = Number(s.batas_pesan_menit) || 0;
  if (s.terima_pesanan === 'TIDAK' && mode === 'otomatis') return { buka: false, bisaPesan: false, label: 'Tutup', info: s.pesan_tutup };
  if (mode === 'buka') return { buka: true, bisaPesan: true, label: 'Buka', info: 'Kami sedang buka' };
  if (mode === 'tutup') return { buka: false, bisaPesan: false, label: 'Tutup', info: s.pesan_tutup || 'Kami sedang tutup' };
  let sampai = -1; const kmr = jamHari(s, addDays(n.tgl, -1)), hr = jamHari(s, n.tgl);
  if (kmr && kmr.t > 1440 && n.min < kmr.t - 1440) sampai = kmr.t - 1440; else if (hr && n.min >= hr.b && n.min < hr.t) sampai = hr.t;
  if (sampai > -1) { const sisa = sampai - n.min; return { buka: true, bisaPesan: sisa > batas, label: 'Buka', sampai: fmtMin(sampai), info: sisa > batas ? 'Buka sampai pukul ' + fmtMin(sampai) : 'Pesanan online ditutup ' + batas + ' menit sebelum tutup (' + fmtMin(sampai) + ')' }; }
  for (let i = 0; i < 8; i++) { const tg = addDays(n.tgl, i), j = jamHari(s, tg); if (j && (i > 0 || j.b > n.min)) { const h = i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : HARI[dowOf(tg)]; return { buka: false, bisaPesan: false, label: 'Tutup', bukaLagi: h + ' ' + fmtMin(j.b), info: 'Buka lagi ' + h.toLowerCase() + ' pukul ' + fmtMin(j.b) }; } }
  return { buka: false, bisaPesan: false, label: 'Tutup', info: s.pesan_tutup };
}
function jarakKm(a, b, c, d) { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
