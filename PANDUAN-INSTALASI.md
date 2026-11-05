# 📋 Panduan Instalasi — Nabire Resto v2 (Web Pesan + Reservasi + Dasbor)

Web publik (menu, keranjang, pesan via WhatsApp, peta ongkir) + dasbor pemilik (ringkasan, pesanan, menu, tampilan/tema, pelanggan/CRM, notifikasi WhatsApp, migrasi data, pengguna).
**Backend:** Google Apps Script + Google Sheets + Google Drive. **Frontend:** GitHub Pages.

---

## 0. Isi paket

| Berkas | Untuk apa | Cara pakai |
|---|---|---|
| `Kode.gs` | Inti backend (API, menu, pesanan, tema, login, data contoh, reset) | Salin-tempel ke Apps Script |
| `Notifikasi.gs` | WhatsApp (Fonnte) + Email, blast per batch | Salin-tempel ke Apps Script |
| `CRM.gs` | Daftar kontak pelanggan (Nama · Email · WA) | Salin-tempel ke Apps Script |
| `Migrasi.gs` | Pindah data dari app lama | Salin-tempel ke Apps Script |
| `Operasional.gs` | Jam buka/tutup, reservasi meja, meja, ongkir, bukti bayar, lacak pesanan | Salin-tempel ke Apps Script |
| `appsscript.json` | Izin (scope) & zona waktu | Salin-tempel ke manifest |
| `nabire-resto-frontend.zip` | Web publik + dasbor | Ekstrak → push ke GitHub Pages |

> Isi ZIP: `index.html` (web publik), `admin.html` (dasbor), folder `css/` dan `js/`. **Folder hasil ekstraksi inilah yang di-`git init`** — jangan masuk lebih dalam, jangan naik satu level.

---

## 1. Pasang backend (Google Apps Script) — ±10 menit

1. Buka **https://script.google.com** → **Proyek baru**. Beri nama, mis. `Nabire Resto API`.
2. Ganti isi `Code.gs` dengan seluruh isi **`Kode.gs`** (boleh ubah nama berkas jadi `Kode`).
3. Klik **＋ → Skrip** empat kali, buat berkas `Notifikasi`, `CRM`, `Migrasi`, `Operasional`, lalu tempel isinya masing-masing.
4. **Project Settings (⚙️)** → centang **Show "appsscript.json" manifest file** → kembali ke Editor → buka `appsscript.json` → ganti seluruh isinya dengan berkas `appsscript.json` dari paket.
5. Pilih fungsi **`setupAppEnvironment`** di dropdown → **▶ Jalankan** → izinkan akses (Review permissions → pilih akun → Advanced → Go to … → Allow).
6. Buka **Eksekusi → Log**. Anda akan melihat:
   - link Spreadsheet & folder Drive yang baru dibuat,
   - **👤 Username: `superadmin`** dan **🔑 Password sementara: `XXXX-XXXX-XXXX`** → catat (jangan kirim lewat chat/grup).
7. **Deploy → New deployment → ⚙️ Web app**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - **Deploy** → salin **Web app URL** (berakhiran `/exec`).

> ⚠️ `setupAppEnvironment()` aman dijalankan ulang (tidak membuat data ganda), tapi cukup sekali.

---

## 2. Pasang web (GitHub Pages)

1. Ekstrak `nabire-resto-frontend.zip`. Buka folder hasil ekstrak — di dalamnya **harus langsung terlihat `index.html`, `admin.html`, `css`, `js`**.
2. Buka `js/config.js` dengan Notepad → isi:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
   Simpan. *(Hanya berkas ini yang perlu Anda edit. Semua isi lain diatur dari dasbor.)*
3. Buat repository **Public** baru di github.com (jangan centang README).
4. Di folder tadi (yang berisi `index.html`), buka terminal lalu jalankan **satu per satu**:
   ```bash
   git init
   git add .
   git commit -m "Upload pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (github.com/settings/tokens → *classic* → centang **repo**). Layar memang tidak menampilkan karakter apa pun saat menempel — itu normal.
5. Repo → **Settings → Pages** → *Deploy from a branch* → **main / (root)** → Save → centang **Enforce HTTPS**.
6. Tunggu 1–2 menit. Web Anda: `https://USERNAME.github.io/NAMA-REPO/`
   Dasbor: `https://USERNAME.github.io/NAMA-REPO/admin.html`

