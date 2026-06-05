# 🗄️ Database Migration Guide - is_done Column

## Why This Might Be Needed

If you see this error in console:
```
❌ no such column: is_done
```

It means the database doesn't have the `is_done` column yet.

---

## ✅ Option 1: Easy Fix (Recommended)

Delete the database and let it recreate itself with all columns.

### Step-by-Step:

**Terminal - Backend Folder:**
```bash
cd /home/aan/Claude\ Project/Productivity/backend

# Step 1: Stop backend if running
# (Press Ctrl+C if you see "listening on port 3000")

# Step 2: Delete old database
rm productivity.db

# Step 3: Start backend (it will recreate the database)
npm run dev
```

**Expected output:**
```
✓ listening on port 3000
✓ Database initialized
```

**Then:**
```bash
# In browser
Ctrl+Shift+R  (hard refresh)
Go back to To-Do List
Try Done button again
```

---

## ⚙️ Option 2: Manual Migration (If Option 1 Doesn't Work)

### Step 1: Open Database Browser

**Terminal:**
```bash
cd /home/aan/Claude\ Project/Productivity/backend
sqlite3 productivity.db
```

You should see:
```
SQLite version 3.x.x
sqlite>
```

### Step 2: Check If Column Exists

**Type in sqlite3 prompt:**
```sql
PRAGMA table_info(daily_activities);
```

**Look for a line like:**
```
0|id|INTEGER|1||1
1|team_leader_id|INTEGER|1||0
...
16|is_done|INTEGER|0|0|0
```

If you see `is_done` → **Column already exists**, exit and try Step 3

If you DON'T see `is_done` → **Column is missing**, do Step 3

### Step 3: Add Missing Column

**In sqlite3 prompt, type:**
```sql
ALTER TABLE daily_activities ADD COLUMN is_done INTEGER DEFAULT 0;
```

**Press Enter. You should see:**
```
sqlite>
```

(No error = success)

### Step 4: Verify Column Was Added

**Type:**
```sql
PRAGMA table_info(daily_activities);
```

You should now see `is_done` in the list.

### Step 5: Exit SQLite

**Type:**
```sql
.quit
```

You're back to bash prompt.

### Step 6: Restart Backend

**Type:**
```bash
npm run dev
```

Wait for `✓ listening on port 3000`

### Step 7: Test

```bash
# In browser
Ctrl+Shift+R  (hard refresh)
Go to To-Do List
Click Done button
```

---

## 🔍 Option 3: Verify Column Structure

If you want to see the EXACT column definition:

**Terminal:**
```bash
cd /home/aan/Claude\ Project/Productivity/backend
sqlite3 productivity.db

# Type:
.schema daily_activities
```

**You should see something like:**
```
CREATE TABLE daily_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_leader_id INTEGER NOT NULL,
  ...
  is_done INTEGER DEFAULT 0,
  ...
);
```

If you see `is_done INTEGER DEFAULT 0` → Column is correct ✅

---

## 🆘 What If It Still Doesn't Work?

### Check 1: Is Column Really There?

```bash
sqlite3 /home/aan/Claude\ Project/Productivity/backend/productivity.db

# Type:
SELECT COUNT(*) FROM pragma_table_info('daily_activities') WHERE name='is_done';
```

**Result:**
- If returns `1` → Column exists ✅
- If returns `0` → Column doesn't exist ❌

If column exists but still getting error, the migration might be cached. Try:
```bash
# Stop backend (Ctrl+C)
# Delete database and restart
rm /home/aan/Claude\ Project/Productivity/backend/productivity.db
npm run dev
```

---

### Check 2: Is Database File Accessible?

```bash
ls -la /home/aan/Claude\ Project/Productivity/backend/productivity.db
```

**Expected output:**
```
-rw-r--r-- 1 aan aan XXXXX [date] productivity.db
```

If you see `cannot access`: File doesn't exist, it's being deleted. Backend will recreate it.

---

### Check 3: Are Other Columns There?

```bash
sqlite3 /home/aan/Claude\ Project/Productivity/backend/productivity.db

# Type:
SELECT id, activity_name, duration FROM daily_activities LIMIT 1;
```

If this works, database is fine. If error like `no such table`, database is corrupted. Delete and restart backend.

---

## 📋 Quick Checklist

- [ ] Stopped backend (Ctrl+C)
- [ ] Deleted productivity.db file (`rm productivity.db`)
- [ ] Restarted backend (`npm run dev`)
- [ ] Saw "Database initialized" message
- [ ] Waited 3 seconds for database to initialize
- [ ] Refreshed browser (Ctrl+Shift+R)
- [ ] Went back to To-Do List
- [ ] Clicked Done button
- [ ] Checked console for error messages
- [ ] Checked backend terminal for 🔧 logs

If all checked, Done button should work! ✅

---

## 🎯 Summary

1. **Easy way**: Delete database, restart backend
2. **Manual way**: Use sqlite3 to add column manually
3. **Verify way**: Query database to confirm column exists

**Most people need Option 1 - just delete the database and restart!** 🚀
