# 🔧 DEBUG GUIDE - Done Button Issue

## Problem
Task tidak pindah ke section "Tugas Selesai" ketika klik button "Done"

---

## 🧪 Step-by-Step Debugging

### Step 1: Open Browser Console (MANDATORY!)
```
1. Press F12 (atau Ctrl+Shift+I)
2. Click "Console" tab
3. Clear any old messages (Ctrl+L)
```

### Step 2: Click Done Button & Watch Console
```
1. Click "✓ Done" on any task
2. Look at console IMMEDIATELY - you should see:

   📝 [HH:MM:SS] Updating activity 123: {
     current_is_done: 0,
     new_is_done: 1,
     activity_name: "...",
     ...
   }
   
3. Wait 1-2 seconds for API response. You should see:

   ✅ [HH:MM:SS] PUT response: { success: true }
   
   OR
   
   ❌ Error message (if something failed)
```

### Step 3: Check What Errors You See
**Take screenshot of console and look for:**

#### A) SUCCESS CASE (Working!):
```
📝 [HH:MM:SS] Updating activity 123: { ... }
📤 Sending PUT request to /activities/123 { ... }
✅ [HH:MM:SS] PUT response: { success: true }
🔄 Reloading activities...
✅ Loaded X activities: [ ... ]
✅ Verified: Activity 123 is_done = 1 (expected 1)
✅ SUCCESS: Activity moved to Completed section
```
**Result**: Task moves to "Tugas Selesai" ✅

#### B) DATABASE UPDATE FAILED:
```
📝 Updating activity 123...
✅ PUT response: { success: true }
🔄 Reloading activities...
✅ Loaded X activities...
❌ ERROR: Activity 123 not found in reloaded list!
```
**Problem**: Activity was updated in DB but not returned from API
**Solution**: Check database directly

#### C) API ERROR:
```
📝 Updating activity 123...
📤 Sending PUT request...
❌ Exception in handleToggleDone: [Error details]
Error response: { error: "..." }
```
**Problem**: Server returned error
**Solution**: Check backend logs and error message

#### D) NETWORK ERROR:
```
❌ Exception: Network Error / Failed to fetch
```
**Problem**: Cannot reach backend server
**Solution**: Check if backend is running (`npm run dev`)

---

## 📋 Checklist: What to Verify

### ✅ 1. Backend is Running
```bash
# Terminal where backend runs
npm run dev
# Should show: "listening on port 3000" (or similar)
```

### ✅ 2. Check Backend Logs
```
When you click Done, backend should log something like:
```

### ✅ 3. Verify is_done Column Exists
Open database browser or terminal:
```sql
SELECT * FROM daily_activities LIMIT 1;
-- Should show 'is_done' column
```

### ✅ 4. Check Activity Data Type
```sql
-- Verify is_done is INTEGER, not TEXT
PRAGMA table_info(daily_activities);
-- Look for: is_done | INTEGER | ...
```

### ✅ 5. Manually Test Activity Update
```sql
-- Get an activity
SELECT id, activity_name, is_done FROM daily_activities LIMIT 1;
-- Note the ID, let's say it's 123

-- Update it manually
UPDATE daily_activities SET is_done = 1 WHERE id = 123;

-- Verify
SELECT id, activity_name, is_done FROM daily_activities WHERE id = 123;
-- Should show: is_done = 1
```

---

## 🔍 Detailed Debugging Scenarios

### Scenario A: Console Shows ✅ SUCCESS but Task Doesn't Move

**Possible causes:**
1. Browser cache issue
2. React state not properly updated
3. Frontend filter issue

**Fix:**
```
1. Press Ctrl+Shift+Delete (clear cache)
2. Close browser completely
3. Reopen browser
4. Go back to To-Do List
5. Try again
```

---

### Scenario B: Console Shows ❌ API ERROR

**Look for error message in console:**

```
If error is: "Invalid parameter: is_done"
→ Database column issue. Run this:
  ALTER TABLE daily_activities ADD COLUMN is_done INTEGER DEFAULT 0;

If error is: "Activity not found"
→ Activity ID issue. Check console for which ID was sent.

If error is: "Unknown column 'is_done'"
→ Column doesn't exist. Add it to database.

If error is: "Database locked"
→ Database is being accessed by someone else. Restart backend.
```

---

### Scenario C: Console Shows ❌ NETWORK ERROR

**Cause**: Backend not running or wrong port

