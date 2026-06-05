# 🚀 Panduan Deployment - GitHub Pages & Supabase

**Status**: Siap Deploy ke Production  
**Dibuat**: 2026-06-05  
**Versi**: 1.0

---

## 📋 Checklist Deployment

### ✅ STEP 1: Push ke GitHub dengan Personal Access Token

```bash
cd "/home/aan/Claude Project/Productivity"

# Format: https://USERNAME:TOKEN@github.com/USERNAME/REPO.git
# Ganti YOUR_GITHUB_USERNAME dan YOUR_PAT_TOKEN
git remote set-url origin https://YOUR_GITHUB_USERNAME:YOUR_PAT_TOKEN@github.com/csmajoo/act.git

# Commit changes
git add .
git commit -m "Deployment: Ready for GitHub Pages & Supabase (responsive design verified)"

# Push ke GitHub
git push origin master
```

**Catatan**: PAT Token bisa dibuat di: https://github.com/settings/tokens
- Pilih "Tokens (classic)"
- Select scope: `repo` (full control)

---

### ✅ STEP 2: Enable GitHub Pages

1. Buka: https://github.com/csmajoo/act/settings/pages
2. Di section "Build and deployment":
   - **Source**: Pilih "Deploy from a branch"
   - **Branch**: Pilih `master` dan folder `/docs` (atau `/root`)
   - Click "Save"

**Alternative**: Jika ingin deploy dari folder `dist/` setelah build:
- Setup GitHub Actions workflow (lihat di bawah)

---

### ✅ STEP 3: Setup Environment Variables

**Frontend (.env atau vite.config.js)**:
```javascript
// frontend/vite.config.js
export default {
  base: '/act/',  // ✅ Sudah configured
  define: {
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key')
  }
}
```

**Atau buat file .env**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

### ✅ STEP 4: Setup Supabase

#### 4.1 Setup Database (jika belum ada)

1. Buka: https://app.supabase.com
2. Pilih project Anda
3. Go to SQL Editor
4. Run seluruh script dari `SUPABASE_SETUP.sql`:

```bash
cat SUPABASE_SETUP.sql | pbcopy  # atau gunakan content viewer
```

#### 4.2 Seed Initial Data

Di SQL Editor, jalankan:

```sql
-- Users
INSERT INTO users (id, name, role, team_leader_id, area, email) 
VALUES 
  (1, 'Aan Sayudi', 'supervisor', NULL, 'Jakarta', 'aan.sayudi@majoo.id'),
  (4, 'Jhovan Hidayat', 'team_leader', NULL, 'Jabodetabek', 'jhovan@majoo.id'),
  (5, 'Rofbi Hidayadi', 'team_leader', NULL, 'Sumkalsulpap', 'rofby.hidayadi@majoo.id'),
  (6, 'Ridho Valentin', 'team_leader', NULL, 'Jabalnusra', 'ridho.valentin@majoo.id'),
  (7, 'Suro Rahadi', 'caretaker', 4, NULL, 'suro.rahardi@majoo.id'),
  (8, 'Taufiq Hadiyanto', 'caretaker', 6, NULL, 'taufiq.hadiyanto@majoo.id'),
  (9, 'Rahmat Hidayat', 'caretaker', 5, NULL, 'rahmat.hidayat@majoo.id');

-- Activity Categories (copy dari SUPABASE_MIGRATION_GUIDE.md bagian categories)
-- Activity Sources (copy dari SUPABASE_MIGRATION_GUIDE.md bagian sources)
```

#### 4.3 Get Supabase Credentials

1. Go to: Settings → API
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Public Key** → `VITE_SUPABASE_ANON_KEY`

---

### ✅ STEP 5: Build Frontend untuk Production

```bash
cd frontend

# Install dependencies
npm install

# Build untuk production (dengan base path /act/)
npm run build

# Output akan ada di: frontend/dist/
```

---

### ✅ STEP 6: Deploy Build ke GitHub

**Option A: Manual Deploy (Upload dist ke /docs folder)**

```bash
# Copy dist/ ke /docs/ (jika using /docs for GitHub Pages)
cp -r frontend/dist/* ./docs/

# Commit dan push
git add docs/
git commit -m "Deploy: Built frontend for GitHub Pages"
git push origin master
```

**Option B: GitHub Actions (Automatic)**

Buat file: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      
      - name: Build
        run: |
          cd frontend
          npm run build
      
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
          cname: csmajoo-act.github.io  # Optional: custom domain
```

---

### ✅ STEP 7: Verifikasi Deployment

Setelah push:

1. **Check GitHub Actions** (jika menggunakan workflow):
   - Go to: https://github.com/csmajoo/act/actions
   - Tunggu workflow selesai (hijau ✅)

2. **Akses aplikasi**:
   - URL: https://csmajoo.github.io/act/
   - Atau: https://your-custom-domain (jika CNAME configured)

3. **Test fitur**:
   - ✅ Login page muncul
   - ✅ Bisa select user dari Supabase
   - ✅ Dashboard load dengan data
   - ✅ Responsive design on mobile

---

## 📱 Responsive Design Status

✅ Sudah diverifikasi:
- Dashboard responsive (mobile, tablet, desktop)
- Sidebar hamburger menu untuk mobile
- Table monitoring team horizontal scroll
- Activity log table responsive
- Semua card tersusun rapi di mobile

---

## 🔗 Links & Resources

| Resource | Link |
|----------|------|
| GitHub Repository | https://github.com/csmajoo/act |
| Deployed App | https://csmajoo.github.io/act/ |
| Supabase Project | https://app.supabase.com |
| GitHub Pages Settings | https://github.com/csmajoo/act/settings/pages |
| GitHub Personal Token | https://github.com/settings/tokens |

---

## ❓ Troubleshooting

### Issue: 404 Not Found di GitHub Pages
**Solusi**: Pastikan `base: '/act/'` di `vite.config.js`

### Issue: Supabase data tidak muncul
**Solusi**: 
1. Check RLS policies di Supabase
2. Verify `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` benar
3. Check console browser untuk error

### Issue: Git push failed
**Solusi**: 
1. Verify personal access token valid
2. Token scope harus include `repo`
3. Cek URL remote format

---

## 📊 Deployment Checklist

- [ ] Commit code: `git commit -m "..."`
- [ ] Push ke GitHub: `git push origin master`
- [ ] Enable GitHub Pages di settings
- [ ] Setup Supabase environment variables
- [ ] Run Supabase SQL setup
- [ ] Seed data ke Supabase
- [ ] Build frontend: `npm run build`
- [ ] Deploy build ke GitHub Pages
- [ ] Verify aplikasi berjalan live
- [ ] Test login & data loading dari Supabase
- [ ] Test responsive design on mobile

---

**Created**: 2026-06-05  
**Updated**: -  
**Status**: ✅ Ready for Deployment
