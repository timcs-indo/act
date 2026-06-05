# Full Supabase Migration Guide

## Status: ✅ Setup Complete - Ready for Final Configuration

---

## **What's Done:**

### ✅ Frontend Changes
- Login page updated to use Supabase (user selection from database)
- App.jsx updated to fetch users/categories/sources from Supabase
- Supabase client configured (`src/utils/supabase.js`)
- Build optimized for GitHub Pages

### ✅ Database Schema
- Tables created: users, activity_categories, activity_sources, daily_activities, handover_tasks
- Row Level Security (RLS) policies added
- Indexes created for performance

### ✅ GitHub Pages Setup
- Vite configured with base path `/act/`
- GitHub Actions workflow ready for auto-deploy
- Production build created in `dist/` folder

---

## **Required Manual Steps:**

### 1️⃣ Setup Supabase Tables (5 min)
1. Go to: https://app.supabase.com
2. Navigate to: SQL Editor → New Query
3. Copy entire content from `SUPABASE_SETUP.sql`
4. Click "Run"

### 2️⃣ Seed Initial Data (2 min)
1. In same SQL Editor, run these INSERT statements:

```sql
-- Users
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (1, 'Aan Sayudi', 'supervisor', NULL, 'Jakarta', 'aan.sayudi@majoo.id');
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (4, 'Jhovan Hidayat', 'team_leader', NULL, 'Jabodetabek', 'jhovan@majoo.id');
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (5, 'Rofbi Hidayadi', 'team_leader', NULL, 'Sumkalsulpap', 'rofby.hidayadi@majoo.id');
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (6, 'Ridho Valentin', 'team_leader', NULL, 'Jabalnusra', 'ridho.valentin@majoo.id');
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (7, 'Suro Rahadi', 'caretaker', 4, NULL, 'suro.rahardi@majoo.id');
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (8, 'Taufiq Hadiyanto', 'caretaker', 6, NULL, 'taufiq.hadiyanto@majoo.id');
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES (9, 'Rahmat Hidayat', 'caretaker', 5, NULL, 'rahmat.hidayat@majoo.id');

-- Categories
INSERT INTO activity_categories (id, name) VALUES (8, 'Administrative & CRM Tasks');
INSERT INTO activity_categories (id, name) VALUES (9, 'Special Projects');
INSERT INTO activity_categories (id, name) VALUES (10, 'Enterprise');
INSERT INTO activity_categories (id, name) VALUES (11, 'Manage Teams');
INSERT INTO activity_categories (id, name) VALUES (16, 'Meet Internal');
INSERT INTO activity_categories (id, name) VALUES (23, 'Handling Enterprise');
INSERT INTO activity_categories (id, name) VALUES (24, 'Meet Enterprise');
INSERT INTO activity_categories (id, name) VALUES (25, 'Coaching Teams');
INSERT INTO activity_categories (id, name) VALUES (26, 'Assign Leads');
INSERT INTO activity_categories (id, name) VALUES (27, 'Follow Up Data');
INSERT INTO activity_categories (id, name) VALUES (28, 'Validasi H+1');

-- Sources
INSERT INTO activity_sources (id, name) VALUES (6, 'CRM');
INSERT INTO activity_sources (id, name) VALUES (7, 'Email');
INSERT INTO activity_sources (id, name) VALUES (8, 'Daily Tasklist');
INSERT INTO activity_sources (id, name) VALUES (10, 'WhatsApp');
INSERT INTO activity_sources (id, name) VALUES (13, 'Phone');
INSERT INTO activity_sources (id, name) VALUES (16, 'Chat System');
INSERT INTO activity_sources (id, name) VALUES (17, 'Ticket System');
```

### 3️⃣ Update Remaining Pages to Use Supabase (IMPORTANT!)
❌ **NOT YET DONE** - Need to update these pages:
- `src/pages/Activity.jsx` - Update all `api.get()` calls to `supabase` queries
- `src/pages/Dashboard.jsx` - Same
- `src/pages/TodoList.jsx` - Same
- `src/pages/Reports.jsx` - Same
- `src/pages/UserManagement.jsx` - Same
- `src/pages/TemplateManagement.jsx` - Same

**Pattern to follow:**
```javascript
// OLD: api.get('/activities', { params: {...} })
// NEW: 
const { data, error } = await supabase
  .from('daily_activities')
  .select('*, activity_categories(name), activity_sources(name)')
  .eq('on_duty_user_id', userId)
  .eq('activity_date', date)
```

### 4️⃣ Deploy to GitHub Pages
1. Commit changes to GitHub:
```bash
git add .
git commit -m "Setup Supabase migration: full backend on Supabase"
git push origin master
```

2. Enable GitHub Pages in repo settings:
   - Go to https://github.com/csmajoo/act/settings/pages
   - Source: "Deploy from a branch"
   - Branch: "gh-pages"
   - Root folder: "/"

3. GitHub Actions will auto-deploy on push!

---

## **Architecture After Migration:**

```
Frontend (GitHub Pages)  ←→  Supabase (Database + Auth + API)
     ↓
   React + Vite
   Supabase JS Client
   
Published at:
https://csmajoo.github.io/act/
```

---

## **Testing Checklist:**

- [ ] Run `npm run build` - Build succeeds
- [ ] Login page loads users from Supabase ✓
- [ ] Can select user and "login"
- [ ] Categories load in Dashboard
- [ ] Can create activity (after TodoList page updated)
- [ ] Can handover task (after TodoList page updated)

---

## **Next Steps (Priority Order):**

1. **URGENT**: Update Activity.jsx, TodoList.jsx, Dashboard.jsx to use Supabase
2. **Setup Supabase RLS policies** for row-level security (optional but recommended)
3. **Add Supabase Auth** with email/password (instead of user dropdown)
4. **Migrate Google Calendar sync** to Supabase edge functions
5. **Performance optimization** - Add caching, pagination

---

## **Useful Supabase Links:**

- Supabase Documentation: https://supabase.com/docs
- Realtime docs: https://supabase.com/docs/guides/realtime
- RLS policies: https://supabase.com/docs/guides/auth/row-level-security

---

## **Credentials Already Setup:**

✅ Supabase Project: fnkbvqrvcsnwnuhjkwbe
✅ Anon Key: in `src/utils/supabase.js`
✅ GitHub repo: https://github.com/csmajoo/act

---

## **Support for Full Migration:**

Would you like me to:
1. Update ALL pages to use Supabase (requires significant refactor)
2. Keep some pages using old API pattern (hybrid approach)
3. Setup edge functions to keep backend logic

Let me know! 🚀