**Update berikutnya:** `git add .` → `git commit -m "update"` → `git push`. Kalau masih tampil versi lama: **Ctrl+Shift+R**.

> 💡 Sebelum `GAS_URL` diisi, web berjalan **mode contoh** (data dummy) dan dasbor bisa dicoba dengan klik *Masuk* — cocok untuk demo ke klien.

---

## 2b. Sudah memasang versi 1? (upgrade ke v2)

1. Di Apps Script, **ganti isi** `Kode.gs`, `Notifikasi.gs`, `CRM.gs`, `Migrasi.gs` dengan versi baru dan **tambah** berkas `Operasional`.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (URL `/exec` tetap sama).
3. Kolom & sheet baru (`Reservasi`, `Meja`, kolom pembayaran di `Pesanan`) **dibuat otomatis** saat web pertama kali dibuka. Data lama tetap aman.
4. Ganti folder web di GitHub dengan isi ZIP baru (kecuali `js/config.js` milik Anda) → `git add .` → `git commit -m "v2"` → `git push`.
5. Ingin meja & reservasi contoh juga muncul? Jalankan `resetDataContoh` (data asli tidak tersentuh).

---

## 3. Masuk dasbor pertama kali

1. Buka `…/admin.html` → username **`superadmin`**, password = password sementara dari Log.
2. Anda diminta membuat **password baru** (min. 10 karakter, huruf + angka).
3. Selesai. Sesi tersimpan 7 hari di perangkat itu; dasbor terbuka **instan** pada kunjungan berikutnya.

### Peran pengguna (menu **Pengguna**)
| Peran | Bisa |
|---|---|
| **Superadmin** | Semua, termasuk Tampilan, Pengguna, Migrasi, konfigurasi WhatsApp, data contoh |
| **Admin** | Ringkasan, Pesanan, Menu (penuh), Pelanggan/CRM, Blast WhatsApp |
| **Kasir** | Ringkasan, Pesanan (termasuk verifikasi bayar), Reservasi, tandai menu habis/tersedia |

---

## 4. Mengatur tampilan (tema) — menu **Tampilan**

Semua bagian halaman publik bisa diedit **dengan pratinjau langsung** di sebelah kanan (di HP: tombol *Pratinjau*):

- **Merek & Logo:** nama usaha, teks kecil, logo (unggah) atau ikon.
- **Warna & Huruf:** 6 palet siap pakai (Emas Nabire, Alam, Terakota, Laut Papua, Korporat, Merah Cabai) atau atur warna satu per satu; huruf judul & isi; kelengkungan sudut kartu.
- **Hero:** foto latar, 3 baris judul, deskripsi, tombol, 3 angka unggulan.
- **Pita berjalan, Menu, Filosofi, Cerita, Tentang Kami:** semua teks & foto; tiap bagian bisa disembunyikan.
- **Kontak & Footer:** nomor WhatsApp penerima pesanan, alamat, jam buka, media sosial.
Klik **Simpan** → pengunjung melihat versi baru dalam ±30 detik.

**Foto:** tombol **Unggah foto** mengecilkan foto otomatis di HP/laptop lalu menyimpannya ke folder `📂 Uploads` di Google Drive Anda.

---

## 4b. Jam & Operasional (buka/tutup otomatis, pembayaran, ongkir, reservasi)

Menu **Jam & Operasional** (peran Admin ke atas):

