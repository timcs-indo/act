# Productivity Customer Support Leader

Aplikasi tracking produktivitas Customer Support team Majoo, dengan integrasi Google Calendar dan sistem handover task antar role.

**Production URL:** https://csmajoo.github.io/act/

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────────────┐         ┌────────────────────┐           │
│   │  Frontend    │ ──API──>│  Supabase Backend  │           │
│   │  (React+Vite)│         │  - PostgreSQL DB   │           │
│   └──────────────┘         │  - Edge Functions  │           │
│         │                  │    (Google OAuth)  │           │
│         │                  └────────────────────┘           │
│         │                                                   │
│   Local Dev: http://localhost:3000 (npm run dev)            │
│   Production: https://csmajoo.github.io/act/                │
│                                                             │
│   Both use the SAME Supabase database & Edge Functions!     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Frontend:** React + Vite (deployed via GitHub Actions)
**Backend:** Supabase (PostgreSQL + Edge Functions)
**Auth:** Custom session token (stored in `sessions` table)
**Google Calendar:** OAuth via Supabase Edge Functions
**Hosting:** GitHub Pages (frontend) + Supabase (backend)

---

## 🚀 Local Development Setup

### Prerequisites

- **Node.js** 18+ (`node --version`)
- **npm** 9+ (`npm --version`)
- **Git**
- Modern browser (Chrome/Brave/Firefox)

### One-Time Setup

```bash
# 1. Clone the repo (jika belum)
git clone https://github.com/csmajoo/act.git
cd act

# 2. Install dependencies
cd frontend
npm install

# 3. Verify .env.local exists
cat .env.local
# Harus tampil:
# VITE_SUPABASE_URL=https://fnkbvqrvcsnwnuhjkwbe.supabase.co
# VITE_SUPABASE_ANON_KEY=...
# VITE_USE_SUPABASE=true
```

### Run Local Dev Server

```bash
cd frontend
npm run dev
```

Frontend akan available di: **http://localhost:3000**

✅ Hot reload aktif — perubahan kode auto-refresh di browser.

> 💡 **PENTING:** Local dev menggunakan **database Supabase yang SAMA dengan production**. Hati-hati dengan operasi destruktif (delete) saat testing!

---

## 🌐 Production Deployment

### Automatic Deployment via Git Push

Setiap push ke `master` akan otomatis trigger deployment:

```bash
git push origin master
```

GitHub Actions workflow (`.github/workflows/deploy.yml`) akan:
1. ✅ Checkout code
2. ✅ Install dependencies
3. ✅ Build dengan `.env.production` settings
4. ✅ Deploy ke GitHub Pages

**Live URL:** https://csmajoo.github.io/act/

### Verify Deployment

1. Cek status: https://github.com/csmajoo/act/actions
2. Tunggu green checkmark ✅ (~2-3 menit)
3. Hard refresh browser (Ctrl+Shift+R) untuk melihat versi baru

---

## 🔄 Workflow: Local Development → Production

### 📝 **SCENARIO 1: Perubahan Kode (UI/Logic)**

```bash
# 1. Pull versi terbaru dari production
git pull origin master

# 2. Start local dev server
cd frontend
npm run dev

# 3. Edit kode di src/...
# Browser auto-refresh setiap save

# 4. Test di http://localhost:3000
# - Login, klik tombol, edit data
# - Verify tidak ada error di Console (F12)

# 5. Test build production
npm run build
# Pastikan no errors

# 6. Commit & push (auto-deploy)
cd ..
git add .
git commit -m "Deskripsi perubahan"
git push origin master

# 7. Tunggu 2-3 menit deploy selesai
# Cek: https://github.com/csmajoo/act/actions
# Buka: https://csmajoo.github.io/act/
```

### 🗄️ **SCENARIO 2: Perubahan Database Schema**

Jika perlu tambah kolom/tabel baru:

```bash
# 1. Buat SQL migration file di root project
# Contoh: SUPABASE_ADD_NEW_COLUMN.sql
cat > SUPABASE_ADD_PHONE.sql << 'EOF'
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
EOF

# 2. Jalankan di Supabase Dashboard:
# - Buka https://supabase.com/dashboard/project/fnkbvqrvcsnwnuhjkwbe
# - Pilih SQL Editor → New Query
# - Copy isi SQL file → Run

# 3. Update frontend code untuk pakai field baru
# Edit src/utils/supabaseApi.js, components, dll

# 4. Test di local
cd frontend && npm run dev

# 5. Commit SQL + code changes
cd ..
git add SUPABASE_ADD_PHONE.sql frontend/src/
git commit -m "Add phone field to users"
git push origin master
```

### ⚡ **SCENARIO 3: Perubahan Edge Functions (Google OAuth/Calendar)**

