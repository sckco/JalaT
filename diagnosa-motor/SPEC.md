# Spesifikasi Sistem Diagnosa Kerusakan Motor (CBR)

## 1. Tujuan
Membangun aplikasi web diagnosa awal kerusakan sepeda motor berbasis metode *Case-Based Reasoning* (CBR) dengan algoritma *Nearest Neighbor*. Sistem menghitung tingkat kemiripan gejala yang dipilih pengguna terhadap basis kasus kerusakan yang tersimpan di memori lokal aplikasi.

## 2. Pengguna
* **Pengendara / Pemilik Motor:** Memilih gejala yang dirasakan pada kendaraan untuk melihat peringkat kemungkinan kerusakan dan saran pengecekan awal.
* **Mekanik / Penyusun Basis Kasus:** Meninjau bobot gejala, relasi kasus-gejala, serta menyesuaikan data kasus di kode/konfigurasi lokal.

## 3. Daftar Fitur
* **Pemilihan Gejala (`G01`–`G10`):** Pengguna dapat mencentang satu atau beberapa kode/deskripsi gejala yang dialami.
* **Perhitungan *Similarity* (*Nearest Neighbor*):** Menghitung skor kemiripan antara input pengguna ($T$) dan setiap kasus pada basis kasus ($S$) menggunakan bobot ($w_i$).
* **Peringkat Hasil & Detail Perhitungan:** Menampilkan daftar seluruh kasus (`K01`–`K05`) terurut dari skor tertinggi ke terendah, lengkap dengan nilai desimal/persentase dan solusi awal.
* **Reset Pilihan:** Mengosongkan pilihan gejala dan hasil diagnosa untuk pengujian ulang.

## 4. Data Model
Seluruh data bersifat statis/non-pribadi dan disimpan dalam struktur data JavaScript di sisi klien.

### Gejala (`Symptom`)
* `code`: string (`"G01"` s.d. `"G10"`)
* `label`: string (deskripsi gejala)
* `weight`: number (bobot gejala, contoh: `0.5`, `0.7`, `0.8`)

### Basis Kasus (`CaseItem`)
* `code`: string (`"K01"` s.d. `"K05"`)
* `name`: string (nama sistem/kerusakan)
* `solution`: string (saran pengecekan/perbaikan awal)
* `symptoms`: string[] (daftar kode gejala terkait, misal `["G01", "G06", "G09"]`)

### Hasil Diagnosa (`DiagnosisResult`)
* `caseCode`: string
* `caseName`: string
* `similarity`: number (rentang `0` sampai `1`)
* `percentage`: number (`similarity * 100`)
* `matchedCount`: number
* `totalCompared`: number
* `solution`: string

## 5. Nonfunctional Requirements
* **Arsitektur Klien Murni:** Berjalan 100% di browser menggunakan Vite + JavaScript vanilla tanpa server backend dan tanpa autentikasi/login.
* **Keamanan & Privasi:** Tidak menyimpan API key, tidak memproses data pribadi pengguna, dan tidak mengeksekusi perintah sistem/shell.
* **Aset:** Tidak menggunakan aset gambar, font berbayar, atau materi berhak cipta.
* **Performa & Responsivitas:** Perhitungan *similarity* untuk puluhan kasus selesai dalam hitungan milidetik; tampilan dapat digunakan di layar desktop maupun mobile.

## 6. Risiko
* **Bobot Kurang Akurat di Lapangan:** Bobot statis dari referensi umum bisa tidak sesuai dengan karakter motor tertentu (misalnya karburator vs injeksi atau CVT).
* **Skor Seri (*Tie*):** Dua atau lebih kasus bisa memperoleh persentase kemiripan yang sama jika gejala yang dipilih tumpang tindih.
* **Input Kosong:** Pengguna menekan proses diagnosa tanpa memilih gejala apa pun.

## 7. Out-of-Scope
* Backend server, REST/GraphQL API, dan database eksternal (SQL/NoSQL).
* Sistem login, registrasi akun, atau manajemen peran pengguna.
* Penyimpanan riwayat diagnosa lintas perangkat atau sinkronisasi cloud.
* Integrasi pembayaran, *telematics* sensor motor langsung, atau pemanggilan API pihak ketiga.

## 8. Acceptance Criteria (Pemeriksaan Manual)
1. **Tanpa Backend & Login:** Buka aplikasi di browser; pastikan tidak ada halaman/form login dan tidak ada request jaringan ke backend/API eksternal di tab Network DevTools.
2. **Input Kosong:** Tanpa mencentang gejala apa pun, klik tombol diagnosa; pastikan muncul pesan validasi agar pengguna memilih minimal satu gejala dan tidak terjadi error di console.
3. **Kasus Cocok Penuh:** Centang `G01`, `G06`, dan `G09`, lalu jalankan diagnosa; pastikan `K05` (`Sistem CVT / Transmisi`) muncul di urutan teratas dengan kecocokan `100%` dan solusinya tampil.
4. **Pengurutan Skor:** Pilih kombinasi gejala parsial (misalnya `G01` dan `G02`); pastikan seluruh kasus `K01`–`K05` tampil terurut menurun berdasarkan persentase kemiripan tanpa error `NaN` atau pembagian nol.
5. **Reset:** Klik tombol reset; pastikan semua checkbox kembali tidak tercentang dan hasil diagnosa sebelumnya hilang.

## 9. Implementation Plan per Iterasi
* **Iterasi 1 — Setup & Data Model:** Inisialisasi proyek Vite + JavaScript vanilla, buat modul data gejala (`G01`–`G10`) dan basis kasus (`K01`–`K05`).
* **Iterasi 2 — Mesin Perhitungan CBR:** Implementasikan fungsi *similarity* *Nearest Neighbor*, pengurutan hasil, dan penanganan kasus kosong/pembagi nol.
* **Iterasi 3 — Antarmuka & Interaksi:** Bangun UI daftar gejala, tombol diagnosa/reset, tampilan peringkat hasil, dan solusi perbaikan.
* **Iterasi 4 — Verifikasi Manual:** Jalankan seluruh *acceptance criteria* secara manual di browser desktop dan mobile, rapikan bug kecil, dan siapkan build produksi (`vite build`).