- **Status toko:** *Otomatis* (ikut jadwal) · *Buka manual* · *Tutup / Libur*. Saat tutup, semua tombol pesan di web nonaktif, muncul banner + pesan tutup Anda, dan server **menolak** pesanan baru. Tombol cepat yang sama ada di **Ringkasan**.
- **Jadwal mingguan:** saklar buka/libur + jam buka–tutup per hari (boleh lewat tengah malam, mis. 17:00–02:00). Pesanan online ditutup otomatis N menit sebelum jam tutup.
- **Tanggal libur khusus** (mis. Idulfitri, Natal).
- **Pembayaran:** layanan aktif, metode bayar, **daftar rekening** (bank · nomor · atas nama, bisa lebih dari satu), gambar **QRIS**, opsi *bukti wajib diunggah*.
- **Ongkir:** ongkir dasar + km yang sudah termasuk + per km berikutnya, jarak maksimal, gratis ongkir di atas belanja tertentu, minimal belanja delivery, faktor jalan, pajak. Kalkulator contoh ongkir tampil langsung. Isi **koordinat resto** (tombol *Lokasi saya* saat di resto).
- **Reservasi:** buka/tutup reservasi online, kapasitas kursi per jam, maks orang, lama reservasi, interval jam, berapa hari ke depan, minimal berapa jam sebelumnya, catatan di form.

## 4c. Alur pesanan di web (seperti aplikasi resto)

1. Pelanggan memilih menu → ukuran & tambahan → **Keranjang** atau **Pesan** langsung.
2. Checkout 5 langkah: **Pesanan** (ubah jumlah) → **Data** (nama + WhatsApp wajib) → **Layanan**:
   - *Dine-In*: pilih meja (dari daftar meja) atau "pilih di tempat";
   - *Takeaway*: pilih waktu ambil (secepatnya / jam tertentu hari ini);
   - *Delivery*: **peta** — ketuk titik rumah, geser pin, cari nama jalan/tempat, atau *Lokasi Saya*; **ongkir dihitung otomatis** + alamat/patokan;
   → **Pembayaran** (kasir/COD sesuai layanan, *Transfer* menampilkan rekening + tombol salin, *QRIS* menampilkan kode; **unggah foto bukti**) → **Catatan**.
3. **Buat Pesanan** → pesanan masuk ke sistem (total & ongkir dihitung ulang server) → layar sukses berisi **kode pesanan**, tombol **Kirim detail ke WhatsApp Resto**, dan **Lacak pesanan**.
4. Ikon 🧾 di navbar = **Pesanan Saya**: status (Menunggu → Diproses → Siap/Diantar → Selesai), status bayar, unggah bukti susulan, dan riwayat reservasi.

> ℹ️ Tombol *Lokasi Saya* (GPS) hanya berfungsi di alamat **https** (GitHub Pages). Bila membuka `index.html` langsung dari folder komputer (`file://`), browser memblokir GPS — gunakan ketuk peta / cari tempat.

## 4d. Reservasi meja

- Web: tombol **Reservasi Meja** (hero, navbar, bagian Reservasi) → jumlah tamu → tanggal → **jam yang masih tersedia** (otomatis memperhitungkan jam buka, kapasitas, dan reservasi lain) → area → nama & WA → kirim.
- Dasbor **Reservasi**: filter *Hari ini / Mendatang / Perlu konfirmasi*, tombol **Konfirmasi** (pilih meja), **Tolak**, **Tamu datang**, **Selesai**, **Batalkan**, chat WA. Tab **Daftar Meja** untuk menambah/mengubah meja (nama, kapasitas, area).
- Notifikasi WA otomatis (bila diaktifkan): reservasi diterima, reservasi baru ke admin, dikonfirmasi (dengan nomor meja), ditolak/dibatalkan.

## 5. Menu & pesanan

- **Menu → Tambah menu:** foto, nama, kategori, harga, deskripsi, label (Best Seller), pilihan ukuran (+harga) dan tambahan.
- Saklar **Tersedia/Habis** di tiap kartu menyembunyikan menu seketika (kasir juga bisa).
- **Kategori:** tambah, ubah ikon, urutkan (panah), sembunyikan.
- **Pesanan:** pesanan baru muncul otomatis (bunyi + notifikasi) saat dasbor terbuka. Tombol **Proses → Siap/Antar → Selesai** atau **Batalkan**. Detail berisi tombol *Chat pelanggan* dan *Buka peta*.
- Harga di pesanan **dihitung ulang oleh server** dari harga menu — pelanggan tidak bisa mengakali harga dari browser. Ongkir juga dihitung server dari titik peta.
- **Verifikasi bayar:** chip *Verifikasi bayar* menampilkan pesanan transfer/QRIS yang sudah mengirim bukti. Buka pesanan → lihat foto bukti → **Tandai lunas** / **Tolak bukti** (alasan dikirim ke pelanggan). Foto bukti tersimpan di Drive folder `📂 Bukti Bayar` (akses lewat link, hanya Anda yang tahu tautannya).

