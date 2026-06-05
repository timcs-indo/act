# 🚀 SUPABASE + GITHUB PAGES DEPLOYMENT - QUICK START

## Current Status: ✅ Ready to Deploy

Your application is ready for deployment! Follow these steps to go live:

---

## **STEP 1: Fix GitHub Push (5 min)**

The build succeeded but push needs authentication. Choose ONE option:

### Option A: Using Personal Access Token (Recommended)

```bash
cd "/home/aan/Claude Project/Productivity"

# Replace PAT_TOKEN with your GitHub Personal Access Token
git remote set-url origin https://YOUR_GITHUB_USERNAME:PAT_TOKEN@github.com/csmajoo/act.git

# Now try pushing
git push origin master
```

**To get PAT Token:**
1. Go to https://github.com/settings/tokens
2. Generate new token → "Tokens (classic)"
3. Select scopes: `repo` (full control of private repositories)
4. Copy the token and use in command above

### Option B: Using SSH Keys

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Add public key to GitHub: https://github.com/settings/keys
cat ~/.ssh/id_ed25519.pub  # Copy this

# Switch remote to SSH
git remote set-url origin git@github.com:csmajoo/act.git

# Try pushing
git push origin master
```

---

## **STEP 2: Setup Supabase Database (5 min)**

### 2a. Run Schema SQL

1. Open: https://app.supabase.com/project/fnkbvqrvcsnwnuhjkwbe/sql/new
2. Paste content from `/SUPABASE_SETUP.sql`
3. Click **"Run"**

### 2b. Seed Initial Data

In the same SQL editor, run:

```sql
-- Users (7 total)
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES 
(1, 'Aan Sayudi', 'supervisor', NULL, 'Jakarta', 'aan.sayudi@majoo.id'),
(4, 'Jhovan Hidayat', 'team_leader', NULL, 'Jabodetabek', 'jhovan@majoo.id'),
(5, 'Rofbi Hidayadi', 'team_leader', NULL, 'Sumkalsulpap', 'rofby.hidayadi@majoo.id'),
(6, 'Ridho Valentin', 'team_leader', NULL, 'Jabalnusra', 'ridho.valentin@majoo.id'),
(7, 'Suro Rahadi', 'caretaker', 4, NULL, 'suro.rahardi@majoo.id'),
(8, 'Taufiq Hadiyanto', 'caretaker', 6, NULL, 'taufiq.hadiyanto@majoo.id'),
(9, 'Rahmat Hidayat', 'caretaker', 5, NULL, 'rahmat.hidayat@majoo.id');

-- Categories (11 total)
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

-- Sources (7 total)
INSERT INTO activity_sources (id, name) VALUES 
(6, 'CRM'),
(7, 'Email'),
(8, 'Daily Tasklist'),
(10, 'WhatsApp'),
(13, 'Phone'),
(16, 'Chat System'),
(17, 'Ticket System');
```

4. Verify in Supabase console - you should see 7 users, 11 categories, 7 sources

---

## **STEP 3: Enable GitHub Pages (3 min)**

1. Go to: https://github.com/csmajoo/act/settings/pages
2. Under "Build and deployment":
   - **Source**: "GitHub Actions"
   - Click Save
3. GitHub will auto-build and deploy on next push!

---

## **STEP 4: Deploy Frontend**

After Step 1 (git push succeeds):

```bash
# GitHub Actions will automatically:
# 1. Install dependencies
# 2. Build the app (npm run build)
# 3. Deploy to GitHub Pages

# Check deployment status:
# https://github.com/csmajoo/act/actions
```

Your app will be live at:
### 🌐 https://csmajoo.github.io/act/

---

## **STEP 5: Update Remaining Pages (CRITICAL!) ⚠️**

The following pages MUST be updated to use Supabase instead of the old API:
- ❌ `src/pages/Activity.jsx`
- ❌ `src/pages/TodoList.jsx`
- ❌ `src/pages/Dashboard.jsx`
- ❌ `src/pages/Reports.jsx`
- ❌ `src/pages/UserManagement.jsx`
- ❌ `src/pages/TemplateManagement.jsx`

**Use the query patterns in `SUPABASE_QUERY_PATTERNS.md` to convert each API call.**

Example:
```javascript
// OLD:
const res = await api.get('/activities', { params: { date, userId } })

