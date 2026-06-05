# 🧪 To-Do List Feature - Testing Guide

## Pre-requisites
- ✅ Database initialized (daily_activities table with is_done column)
- ✅ Backend API running (activities routes, reports routes)
- ✅ Frontend running (React app with TodoList.jsx)
- ✅ At least 1 team with Team Leader and user roles

## Test Scenarios

### Test 1: Activity Display in To-Do List
**Objective**: Verify activities created in Calendar appear in To-Do List

**Steps**:
1. Open Calendar (Activity.jsx)
2. Create a new activity:
   - User: Your username
   - Category: "Meet Enterprise"
   - Activity Name: "Test Meeting"
   - Duration: 30 minutes
   - Date: Today
   - Time: 10:00 - 10:30
   - Click "Simpan"
3. Open To-Do List (TodoList.jsx)
4. Ensure "Test Meeting" appears in "⏳ Tugas Pending" section

**Expected Result**:
- Activity shows with correct name, duration, time, category
- Status badge shows category name
- Time range shows "10:00 - 10:30"

---

### Test 2: Edit Duration - Save & Verify
**Objective**: Verify duration can be edited and saves correctly

**Steps** (Continue from Test 1):
1. In To-Do List, find "Test Meeting" in pending section
2. Click on duration input field (shows "30")
3. Change value to "45"
4. Click "💾" (save button)
5. Wait for API response
6. Check that:
   - Duration updated to 45 in UI
   - Save button disappears
   - Go back to Calendar (Activity.jsx)
   - Check if duration changed to 45

**Expected Result**:
- Durasi updated di database
- UI reflects change immediately
- Calendar view shows updated duration

**Database Verification**:
```sql
SELECT duration FROM daily_activities 
WHERE activity_name = 'Test Meeting' 
AND activity_date = '2024-XX-XX';
-- Should return: 45
```

---

### Test 3: Mark Activity as Done
**Objective**: Verify Done button marks activity as completed

**Steps**:
1. In To-Do List, find "Test Meeting" in pending section
2. Click "✓ Done" button
3. Wait for API response
4. Verify:
   - Activity disappears from "⏳ Tugas Pending"
   - Activity appears in "✓ Tugas Selesai"
   - Name has strikethrough
   - Status badge shows "Selesai"

**Expected Result**:
- Activity moved to completed section
- UI state updated
- Productivity stats updated (minutes increased)

**Database Verification**:
```sql
SELECT is_done FROM daily_activities 
WHERE activity_name = 'Test Meeting' 
AND activity_date = '2024-XX-XX';
-- Should return: 1
```

---

### Test 4: Productivity Stats Display
**Objective**: Verify stats correctly reflect completed activities

**Steps**:
1. In To-Do List, check stats bar:
   - Should show: "Productivity: 45m (1 selesai)"
2. Undo the done status (click "Batal" button)
   - Stats should update: "Productivity: 0m (0 selesai)"
3. Mark as Done again
   - Stats should update: "Productivity: 45m (1 selesai)"

**Expected Result**:
- Stats update in real-time
- Completed count matches number of done activities
- Total minutes = sum of durations for done activities

---

### Test 5: Productivity Tracking in Dashboard
**Objective**: Verify completed activities count toward dashboard metrics

**Steps**:
1. Ensure at least 1 activity marked as Done (is_done=1) for today
2. Go to Dashboard page
3. Select date range that includes today
4. Check metrics:
   - Total Activities: should include your completed activity
   - Total Minutes: should include your activity's duration
   - By Category: should show "Meet Enterprise: 45m"
   - By Role: should show your role with your minutes

**Expected Result**:
- Dashboard metrics reflect completed activities
- Completed activities (is_done=1) counted
- Pending activities (is_done=0) NOT counted

**Database Verification**:
```sql
SELECT COUNT(*) as completed_count, 
       SUM(duration) as total_minutes
FROM daily_activities 
WHERE activity_date = '2024-XX-XX' 
AND is_done = 1;
```

---

### Test 6: Undo Done Status
**Objective**: Verify activity can be marked as not done

**Steps**:
1. In To-Do List, find completed activity in "✓ Tugas Selesai"
2. Click "Batal" button
3. Verify:
   - Activity moves back to "⏳ Tugas Pending"
   - Name no longer has strikethrough
   - Status badge removed
   - Productivity stats decreased

**Expected Result**:
- Activity reverted to pending status
- Database updated (is_done=0)
- Stats recalculated

---

### Test 7: Multiple Users/Teams
**Objective**: Verify role-based access control

**Steps** (if logged in as Supervisor):
1. In To-Do List, find "Tim" dropdown selector
2. Select different team leader
3. Select different user from that team
4. Verify:
   - Activities show only for selected user
   - Can switch between teams freely
   - Data isolated correctly

**Expected Result**:
- Activities filtered by team_leader_id
- Activities filtered by on_duty_user_id
- No cross-team data visible

---

### Test 8: Duration Edit on Completed Activity
**Objective**: Verify completed activities' duration can still be edited

**Steps**:
1. In To-Do List "✓ Tugas Selesai" section
2. Find a completed activity
3. Edit duration (e.g., 45 → 50)
4. Click "💾" Save
5. Verify:
   - Duration updated in DB
   - Productivity stats updated (50m instead of 45m)
   - Activity stays in completed section

**Expected Result**:
- Completed activities are editable
- Changes reflected in dashboard
- Stats recalculated correctly

