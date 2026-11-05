/* Data contoh bawaan — dipakai saat GAS_URL kosong (mode contoh) dan sebagai cadangan
 * bila server belum bisa dihubungi pada kunjungan pertama. Isi asli diatur dari Dasbor. */
window.DEMO_DATA = (function () {
  const u = (id, w) => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + (w || 700) + '&q=80';
  const V = a => a.map(x => ({ name: x[0], price: x[1] }));
  const settings = {
    brand_name: 'Nabire Resto', brand_sub: 'Papua Tengah', brand_icon: 'fa-solid fa-utensils', logo_url: '',
    meta_desc: 'Nabire Resto — Sajian modern khas Papua Tengah. Pesan cepat, antar tepat.',
    color_primary: '#ffc107', color_primary_deep: '#f2aa02', color_dark: '#0f172a', color_dark2: '#131c31', color_text: '#2b3a67', color_accent: '#c5a059', color_bg: '#f8fafc',
    radius: '22', font_body: 'Outfit', font_display: 'Playfair Display',
    hero_eyebrow: 'Dari Jantung Papua Tengah', hero_line1: 'Rasa yang', hero_line2: 'Membumi,', hero_line3: 'Sajian Modern.',
    hero_desc: 'Nabire Resto menghadirkan cita rasa nusantara & western favorit dengan bahan segar lokal — dipesan dalam hitungan detik, diantar hangat ke pintu Anda.',
    hero_image: u('photo-1504674900247-0877df9cc836', 1600), hero_btn1: 'Jelajahi Menu', hero_btn2: 'Kisah Kami',
    meta1_num: '4.9★', meta1_lbl: '1.2rb Ulasan', meta2_num: '25 mnt', meta2_lbl: 'Rata-rata Antar', meta3_num: '60+', meta3_lbl: 'Menu Pilihan',
    show_marquee: 'YA', marquee_text: 'Ayam Bakar Kecombrang|Nasi Kuning Papua|Ikan Kuah Kuning|Sate Manis Nabire|Es Buah Segar',
    menu_eyebrow: 'Daftar Sajian', menu_title: 'Pilih, Racik, Nikmati.', menu_desc: 'Semua hidangan dimasak sesuai pesanan. Sesuaikan porsi, level pedas, dan tambahan sesuai selera Anda.',
    show_filosofi: 'YA', filo_eyebrow: 'Filosofi Dapur', filo_title: 'Tiga Prinsip|Setiap Sajian.',
    filo1_title: 'Bahan Segar Lokal Papua', filo1_text: 'Kami memilih hasil bumi & laut segar dari pasar Nabire setiap pagi. Ikan, sayur, dan rempah dipilih tangan untuk memastikan rasa autentik yang tak tergantikan.',
    filo2_title: 'Dimasak Saat Dipesan', filo2_text: 'Tidak ada makanan yang menunggu. Setiap pesanan disiapkan on-demand oleh koki kami, sehingga tiba dalam kondisi hangat, renyah, dan penuh aroma.',
    filo3_title: 'Antar Cepat & Tepat', filo3_text: 'Dengan pemetaan langsung via GPS, ongkir dihitung transparan berdasar jarak nyata. Pesanan Anda dilacak dari dapur hingga ke tangan Anda.',
    show_cerita: 'YA', story_eyebrow: 'Kisah Kami', story_title: 'Warung Kecil yang Tumbuh Jadi Kebanggaan Kota.',
    story_desc: 'Berawal dari sebuah dapur keluarga di pesisir Nabire, kami tumbuh dengan satu keyakinan: makanan enak menyatukan orang. Kini Nabire Resto menyajikan perpaduan cita rasa Papua & favorit modern untuk ribuan pelanggan setia.',
    story_img_a: u('photo-1552566626-52f8b828add9', 900), story_img_b: u('photo-1414235077428-338989a2e8c0', 600), story_badge_num: '12+', story_badge_lbl: 'Tahun Melayani',
    stat1_num: '60+', stat1_lbl: 'Menu Signature', stat2_num: '98%', stat2_lbl: 'Pelanggan Puas', stat3_num: '25 mnt', stat3_lbl: 'Antar Rata-rata',
    about_title: 'Tentang Nabire Resto', about_img: u('photo-1517248135467-4c7edcad34c4', 900),
    about_desc: 'Nabire Resto lahir dari kecintaan pada kekayaan rasa Papua Tengah. Kami memadukan resep warisan keluarga dengan sentuhan modern, menyajikan hidangan hangat berbahan segar lokal langsung dari pasar Nabire.',
    about_points: '100% Bahan Segar Lokal|Dimasak Saat Dipesan|Antar Cepat se-Nabire',
    address: 'Jl. Merdeka No. 17, Nabire, Papua Tengah', hours: '09.00 – 22.00 WIT', email: 'halo@nabireresto.id', wa_number: '6282121210694',
    instagram: '', facebook: '', tiktok: '', footer_text: 'Dibuat dengan sepenuh hati di Papua.',
    resto_lat: '-3.36654', resto_lng: '135.49653', ongkir_dasar: '10000', ongkir_per_km: '3000', pajak_persen: '5',
    layanan_aktif: 'dinein,takeaway,delivery', bayar_aktif: 'kasir,cod,transfer,qris', info_transfer: 'BRI 0000-01-000000-50-0 a.n. Nabire Resto', qris_image: '', terima_pesanan: 'YA',
    mode_toko: 'otomatis', pesan_tutup: 'Mohon maaf, kami sedang tutup. Silakan pesan kembali saat jam buka.', zona_waktu: 'Asia/Jayapura', tanggal_libur: '', batas_pesan_menit: '15',
    jadwal_json: '{"0":{"libur":false,"buka":"10:00","tutup":"22:00"},"1":{"libur":false,"buka":"09:00","tutup":"22:00"},"2":{"libur":false,"buka":"09:00","tutup":"22:00"},"3":{"libur":false,"buka":"09:00","tutup":"22:00"},"4":{"libur":false,"buka":"09:00","tutup":"22:00"},"5":{"libur":false,"buka":"09:00","tutup":"22:30"},"6":{"libur":false,"buka":"09:00","tutup":"22:30"}}',
    rekening_json: '[{"bank":"BRI","nomor":"0000-01-000000-50-0","nama":"Nabire Resto"},{"bank":"BCA","nomor":"1234567890","nama":"Nabire Resto"}]', bukti_wajib: 'TIDAK',
    ongkir_km_dasar: '2', ongkir_max_km: '15', ongkir_gratis_min: '0', faktor_jalan: '1.3', min_order_delivery: '0', estimasi_menit: '25',
    reservasi_aktif: 'YA', reservasi_kapasitas: '40', reservasi_durasi: '90', reservasi_interval: '30', reservasi_hari_maks: '30', reservasi_min_jam: '2', reservasi_maks_orang: '20',
    reservasi_info: 'Meja ditahan 15 menit dari jam reservasi. Untuk rombongan > 20 orang, hubungi kami via WhatsApp.'
  };
  const meja = [['M1', 2, 'Indoor'], ['M2', 4, 'Indoor'], ['M3', 4, 'Indoor'], ['M4', 6, 'Indoor'], ['T1', 4, 'Teras'], ['T2', 4, 'Teras'], ['V1', 10, 'VIP']].map(m => ({ nama: m[0], kapasitas: m[1], area: m[2] }));
  const categories = [
    { id: 'signature', name: 'Signature', icon: 'fa-solid fa-crown' }, { id: 'ayam', name: 'Ayam', icon: 'fa-solid fa-drumstick-bite' },
    { id: 'nasi', name: 'Nasi & Ikan', icon: 'fa-solid fa-fish' }, { id: 'burger', name: 'Burger', icon: 'fa-solid fa-burger' },
    { id: 'minuman', name: 'Minuman', icon: 'fa-solid fa-mug-hot' }, { id: 'dessert', name: 'Dessert', icon: 'fa-solid fa-ice-cream' }
  ];
  const M = [
    ['D01', 'signature', 'Ayam Bakar Kecombrang', 'Best Seller', 4.9, 820, 45000, 'Ayam kampung dibakar bumbu kecombrang khas, dipadu sambal matah segar dan nasi hangat.', 'photo-1598515214211-89d3c73ae83b', [['Setengah Ekor', 0], ['Satu Ekor', 28000]], [['Extra Sambal Matah', 5000], ['Nasi Tambah', 6000], ['Lalapan', 4000]]],
    ['D02', 'nasi', 'Ikan Kuah Kuning Papua', 'Khas Papua', 4.9, 610, 52000, 'Ikan laut segar dimasak kuah kuning rempah, disajikan dengan nasi dan sayur bunga pepaya.', 'photo-1580476262798-bddd9f4b7369', [['Porsi Reguler', 0], ['Porsi Jumbo', 15000]], [['Sambal Colo-colo', 5000], ['Papeda Kecil', 10000]]],
    ['D03', 'signature', 'Nasi Kuning Spesial', 'Favorit', 4.8, 940, 38000, 'Nasi kuning pulen komplet ayam suwir, telur balado, dan kering tempe renyah.', 'photo-1603133872878-684f208fb84b', [['Reguler', 0], ['Komplet Plus', 12000]], [['Ayam Suwir Extra', 8000], ['Kerupuk', 3000]]],
    ['D04', 'ayam', 'Ayam Geprek Sambal Ijo', 'Pedas', 4.8, 1120, 32000, 'Ayam crispy digeprek dengan sambal ijo pedas menggigit dan nasi hangat.', 'photo-1626645738196-c2a7c87a8f58', [['Level 1-3', 0], ['Level 4-5 (Extra Pedas)', 0]], [['Keju Mozarella', 9000], ['Telur Ceplok', 5000]]],
    ['D05', 'ayam', 'Ayam Krispi Madu', 'Manis Gurih', 4.7, 730, 36000, 'Potongan ayam krispi disiram saus madu, renyah di luar juicy di dalam.', 'photo-1562967914-608f82629710', [['5 Pcs', 0], ['8 Pcs', 18000]], [['Saus Extra', 4000], ['Kentang Goreng', 12000]]],
    ['D06', 'burger', 'Nabire Beef Burger', 'Signature', 4.8, 560, 42000, 'Patty daging sapi tebal, keju leleh, sayur segar, dan saus spesial rumahan.', 'photo-1568901346375-23c9450c58cd', [['Single Patty', 0], ['Double Patty', 20000]], [['Extra Keju', 7000], ['Smoked Beef', 12000], ['Kentang Goreng', 12000]]],
    ['D07', 'burger', 'Crispy Chicken Burger', 'Renyah', 4.6, 480, 38000, 'Ayam fillet krispi, mayo pedas, dan selada segar dalam roti brioche lembut.', 'photo-1615297928064-24977384d0da', [['Reguler', 0], ['Spicy Deluxe', 8000]], [['Extra Patty', 15000], ['Onion Ring', 10000]]],
    ['D08', 'nasi', 'Nasi Goreng Kampung', 'Klasik', 4.7, 990, 30000, 'Nasi goreng smoky wangi dengan telur, ayam, dan acar segar.', 'photo-1512058564366-18510be2db19', [['Reguler', 0], ['Seafood', 15000]], [['Telur Mata Sapi', 5000], ['Sate Ayam 3pcs', 15000]]],
    ['D09', 'minuman', 'Es Buah Segar Nabire', 'Segar', 4.9, 1340, 22000, 'Aneka buah tropis segar dengan sirup selasih dan santan lembut.', 'photo-1600271886742-f049cd451bba', [['Reguler', 0], ['Jumbo', 8000]], [['Extra Susu', 4000], ['Nata de Coco', 4000]]],
    ['D10', 'minuman', 'Kopi Susu Gula Aren', 'Signature', 4.8, 1560, 24000, 'Espresso lokal dengan susu segar dan gula aren asli, disajikan dingin.', 'photo-1517701604599-bb29b565090c', [['Dingin', 0], ['Panas', 0]], [['Extra Shot Espresso', 6000], ['Jelly', 4000]]],
    ['D11', 'dessert', 'Pisang Goreng Keju', 'Manis', 4.7, 450, 20000, 'Pisang raja goreng renyah dengan taburan keju dan susu kental manis.', 'photo-1606313564200-e75d5e30476c', [['Reguler', 0], ['Jumbo', 8000]], [['Cokelat', 4000], ['Es Krim Vanila', 8000]]]
  ];
  const menu = M.map(m => ({ id: m[0], cat: m[1], name: m[2], tag: m[3], rating: m[4], sold: m[5], price: m[6], desc: m[7], img: u(m[8]), variations: V(m[9]), addons: V(m[10]) }));
  return { settings, categories, menu, meja, demo: true };
})();
