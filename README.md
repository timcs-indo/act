# Productivity Tracker - Customer Support Team

Aplikasi web untuk tracking produktivitas team leader customer support dan caretaker mereka.

## 📋 Fitur

- **Dashboard** - Monitoring real-time produktivitas tim
- **Template Aktivitas** - Setup template default dan custom per team leader
- **Input Aktivitas Harian** - Catat aktivitas harian dengan durasi dalam menit
- **Handover Report** - Dokumentasi handover antara team leader dan caretaker
- **Laporan Produktivitas** - View dan export laporan dalam berbagai periode
- **Manajemen User** - Kelola team leader dan caretaker

## 🚀 Instalasi & Setup

### Prasyarat
- Node.js (v14+)
- npm atau yarn

### Langkah 1: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Langkah 2: Jalankan Backend

```bash
cd backend
npm start
```

Server akan berjalan di `http://localhost:5000`

### Langkah 3: Jalankan Frontend

Di terminal baru:

```bash
cd frontend
npm run dev
```

Aplikasi akan terbuka di `http://localhost:3000`

## 📊 Struktur Data

### Users
- **Team Leader** - 3 orang
  - Jhovan Hidayat (Jabodetabek)
  - Ridho Valentin (Jabalnusra)
  - Rofby Hidayari (Sumkalsulpap)

- **Caretaker** - 3 orang (masing-masing untuk 1 team leader)
  - Suro Rahadi (caretaker Jhovan)
  - Taufiq Hadiyanto (caretaker Ridho)
  - Rahmat Hidayat (caretaker Rofby)

### Kategori Aktivitas Default
1. Handling Enterprise
2. Meet Enterprise
3. Coaching Teams
4. Assign Leads
5. Meet Internal
6. Follow Up Data
7. Validasi H+1

Supervisor dapat menambah kategori baru, dan team leader dapat customize template sesuai kebutuhan.

## 📖 Penggunaan

### 1. Setup User (Manajemen User)
- Buka halaman "Manajemen User"
- Tambahkan team leader dan caretaker
- Assign caretaker ke team leader yang sesuai

### 2. Setup Template (Template Aktivitas)
- Buka halaman "Template Aktivitas"
- Pilih team leader
- Tambahkan template aktivitas default dengan durasi
- Team leader dapat customize sesuai kebutuhan

### 3. Input Aktivitas Harian
- Buka halaman "Input Aktivitas"
- Pilih tanggal dan team leader
- Tambahkan aktivitas yang dilakukan
- Gunakan template cepat atau input manual
- Durasi diukur dalam menit

### 4. Handover Report
- Buka halaman "Handover Report"
- Catat handover antara team leader ↔ caretaker
- Dokumentasikan catatan penting dan status

### 5. Laporan & Export
- Buka halaman "Laporan Produktivitas"
- Pilih periode: Harian, Mingguan, Bulanan, atau Custom
- Lihat ringkasan dan detail aktivitas
- **Export ke Excel** untuk presentasi atau analisis lebih lanjut

## 🗄️ Database

Aplikasi menggunakan SQLite yang di-simpan lokal di `backend/productivity.db`

Tables:
- `users` - Data user
- `activity_categories` - Kategori aktivitas
- `activity_sources` - Sumber pekerjaan
- `templates` - Template aktivitas per team leader
- `daily_activities` - Log aktivitas harian
- `handover_reports` - Dokumentasi handover

## 🔧 API Endpoints

### Users
- `GET /api/users` - Get semua users
- `POST /api/users` - Create user baru
- `GET /api/users/categories` - Get kategori
- `POST /api/users/categories` - Add kategori baru
- `GET /api/users/sources` - Get sources
- `POST /api/users/sources` - Add source baru

### Templates
- `GET /api/templates/:teamLeaderId` - Get template
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Activities
- `GET /api/activities` - Get aktivitas
- `POST /api/activities` - Create aktivitas
- `PUT /api/activities/:id` - Update aktivitas
- `DELETE /api/activities/:id` - Delete aktivitas

### Handover
- `GET /api/handover/:teamLeaderId` - Get handover reports
- `POST /api/handover` - Create handover report
- `PUT /api/handover/:id` - Update handover report
- `DELETE /api/handover/:id` - Delete handover report

### Reports
- `GET /api/reports/summary` - Get summary produktivitas
- `GET /api/reports/detailed` - Get detail aktivitas
- `POST /api/reports/export` - Export ke Excel

## 📤 Export Format

Export Excel mencakup 3 sheet:
1. **Ringkasan** - Summary produktivitas per user
2. **Aktivitas Harian** - Detail semua aktivitas
3. **Handover Report** - Dokumentasi handover

## 🎨 UI/UX

- Design yang clean dan intuitif
- Responsive design untuk desktop
- Dark-friendly color scheme
- Sidebar navigation untuk easy access

## 📝 Notes

- Setiap aktivitas disimpan dengan timestamp
- Durasi dihitung dalam menit
- Handover documentation penting untuk transisi smooth
- Export Excel dapat digunakan untuk presentasi ke management

## ⚙️ Troubleshooting

**Backend tidak connect:**
- Pastikan backend running di port 5000
- Check firewall settings
- Verify CORS configuration

**Database error:**
- Database auto-create pada first run
- Jika ada error, hapus `productivity.db` dan restart backend

**Export gagal:**
- Pastikan browser allow download
- Check file permissions di folder backend

## 📞 Support

Untuk issues atau questions, contact tim development.