---

### Test 9: Date Navigation
**Objective**: Verify date picker works correctly

**Steps**:
1. In To-Do List, note current date selector
2. Click "← Kemarin" button
   - Date should go back 1 day
   - Activities should refresh for that date
3. Click "Hari Ini" button
   - Should return to today
   - Activities should refresh
4. Click "Besok →" button
   - Date should go forward 1 day
   - Activities should refresh
5. Use date input to pick custom date
   - Activities should refresh for that date

**Expected Result**:
- Date navigation works correctly
- Activities fetch for correct date
- No errors in API calls

---

### Test 10: Recurrence Activities
**Objective**: Verify recurring activities show correctly in To-Do List

**Steps**:
1. In Calendar, create recurring activity (recurrence: daily for 4 days)
2. In To-Do List, view today
   - Should show the activity
3. Navigate to next day
   - Should show same activity (recurred)
4. Each instance should be independent:
   - Edit duration on day 1
   - Day 2 instance should have original duration (unless synced)

**Expected Result**:
- Recurring activities created for each date
- Each instance independent in to-do list
- Duration edits don't affect other instances

---

## API Testing with cURL

### Test Activity API
```bash
# Get activities for a date
curl "http://localhost:3000/api/activities?startDate=2024-01-15&endDate=2024-01-15&userId=1"

# Get activity by ID
curl "http://localhost:3000/api/activities/1"

# Update activity
curl -X PUT "http://localhost:3000/api/activities/1" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": 1,
    "activity_name": "Updated Name",
    "duration": 45,
    "start_time": "10:00",
    "end_time": "10:45",
    "source_id": 1,
    "notes": "Updated notes",
    "is_done": 1
  }'
```

### Test Dashboard API
```bash
# Get dashboard metrics
curl "http://localhost:3000/api/reports/dashboard?startDate=2024-01-15&endDate=2024-01-15"

# Response includes:
# {
#   "totals": {
#     "total_activities": 2,
#     "total_minutes": 90,
#     "total_days": 1,
#     "active_users": 1
#   },
#   "byCategory": [...],
#   "byRole": [...]
# }
```

---

## Debugging Checklist

If features not working:

### Activities not showing in To-Do List
- [ ] Check database: `SELECT * FROM daily_activities WHERE activity_date = '2024-XX-XX'`
- [ ] Verify correct userId selected
- [ ] Check browser console for API errors
- [ ] Verify API endpoint returns data: `GET /activities?startDate=...&endDate=...&userId=...`

### Duration not updating
- [ ] Check if input field is disabled
- [ ] Verify save button visible (isDirty state)
- [ ] Check network tab for PUT request
- [ ] Verify API response success
- [ ] Check database: `SELECT duration FROM daily_activities WHERE id = ?`

### Done button not working
- [ ] Check browser console for errors
- [ ] Verify savingId state management
- [ ] Check API request sent correctly
- [ ] Verify is_done column exists: `SELECT is_done FROM daily_activities LIMIT 1`

### Dashboard not showing productivity
- [ ] Ensure activities marked as is_done = 1
- [ ] Check date range selected on dashboard
- [ ] Verify correct team_leader_id filter
- [ ] Run dashboard query manually in database

### Stats not updating
- [ ] Check if loadActivities() called after toggle
- [ ] Verify state updates (setActivities())
- [ ] Check useMemo for stats calculation

---

## Performance Notes

- **TodoList refresh**: ~200ms (API call + state update)
- **Dashboard refresh**: ~500ms (multiple aggregation queries)
- **Recurrence generation**: ~100ms for 4-week recurrence
- **Google Calendar sync**: ~1-2s per event (if enabled)

## Known Issues & Workarounds

1. **Issue**: Activities don't immediately show in Calendar after creation
   - **Workaround**: Refresh Calendar page or navigate to different date then back

2. **Issue**: Stats sometimes show stale data
   - **Workaround**: Click date picker or refresh page

3. **Issue**: Google Calendar sync fails silently
   - **Workaround**: Check backend logs for sync errors
   - **Enable debug**: Add `console.log()` in googleCalendar.js

4. **Issue**: Permission denied error when viewing other team activities
   - **Workaround**: Ensure logged-in user has permission (Supervisor role)
   - **Check**: allowedTeamIds() function in auth middleware

---

## Test Data Setup

To prepare test environment:

```sql
-- Create test activity for today
INSERT INTO daily_activities (
  team_leader_id, on_duty_user_id, activity_date, category_id,
  activity_name, duration, start_time, end_time, source_id, is_done
) VALUES (
  1, 2, DATE('now'), 1,
  'Test Activity', 30, '10:00', '10:30', 1, 0
);

-- Create test activity for yesterday (completed)
INSERT INTO daily_activities (
  team_leader_id, on_duty_user_id, activity_date, category_id,
  activity_name, duration, start_time, end_time, source_id, is_done
) VALUES (
  1, 2, DATE('now', '-1 day'), 2,
  'Yesterday Activity', 60, '14:00', '15:00', 2, 1
);
```

---

## Success Criteria ✓

All tests pass when:
- [x] Activities display in To-Do List
- [x] Duration editable with persistence
- [x] Done button marks is_done=1
- [x] Completed activities counted in dashboard
- [x] Undo button reverts status
- [x] Stats update in real-time
- [x] No permission errors
- [x] No database errors
- [x] No API errors
- [x] UI renders correctly