```bash
# 1. Edit Edge Function file
# Contoh: supabase/functions/google-event/index.ts

# 2. Deploy ke Supabase
cd "/path/to/Productivity"
supabase functions deploy google-event --no-verify-jwt

# 3. Test di local (browser di localhost:3000)
# Edge Function langsung available, tidak perlu restart frontend

# 4. Commit source code ke git
git add supabase/functions/google-event/
git commit -m "Update google-event function"
git push origin master
```

### 📦 **SCENARIO 4: Tambah NPM Package**

```bash
cd frontend

# 1. Install package
npm install nama-package

# 2. Test di local
npm run dev

# 3. Commit package.json + package-lock.json
git add package.json package-lock.json
git commit -m "Add nama-package dependency"
git push origin master
```

---

## 🔐 Environment Variables

### `.env.local` (Local Development)
```bash
VITE_SUPABASE_URL=https://fnkbvqrvcsnwnuhjkwbe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_USE_SUPABASE=true       # Gunakan Supabase (sama seperti prod)
```

### `.env.production` (Production Build)
Sama dengan `.env.local`. Keduanya committed ke git agar deployment bekerja.

### Supabase Edge Function Secrets (Server-side)

```bash
# Set via Supabase CLI (one-time)
supabase secrets set GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
supabase secrets set GOOGLE_CLIENT_SECRET=YOUR_SECRET
supabase secrets set GOOGLE_REDIRECT_URI=https://fnkbvqrvcsnwnuhjkwbe.supabase.co/functions/v1/google-callback
supabase secrets set FRONTEND_URL=https://csmajoo.github.io/act/
supabase secrets set GOOGLE_CALENDAR_TZ=Asia/Jakarta

# Verify
supabase secrets list
```

> ⚠️ **JANGAN commit Google OAuth secrets ke git!** Sudah di-set di Supabase secrets (server-side).

---

## 🧪 Testing Checklist (Sebelum Push)

✅ **Step 1: Build test**
```bash
cd frontend && npm run build
# Harus complete tanpa error
```

✅ **Step 2: Local browser test**
- [ ] Semua halaman load tanpa error
- [ ] Login/logout works
- [ ] Create/edit/delete activities
- [ ] Ganti password
- [ ] Google Calendar sync (jika applicable)

✅ **Step 3: Cek console**
- [ ] Buka DevTools (F12)
- [ ] No error merah di Console
- [ ] No failed network requests (404, 500)

✅ **Step 4: Multi-user test**
- [ ] Login sebagai Supervisor → lihat semua user
- [ ] Login sebagai Team Leader → hanya tim sendiri
- [ ] Login sebagai Caretaker → hanya aktivitas sendiri

---

## 📚 Common Commands

### Frontend Development
```bash
cd frontend

npm install      # Install dependencies (one-time atau setelah pull baru)
npm run dev      # Start dev server (port 3000)
npm run build    # Production build → dist/
npm run preview  # Preview production build di local
```

### Git Workflow
```bash
git pull origin master              # Pull latest
git status                          # Cek perubahan
git add .                           # Stage all changes
git add specific-file.js            # Stage file tertentu
git commit -m "Pesan deskriptif"    # Commit
git push origin master              # Push (trigger auto-deploy)
git log --oneline -10               # 10 commit terakhir
```

### Supabase CLI
```bash
# One-time setup
supabase login
supabase link --project-ref fnkbvqrvcsnwnuhjkwbe

# Daily commands
supabase functions list                            # List Edge Functions
supabase functions deploy NAMA_FUNC --no-verify-jwt  # Deploy function
supabase functions logs NAMA_FUNC                  # Lihat logs
supabase secrets list                              # List secrets
```

---

## 🆘 Troubleshooting

### Local dev tampil data lama setelah push
→ Hard refresh: `Ctrl + Shift + R` (atau test di Incognito)

### GitHub Actions failing
→ Cek https://github.com/csmajoo/act/actions untuk detail error
→ Common: build error → fix di local dulu sebelum push

### Supabase Edge Function tidak respond
→ Cek logs: https://supabase.com/dashboard/project/fnkbvqrvcsnwnuhjkwbe/functions
→ Klik function name → Logs tab

### Login fails dengan "Email atau password salah"
→ Verify user exists di Supabase users table
→ Cek field `password_hash` di Table Editor
→ Pastikan password yang dimasukkan sama dengan di database

### Activity tidak sync ke Google Calendar
1. Verify user sudah connect Google Calendar di sidebar (📅 Google tersambung)
2. Cek Edge Function logs untuk `google-event`
3. Verify Google OAuth redirect URI di Google Cloud Console:
   `https://fnkbvqrvcsnwnuhjkwbe.supabase.co/functions/v1/google-callback`

### Error "Application Error" dengan stack trace aneh
→ Format mismatch. Cek `supabaseApi.js` response shape match dengan UI expectation
→ Buka DevTools Network tab, lihat response API yang error