---

## 6. Notifikasi WhatsApp & Email — menu **WhatsApp**

### Siapkan Fonnte (sekali)
1. Daftar di **fonnte.com** → **Device** → tambah nomor WA usaha → scan QR.
2. Salin **token** → dasbor **WhatsApp → Konfigurasi** → tempel di *Token Fonnte*.
3. Klik **Cek perangkat** (harus `connect`) → isi nomor Anda → **Kirim tes WA**.
4. Isi **Nomor WA admin** (penerima "pesanan baru") → nyalakan saklar **Notifikasi WhatsApp** → **Simpan**.

### Notifikasi otomatis per kejadian
Tabel *Notifikasi otomatis per kejadian* — atur WA/Email untuk tiap kejadian dan ubah isi pesannya:
`Pesanan diterima (ke pelanggan)` · `Pesanan baru masuk (ke admin)` · `Diproses` · `Siap/Diantar` · `Selesai` · `Dibatalkan` · `Pembayaran lunas` · `Bukti ditolak` · `Reservasi diterima` · `Reservasi baru (ke admin)` · `Reservasi dikonfirmasi` · `Reservasi ditolak`.

### Blast per batch
1. **Blast WhatsApp → Muat penerima** (dari CRM atau tempel manual) → **Deteksi nomor WA** (opsional).
2. Tulis pesan (sisip `{nama}`, `{institusi}`, `{link}`) — lihat pratinjau gelembung WA.
3. Pilih batch **10 / 20 / 50** dan jeda (mis. `3-8` detik acak) → **Mulai Blast**.
4. Server mengirim 1 batch per menit **walau halaman ditutup**; atau klik **Kirim batch berikutnya sekarang** / nyalakan **Otomatis**. Bisa **Hentikan** kapan saja.

**Tips anti-blokir WhatsApp:** pakai nomor yang sudah lama aktif, mulai batch 10, jeda acak ≥5 detik, jangan kirim link yang sama ke ratusan orang dalam 1 jam, tambahkan "Balas STOP untuk berhenti".

**Email:** nyalakan saklar Email + **Kirim tes email**. Kuota Gmail biasa ±100 email/hari (Workspace ±1.500).

---

## 7. Pelanggan (CRM)

- Setiap pemesan yang mengisi nomor WA otomatis masuk CRM (sinkron otomatis tiap 30 menit, atau **Sinkron** manual).
- Kartu KPI bisa diklik untuk menyaring: WA terverifikasi, opt-out, perlu dirapikan (duplikat/tanpa kontak).
- Pilih beberapa kontak → **Deteksi WA · Beri tag · Blast · Opt-out**.
- Klik kontak → ubah data, tag, catatan, **opt-out** (tidak ikut blast promosi), catat interaksi (telepon/kunjungan), lihat riwayat pesanan & pesan terkirim.
- **Import CSV** (unduh *Template* dulu) untuk kontak dari luar; **Ekspor** (superadmin).

---

## 8. Migrasi dari app lama — menu **Migrasi Data**

1. Tempel URL spreadsheet app lama (harus milik **akun Google yang sama** dengan backend ini).
2. Centang data yang dipindah → **Pindai (uji coba)** → periksa angka *Ditambah / Diperbarui / Dilewati* dan peringatan.
3. **Jalankan import.** Spreadsheet lama hanya dibaca, tidak diubah. Aman diulang (tidak ada data ganda).
4. **Cutover:** tepat sebelum pindah alamat, **jalankan import sekali lagi** untuk menangkap data baru, lalu umumkan alamat baru lewat blast WA.

Juga tersedia **Import menu dari CSV/Excel** (kolom `nama, kategori, harga, deskripsi, gambar, tag`).
Batasan: sesi login lama tidak ikut pindah; akun superadmin lama tidak diimpor.

---

## 9. 🔄 Reset data contoh & reset password superadmin (lewat backend)

Fungsi-fungsi ini **sengaja hanya bisa dijalankan dari editor Apps Script oleh pemilik** — tidak bisa dipanggil dari internet.