**Fix:**
```bash
1. Check if backend is running:
   Terminal → npm run dev (in /backend folder)

2. Check port is correct:
   localhost:3000 should be backend
   localhost:5173 should be frontend

3. Check no other app using port 3000:
   lsof -i :3000 (macOS/Linux)
   netstat -ano | findstr :3000 (Windows)
```

---

### Scenario D: Console Shows ⚠️ WARNING: is_done VALUE MISMATCH

**Example:**
```
⚠️ WARNING: is_done value mismatch! 
Got 0, expected 1
```

**Cause**: Backend update silently failed or database constraint issue

**Debug steps:**
1. Check backend logs for error messages
2. Run manual SQL update test
3. Check if any triggers/constraints exist on table

```sql
-- Check for triggers
SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='daily_activities';

-- Check for constraints
PRAGMA foreign_key_list(daily_activities);
```

---

## 🛠️ Step-by-Step Fix (Most Common Issues)

### Fix #1: Add is_done Column (If Missing)

```sql
ALTER TABLE daily_activities ADD COLUMN is_done INTEGER DEFAULT 0;
```

Then:
```bash
# Restart both backend and frontend
npm run dev  # in both /backend and /frontend terminals
```

### Fix #2: Clear Cache & Reload

```
1. F12 → Right-click refresh button → "Empty Cache and Hard Reload"
   OR
   Ctrl+Shift+R (full reload)

2. Go back to To-Do List
3. Try clicking Done again
```

### Fix #3: Restart Backend

```bash
# In backend terminal:
Ctrl+C  (stop current process)
npm run dev  (restart)
```

Then try clicking Done again.

---

## 📊 Expected Console Output Examples

### ✅ Working Correctly:
```
📝 [14:30:45] Updating activity 5: {
  current_is_done: 0,
  new_is_done: 1,
  activity_name: "Checkpoint Pagi Pagi All CX Leader",
  team_leader_id: 3,
  on_duty_user_id: 2
}
📤 Sending PUT request to /activities/5 {
  category_id: 1,
  activity_name: "Checkpoint Pagi Pagi All CX Leader",
  duration: 60,
  start_time: "08:45",
  end_time: "09:45",
  source_id: null,
  notes: null,
  is_done: 1
}
✅ [14:30:46] PUT response: { success: true }
🔄 Reloading activities...
✅ Loaded 2 activities: [
  { id: 5, activity_name: "...", is_done: 1 },
  { id: 6, activity_name: "...", is_done: 0 }
]
✅ Verified: Activity 5 is_done = 1 (expected 1)
✅ SUCCESS: Activity moved to Completed section
```

### ❌ Database Missing is_done Column:
```
❌ Exception in handleToggleDone: Error: no such column: is_done
Error response: { error: "no such column: is_done" }
```
**Fix**: Run SQL migration above

### ❌ Backend Not Responding:
```
❌ Exception in handleToggleDone: TypeError: Failed to fetch
Error response: undefined
```
**Fix**: Check if backend is running

---

## 📲 When Reporting Issue

If the above doesn't fix it, please provide:

1. **Screenshot of console output** when clicking Done
2. **Console error message** (full text)
3. **Backend logs** (screenshot or text)
4. **Database check results**:
   ```sql
   SELECT * FROM daily_activities WHERE is_done IN (0,1) LIMIT 5;
   ```
5. **Verify backend is running** on port 3000

---

## ✅ Success Criteria

When it's working correctly:

- ✅ Click Done button
- ✅ Console shows: "🔄 Reloading activities..."
- ✅ Console shows: "✅ SUCCESS: Activity moved to Completed section"
- ✅ Task immediately moves to "Tugas Selesai" section
- ✅ "Tugas Selesai" badge appears on activity
- ✅ Text gets strikethrough
- ✅ Border color changes to green

---

## 🔧 Quick Troubleshooting Checklist

```
[ ] Is backend running? (npm run dev in /backend)
[ ] Is frontend running? (npm run dev in /frontend)
[ ] Is F12 Console open and showing logs?
[ ] Does console show "✅ SUCCESS" message?
[ ] Did you clear cache (Ctrl+Shift+R)?
[ ] Did you hard refresh page after backend restart?
[ ] Is is_done column in database?
[ ] Are there any red error messages in console?
[ ] Check backend logs for error messages
[ ] Is database accessible?
```

---

**Try these steps and check console carefully!**
The console logs will tell you exactly what's wrong. 🔍