// NEW:
const { data, error } = await supabase
  .from('daily_activities')
  .select('*')
  .eq('on_duty_user_id', userId)
  .eq('activity_date', date)
if (error) throw error
```

---

## **Testing Locally**

```bash
cd "frontend"

# Install Supabase dependency (if not done)
npm install @supabase/supabase-js

# Run dev server
npm run dev

# Visit: http://localhost:3000
```

**Test checklist:**
- [ ] Page loads (no console errors)
- [ ] Can select a user from dropdown and "login"
- [ ] Dashboard loads (categories display)
- [ ] Navigation works

---

## **Troubleshooting**

### Build succeeds but app doesn't load?
- [ ] Check browser console for errors
- [ ] Verify Supabase tables exist (check SQL results)
- [ ] Clear browser cache

### GitHub Pages not updating?
- [ ] Check Actions tab: https://github.com/csmajoo/act/actions
- [ ] Make sure workflow didn't fail
- [ ] Wait 2-3 minutes for deployment

### Supabase queries return empty?
- [ ] Verify data was inserted (check Tables in Supabase console)
- [ ] Check if RLS policies allow read access
- [ ] Look at browser Network tab to see query response

### Can't push to GitHub?
- [ ] Follow Step 1 above (add PAT or SSH)
- [ ] Test: `git ls-remote origin` - should return data
- [ ] Try: `git push origin master -v` (verbose to see errors)

---

## **Architecture Overview**

```
┌─────────────────────────────────────┐
│  GitHub Pages (Static Frontend)     │
│  https://csmajoo.github.io/act      │
│                                     │
│  React + Vite                       │
│  (Served as static HTML/JS)         │
└────────────────┬────────────────────┘
                 │
                 │ Direct SQL Queries
                 │
┌────────────────▼────────────────────┐
│  Supabase (Database + API)          │
│  PostgreSQL + Edge Functions        │
│  fnkbvqrvcsnwnuhjkwbe.supabase.co   │
│                                     │
│  Tables:                            │
│  ├─ users                           │
│  ├─ daily_activities                │
│  ├─ handover_tasks                  │
│  ├─ activity_categories             │
│  └─ activity_sources                │
└─────────────────────────────────────┘
```

---

## **What's Already Done** ✅

- ✅ Frontend build optimized for GitHub Pages (`npm run build`)
- ✅ Login page connects to Supabase users table
- ✅ App.jsx loads categories/sources from Supabase
- ✅ Supabase client configured (`src/utils/supabase.js`)
- ✅ GitHub Actions workflow created (auto-deploy on push)
- ✅ Database schema ready (`SUPABASE_SETUP.sql`)
- ✅ Query patterns documented (`SUPABASE_QUERY_PATTERNS.md`)

---

## **What's NOT Done Yet** ❌

- ⏳ Push changes to GitHub (need git auth)
- ⏳ Execute Supabase schema (manual step in console)
- ⏳ Seed initial data (manual step in console)
- ⏳ Update Activity/TodoList/Dashboard pages to use Supabase
- ⏳ Deploy to GitHub Pages

---

## **Next Commands to Run**

```bash
# 1. Fix git auth (choose A or B above)
git remote set-url origin https://USERNAME:TOKEN@github.com/csmajoo/act.git

# 2. Push to GitHub
cd "/home/aan/Claude Project/Productivity"
git push origin master

# 3. Watch deployment
# Go to: https://github.com/csmajoo/act/actions

# 4. Once deployed, test:
# https://csmajoo.github.io/act/
```

---

## **Need Help?**

- 📚 Supabase docs: https://supabase.com/docs
- 📚 Query patterns: See `SUPABASE_QUERY_PATTERNS.md` (in this repo)
- 📚 Migration guide: See `SUPABASE_MIGRATION_GUIDE.md` (in this repo)

---

**Your app is ready! Let's go live! 🎉**
