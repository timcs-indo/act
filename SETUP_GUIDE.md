# Setup Guide - Productivity Tracker

Panduan step-by-step untuk setup awal aplikasi.

## Step 1: Jalankan Aplikasi

### Terminal 1 - Backend
```bash
cd backend
npm start
```
Tunggu sampai muncul: `Server running on http://localhost:5000`

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```
Aplikasi otomatis buka di browser `http://localhost:3000`

---

## Step 2: Setup Users (Manajemen User)

Klik menu **"Manajemen User"** dan buat user sebagai berikut:

### Team Leaders (3 orang)

**1. Jhovan Hidayat**
- Nama: Jhovan Hidayat
- Role: Team Leader
- Area: Jabodetabek
- Email: jhovan@example.com

**2. Ridho Valentin**
- Nama: Ridho Valentin
- Role: Team Leader
- Area: Jabalnusra
- Email: ridho@example.com

**3. Rofby Hidayari**
- Nama: Rofby Hidayari
- Role: Team Leader
- Area: Sumkalsulpap
- Email: rofby@example.com

### Caretakers (3 orang)

**1. Suro Rahadi** (Caretaker untuk Jhovan Hidayat)
- Nama: Suro Rahadi
- Role: Caretaker
- Team Leader (untuk): Jhovan Hidayat - Jabodetabek

**2. Taufiq Hadiyanto** (Caretaker untuk Ridho Valentin)
- Nama: Taufiq Hadiyanto
- Role: Caretaker
- Team Leader (untuk): Ridho Valentin - Jabalnusra

**3. Rahmat Hidayat** (Caretaker untuk Rofby Hidayari)
- Nama: Rahmat Hidayat
- Role: Caretaker
- Team Leader (untuk): Rofby Hidayari - Sumkalsulpap

---

## Step 3: Setup Template Aktivitas

Klik menu **"Template Aktivitas"** dan ikuti langkah ini untuk setiap team leader:

### Untuk Setiap Team Leader:

1. **Pilih team leader** dari dropdown
2. **Klik "+ Tambah Template"**
3. Tambahkan 7 kategori default dengan template waktu:

| Kategori | Durasi | Sumber |
|----------|--------|--------|
| Handling Enterprise | 60 | WhatsApp |
| Meet Enterprise | 45 | WhatsApp |
| Coaching Teams | 30 | Chat System |
| Assign Leads | 20 | Email |
| Meet Internal | 30 | Chat System |
| Follow Up Data | 45 | Email |
| Validasi H+1 | 15 | Email |

**Tips:**
- Durasi bisa disesuaikan per team leader
- Sumber pekerjaan membantu tracking channel
- Team leader bisa menambah kategori custom di bawah

---

## Step 4: Input Aktivitas Harian

Klik menu **"Input Aktivitas"**:

1. Pilih team leader
2. Pilih tanggal
3. **Opsi 1 - Gunakan Template Cepat:**
   - Klik tombol kategori di bawah form
   - Durasi otomatis terisi dari template
   - Tinggal ganti sumber dan add

4. **Opsi 2 - Input Manual:**
   - Isi semua field secara manual
   - User: pilih team leader atau caretaker
   - Durasi dalam menit
   - Catatan optional

**Contoh Input:**
- User: Jhovan Hidayat
- Kategori: Handling Enterprise
- Durasi: 120 (menit)
- Sumber: WhatsApp
- Catatan: Handling 5 customer complaints

---

## Step 5: Catat Handover Report

Klik menu **"Handover Report"**:

1. Pilih team leader
2. Klik "+ Tambah Report"
3. Isi:
   - **Dari:** User yang serah terima (Team Leader atau Caretaker)
   - **Ke:** User yang menerima
   - **Tanggal:** Kapan handover terjadi
   - **Catatan:** Dokumentasi penting
     - Status pekerjaan
     - Issues yang perlu dihandle
     - Customer yang penting
     - Hal urgent lainnya

**Contoh Handover:**
- Dari: Jhovan Hidayat
- Ke: Suro Rahadi (Caretaker)
- Tanggal: 2024-01-15
- Catatan: 
  ```
  - Ada 3 escalation dari enterprise customer XYZ
  - Tunggu callback dari HQ jam 2 siang
  - Ada 2 training session pending
  - Follow up data masih review
  ```

---

## Step 6: Lihat Laporan & Export

Klik menu **"Laporan Produktivitas"**:

1. Pilih team leader
2. Pilih periode:
   - **Harian:** Produktivitas hari tertentu
   - **Mingguan:** Produktivitas 1 minggu
   - **Bulanan:** Produktivitas 1 bulan
   - **Custom:** Pilih range tanggal sendiri

3. **Lihat ringkasan:**
   - Total menit team leader
   - Total menit caretaker
   - Rata-rata produktivitas per hari
   - Total aktivitas

4. **Lihat detail aktivitas** (opsional)

5. **Export ke Excel:**
   - Klik tombol "📥 Export ke Excel"
   - File otomatis download
   - Berisi: Summary, Aktivitas Detail, Handover Report

---

## Dashboard Overview

Klik **"Dashboard"** untuk overview:

- Pilih team leader mana yang ingin dimonitor
- Pilih periode monitoring
- Lihat:
  - Total produktivitas team leader (dalam menit)
  - Total produktivitas caretaker
  - Perbandingan aktivitas
  - Hari kerja tercatat

---

## Tips Penggunaan

### Best Practices:

1. **Template Management:**
   - Set template sesuai karakteristik tim
   - Bisa berbeda untuk setiap team leader
   - Review dan update template sebulan sekali

2. **Daily Tracking:**
   - Input aktivitas saat hari, tidak perlu tunggu akhir hari
   - Gunakan template cepat untuk speed up
   - Catatan detail membantu analisis

3. **Handover Reports:**
   - Handover SETIAP ADA TRANSISI
   - Catat catatan penting untuk kontinuitas
   - Useful untuk audit trail

4. **Export & Reporting:**
   - Export weekly untuk submit ke management
   - Custom date range untuk ad-hoc reporting
   - Detail aktivitas untuk performance analysis

### Common Workflows:

**Awal Hari (Supervisor):**
- Check dashboard
- Monitor produktivitas kemarin
- Lihat ada handover report apa

**Saat Shift (Team Leader/Caretaker):**
- Input aktivitas setelah selesai
- Update handover jika ada transisi
- Check progress vs target

**Akhir Periode (Supervisor):**
- Export laporan bulanan
- Review produktivitas tim
- Identify improvement areas

---

## Struktur Team (Quick Reference)

```
├── Jhovan Hidayat (Team Leader - Jabodetabek)
│   └── Suro Rahadi (Caretaker)
│
├── Ridho Valentin (Team Leader - Jabalnusra)
│   └── Taufiq Hadiyanto (Caretaker)
│
└── Rofby Hidayari (Team Leader - Sumkalsulpap)
    └── Rahmat Hidayat (Caretaker)
```

---

## FAQ

**Q: Bagaimana jika ada activity yang lupa di-record?**
A: Buka halaman "Input Aktivitas", pilih tanggal kemarin, tambah aktivitas. Data bisa diubah kapan saja.

**Q: Bisa ganti durasi template?**
A: Ya, setiap team leader bisa customize template mereka di halaman "Template Aktivitas".

**Q: Export berisi apa saja?**
A: 3 sheet: Summary (ringkasan), Detail Aktivitas (list lengkap), Handover Report (dokumentasi).

**Q: Bisa lihat perbandingan team leader?**
A: Belum, tapi bisa export per team leader terus compare di Excel.

---

## Support

Jika ada pertanyaan atau issue, hubungi tim development.
