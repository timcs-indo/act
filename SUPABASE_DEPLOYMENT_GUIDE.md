# 🗄️ Supabase Setup Complete - Database Configuration

## Status: ✅ Ready to Deploy

**Supabase Project URL**: `https://fnkbvqrvcsnwnuhjkwbe.supabase.co`  
**Credentials**: ✅ Already configured in frontend

---

## 📋 Setup Steps (Silakan ikuti):

### STEP 1: Setup Database Schema

**Tempat**: https://app.supabase.com → SQL Editor → New Query

**Action**:
1. Copy seluruh isi dari file `SUPABASE_SETUP.sql`
2. Paste ke SQL Editor
3. Click "Run"

**Hasil yang diharapkan**:
- ✅ 5 tables created (users, activity_categories, activity_sources, daily_activities, handover_tasks)
- ✅ Indexes created
- ✅ RLS policies enabled
- ✅ No errors

---

### STEP 2: Seed Initial Data

Di SQL Editor yang sama, jalankan INSERT statements berikut:

```sql
-- Users Data
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES
(1, 'Aan Sayudi', 'supervisor', NULL, 'Jakarta', 'aan.sayudi@majoo.id'),
(4, 'Jhovan Hidayat', 'team_leader', NULL, 'Jabodetabek', 'jhovan@majoo.id'),
(5, 'Rofbi Hidayadi', 'team_leader', NULL, 'Sumkalsulpap', 'rofby.hidayadi@majoo.id'),
(6, 'Ridho Valentin', 'team_leader', NULL, 'Jabalnusra', 'ridho.valentin@majoo.id'),
(7, 'Suro Rahadi', 'caretaker', 4, NULL, 'suro.rahardi@majoo.id'),
(8, 'Taufiq Hadiyanto', 'caretaker', 6, NULL, 'taufiq.hadiyanto@majoo.id'),
(9, 'Rahmat Hidayat', 'caretaker', 5, NULL, 'rahmat.hidayat@majoo.id');

-- Activity Categories
INSERT INTO activity_categories (id, name) VALUES
(8, 'Administrative & CRM Tasks'),
(9, 'Special Projects'),
(10, 'Enterprise'),
(11, 'Manage Teams'),
(16, 'Meet Internal'),
(23, 'Handling Enterprise'),
(24, 'Meet Enterprise'),
(25, 'Coaching Teams'),
(26, 'Assign Leads'),
(27, 'Follow Up Data'),
(28, 'Validasi H+1');

-- Activity Sources
INSERT INTO activity_sources (id, name) VALUES
(6, 'CRM'),
(7, 'Email'),
(8, 'Daily Tasklist'),
(10, 'WhatsApp'),
(13, 'Phone'),
(16, 'Chat System'),
(17, 'Ticket System');
```

**Expected Result**: ✅ All data inserted successfully

---

### STEP 3: Verify Setup

**Di Supabase Dashboard**, verify:

1. **Tables created**:
   - Go to: Database → Tables
   - ✅ Lihat: users, daily_activities, activity_categories, activity_sources, handover_tasks

2. **Data exists**:
   - Click each table → browse data
   - ✅ Users: 7 users ada
   - ✅ Categories: 11 categories ada
   - ✅ Sources: 7 sources ada

3. **RLS enabled**:
   - Click table → Click "RLS" button
   - ✅ Harus ada (enabled)

---

### STEP 4: Configure Environment

**Credentials sudah di set di**: `frontend/src/utils/supabase.js`

```javascript
const supabaseUrl = 'https://fnkbvqrvcsnwnuhjkwbe.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Frontend Development** (untuk local testing):
```bash
cd frontend
npm install
npm run dev
# Buka: http://localhost:3000
```

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://app.supabase.co |
| Project Settings | https://app.supabase.co/project/fnkbvqrvcsnwnuhjkwbe/settings/api |
| SQL Editor | https://app.supabase.co/project/fnkbvqrvcsnwnuhjkwbe/sql |
| GitHub Pages Live | https://csmajoo.github.io/act/ |

---

## ✅ Deployment Checklist

- [ ] Push code ke GitHub (DONE)
- [ ] Build frontend (DONE)
- [ ] Copy to /docs folder (DONE)
- [ ] Enable GitHub Pages (NEXT)
- [ ] Setup Supabase database (NEXT)
- [ ] Seed initial data (NEXT)
- [ ] Verify live application
- [ ] Test responsive design on mobile

---

## ⚠️ Common Issues

### Issue: 404 Page Not Found
**Fix**: 
- Pastikan GitHub Pages "Source" set ke `/docs` branch `master`
- Tunggu 1-2 menit untuk deployment complete

### Issue: Data tidak tampil
**Fix**:
- Verify Supabase credentials di `supabase.js`
- Check browser console untuk error
- Verify RLS policies (should be permissive for now)

### Issue: CORS error
**Fix**:
- Supabase CORS seharusnya auto-allow
- Verify API key correct
- Check Network tab di Dev Tools

---

**Setup Date**: 2026-06-05  
**Status**: 🟡 Waiting for manual Supabase database setup