### Browser cache issue (file lama masih load)
→ DevTools (F12) → Right-click reload button → "Empty Cache and Hard Reload"
→ Atau buka Incognito Window

---

## 📋 Default Login Credentials

Setelah fresh DB setup, default password semua user adalah `122333`.

| Email | Role |
|-------|------|
| `aan.sayudi@majoo.id` | Supervisor |
| `jhovan@majoo.id` | Team Leader |
| `ridho.valentin@majoo.id` | Team Leader |
| `rofby.hidayadi@majoo.id` | Team Leader |
| `suro.rahardi@majoo.id` | Caretaker |
| `taufiq.hadiyanto@majoo.id` | Caretaker |
| `rahmat.hidayat@majoo.id` | Caretaker |

> ⚠️ User bisa ganti password sendiri via tombol 🔐 **Ganti Password** di sidebar.

---

## 📁 Project Structure

```
Productivity/
├── frontend/                          # React + Vite app
│   ├── src/
│   │   ├── App.jsx                    # Main app + routing
│   │   ├── pages/                     # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Activity.jsx           # Calendar + add activity
│   │   │   ├── TodoList.jsx           # To-do list + done toggle
│   │   │   ├── TemplateManagement.jsx
│   │   │   ├── Reports.jsx
│   │   │   └── UserManagement.jsx
│   │   ├── utils/
│   │   │   ├── api.js                 # API wrapper (axios/Supabase)
│   │   │   ├── supabaseApi.js         # Supabase REST client
│   │   │   ├── supabase.js            # Supabase JS client
│   │   │   ├── env.js                 # Environment detection
│   │   │   └── toast.js               # Toast notifications
│   │   └── index.css
│   ├── public/
│   │   └── logo-majoo.svg
│   ├── .env.local                     # Local development config
│   ├── .env.production                # Production build config
│   ├── package.json
│   └── vite.config.js
│
├── supabase/                          # Supabase Edge Functions
│   ├── functions/
│   │   ├── _shared/                   # Shared utilities
│   │   │   ├── cors.ts
│   │   │   ├── google.ts
│   │   │   └── supabase.ts
│   │   ├── google-auth-url/           # OAuth consent URL
│   │   ├── google-callback/           # OAuth callback handler
│   │   ├── google-status/             # Check connection
│   │   ├── google-disconnect/         # Remove tokens
│   │   └── google-event/              # Create/update/delete events
│   └── DEPLOY_EDGE_FUNCTIONS.md       # Deploy guide
│
├── backend/                           # Legacy Node.js backend (UNUSED)
│   └── ...                            # Kept for reference only
│
├── .github/workflows/
│   └── deploy.yml                     # Auto-deploy ke GitHub Pages
│
├── SUPABASE_FULL_SCHEMA.sql           # Database schema lengkap
├── SUPABASE_FIX_RLS.sql               # RLS policy fix
├── SUPABASE_ADD_GOOGLE_COLS.sql       # Google columns migration
├── SUPABASE_ADD_IS_DONE.sql           # is_done column migration
└── README.md                          # This file
```

---

## 🔗 Important Links

- **Production App:** https://csmajoo.github.io/act/
- **GitHub Repo:** https://github.com/csmajoo/act
- **GitHub Actions:** https://github.com/csmajoo/act/actions
- **Supabase Dashboard:** https://supabase.com/dashboard/project/fnkbvqrvcsnwnuhjkwbe
- **Supabase Functions:** https://supabase.com/dashboard/project/fnkbvqrvcsnwnuhjkwbe/functions
- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials

---

## 💡 Tips & Best Practices

### Development Flow
1. **Selalu pull dulu** sebelum mulai coding (`git pull origin master`)
2. **Test di local** sebelum push (hot reload memudahkan)
3. **Build test** sebelum commit (`npm run build`)
4. **Descriptive commit message** (jelaskan WHY, bukan WHAT)
5. **Push sering, push kecil** - lebih mudah debug kalau ada masalah

### Database Migrations
1. **Selalu buat SQL file** untuk perubahan schema
2. **Use `IF NOT EXISTS`** supaya idempotent (bisa di-run berkali-kali)
3. **Test migration di Supabase Dashboard** sebelum commit
4. **Naming convention:** `SUPABASE_ADD_X.sql`, `SUPABASE_FIX_Y.sql`

### Edge Functions
1. **Test via Supabase logs** karena tidak ada error feedback di frontend
2. **Always redeploy** setelah update (`supabase functions deploy`)
3. **Use `console.log`** liberal untuk debug
4. **Check CORS headers** kalau ada masalah dari browser

### Security
1. **JANGAN commit secrets** (Google OAuth secrets, dll)
2. **Use Supabase secrets** untuk credentials server-side
3. **Anon key OK di committed** (limited permissions via RLS)
4. **RLS policies** harus benar untuk tabel-tabel sensitif

---

## 📝 License

Internal use untuk Majoo Customer Support team.