| Situasi | Langkah |
|---|---|
| **Lupa password superadmin** | Apps Script → pilih **`resetPasswordSuperadmin`** → ▶ Jalankan → buka **Eksekusi → Log** → pakai password sementara → login → buat password baru. Semua sesi lama otomatis keluar. |
| Ingin memilih password sendiri | ⚙️ Project Settings → **Script Properties** → tambah `SA_NEW_PASSWORD` = password pilihan → jalankan **`setPasswordSuperadminDariProperty`** (properti otomatis dihapus). |
| Login terkunci (5× salah) | Tunggu 15 menit, atau jalankan **`bukaKunciLogin`**. |
| Muat ulang data contoh (menu, pesanan, pelanggan, **meja, reservasi**) | Jalankan **`resetDataContoh`**, atau dasbor → Pengaturan → *Muat ulang data contoh* (ketik `RESET`). |
| Hapus semua data contoh sebelum tayang | Jalankan **`hapusDataContoh`**, atau dasbor → Pengaturan → *Hapus semua data contoh* (ketik `HAPUS`). |
| Trigger notifikasi hilang | Jalankan **`pasangTrigger`**. |

Data contoh ditandai `is_demo = TRUE` — **data asli Anda tidak pernah ikut terhapus**. Selama masih ada data contoh, halaman publik menampilkan label kecil "Mode contoh".

---

## 10. 🔐 Lisensi template (Nabire Kreatif)

- Menu **Lisensi** sudah tersedia di sidebar dasbor dan di Pengaturan; di web publik lewat `domain-anda.com/#key` atau tautan kecil *Aktifkan lisensi* di footer.
- Slot hak cipta (`data-nk-copy`) sudah ada di footer web publik dan di sidebar dasbor.
- `js/config.js` **tidak disegel** — URL backend tetap bebas diedit.
- Penyegelan dijalankan penjual dengan `nk-protect.js` + `nk-license.js` dari Admin Nabire Kreatif. Setelah template diedit lagi, jalankan ulang `nk-protect.js`.

---

## 11. Setiap kali mengubah kode backend

**Deploy → Manage deployments → ✏️ Edit → Version: *New version* → Deploy.**
Jangan pilih *New deployment* — itu membuat URL `/exec` baru dan web berhenti tersambung.

---

## 12. Kalau ada masalah

| Gejala | Penyebab & solusi |
|---|---|
| Label "Mode contoh" & data dummy terus | `GAS_URL` di `js/config.js` belum diisi / salah. |
| "Server membalas halaman bukan data" | Deploy belum *Anyone*, atau lupa *New version* setelah ubah kode. |
| "Backend belum disiapkan" | `setupAppEnvironment` belum dijalankan. |
| Situs 404 | `git init` dijalankan di folder yang salah — `index.html` harus terlihat di akar repo. |
| WA tidak terkirim | Cek perangkat Fonnte `connect`, token benar, saklar WA aktif, trigger aktif (Konfigurasi). Lihat tab *Antrean & Riwayat*. |
| Foto tidak tampil | Pakai tombol *Unggah foto* (otomatis dibagikan publik). Untuk link Drive manual, berkas harus "Siapa saja yang memiliki link". |
| Dasbor terasa lambat pertama kali pagi hari | Server Google "tidur" (cold start 1–4 dtk). Setelah itu cepat; data selalu tampil dari cache dulu. |
| Ingin melihat kecepatan | Dasbor → Pengaturan → *Lihat kecepatan*, atau ketik `Perf.table()` di Console browser. |

---

## 13. Batasan yang perlu diketahui

- Pengiriman WA bergantung status perangkat & paket Fonnte; balasan WA masuk tidak tercatat (perlu webhook terpisah).
- Pesanan tetap diteruskan ke WhatsApp seperti desain asli; pencatatan ke Sheets berjalan di latar (bila internet pelanggan putus tepat saat itu, pesanan WA tetap terkirim dan sistem mencoba ulang otomatis).
- Kuota Google gratis: ±20.000 panggilan URL/hari, email ±100/hari — cukup untuk resto UMKM.
- Gambar contoh memakai Unsplash; ganti dengan foto asli lewat dasbor sebelum tayang.
