# 🚀 Quick Start Guide

Panduan singkat untuk mulai develop & deploy.

## 1️⃣ Setup Awal (One-Time)

```bash
# Install dependencies
cd "/home/aan/Claude Project/Productivity/frontend"
npm install
```

## 2️⃣ Mulai Development

```bash
# Start local dev server
cd "/home/aan/Claude Project/Productivity/frontend"
npm run dev
```

Buka: **http://localhost:3000**

Hot reload aktif — perubahan auto-refresh.

## 3️⃣ Workflow Harian

```bash
# ── Sebelum mulai ──
cd "/home/aan/Claude Project/Productivity"
git pull origin master              # Sync latest

# ── Develop ──
cd frontend
npm run dev                          # Buka localhost:3000
# Edit kode, test di browser...

# ── Sebelum push ──
npm run build                        # Verify build success

# ── Push ke production ──
cd ..
git add .
git commit -m "Deskripsi perubahan"
git push origin master               # AUTO-DEPLOY (2-3 menit)
```

## 4️⃣ Cek Deployment

- **Actions status:** https://github.com/csmajoo/act/actions
- **Production app:** https://csmajoo.github.io/act/
- **Hard refresh:** Ctrl+Shift+R untuk lihat versi baru

## 5️⃣ Common Tasks

### Ganti Schema DB
1. Buat SQL file: `SUPABASE_ADD_xxx.sql`
2. Jalankan di Supabase Dashboard → SQL Editor
3. Update kode di `frontend/src/utils/supabaseApi.js`
4. Commit + push

### Update Edge Function
```bash
cd "/home/aan/Claude Project/Productivity"
supabase functions deploy NAMA_FUNCTION --no-verify-jwt
git add supabase/functions/NAMA_FUNCTION/
git commit -m "Update NAMA_FUNCTION"
git push origin master
```

### Install NPM Package
```bash
cd frontend
npm install package-baru
git add package.json package-lock.json
git commit -m "Add package-baru"
git push origin master
```

## 6️⃣ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Local tampil data lama | Hard refresh (Ctrl+Shift+R) |
| Build error | Cek error message, fix syntax |
| Deploy failing | Cek https://github.com/csmajoo/act/actions |
| Edge Function error | Cek logs di Supabase Dashboard |
| Login fail | Cek user di Supabase Table Editor |

## 7️⃣ Critical Files

- `frontend/src/App.jsx` — Main app
- `frontend/src/utils/supabaseApi.js` — API wrapper
- `frontend/.env.local` — Local config (Supabase)
- `frontend/.env.production` — Production config
- `supabase/functions/*/index.ts` — Edge Functions
- `.github/workflows/deploy.yml` — Auto-deploy config

## 8️⃣ Tip Penting

⚠️ **Local dev pakai database production yang sama!**
- Hati-hati saat delete/update data
- Test create dulu, baru bersihkan
- Backup penting sebelum mass operation

✅ **Best practice:**
- Commit kecil & sering
- Selalu test di local dulu
- Pull sebelum mulai develop
- Descriptive commit messages

---

📖 **Detail lengkap:** Lihat [README.md](./README.md)
