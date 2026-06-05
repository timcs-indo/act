# 📋 To-Do List Feature - Dokumentasi Lengkap

## 📌 Overview
Fitur To-Do List mengintegrasikan aktivitas yang dibuat di Calendar dengan sistem tracking produktivitas. User dapat:
- Melihat daftar aktivitas harian dari Calendar
- Mengedit durasi aktivitas (bidirectional sync dengan Calendar)
- Menandai aktivitas sebagai "Done"
- Melacak produktivitas melalui Dashboard

## 🔄 Architecture & Flow

```
Calendar (Activity.jsx)
    ↓ [Create Activity]
    ↓
Daily Activities (DB: daily_activities)
    ↓ [Fetch for date + user]
    ↓
To-Do List (TodoList.jsx)
    ├─ Pending Tasks (is_done = 0)
    │   ├─ Activity Name
    │   ├─ Editable Duration ← → Calendar
    │   └─ Done Button
    ├─ Completed Tasks (is_done = 1)
    │   ├─ Activity Name (strikethrough)
    │   ├─ Editable Duration
    │   └─ Undo Button
    └─ Productivity Stats
        └─ Used in Dashboard Reports
```

## 🗄️ Database Schema

### Table: `daily_activities`
```sql
CREATE TABLE daily_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_leader_id INTEGER,
  on_duty_user_id INTEGER,
  activity_date DATE,
  category_id INTEGER,
  activity_name TEXT,
  duration INTEGER,           -- in minutes
  start_time TEXT,            -- HH:MM format
  end_time TEXT,              -- HH:MM format
  source_id INTEGER,
  notes TEXT,
  is_done INTEGER DEFAULT 0,  -- 0=pending, 1=completed
  google_event_id TEXT,       -- for Calendar sync
  created_at DATETIME,
  updated_at DATETIME
)
```

## 🎯 Features

### 1. Display Activities
- **Location**: TodoList.jsx → `loadActivities()`
- **API**: `GET /activities?startDate=&endDate=&userId=`
- **Filtering**: By date dan user
- **Sections**: Pending (⏳) dan Completed (✓)

### 2. Editable Duration
```javascript
// User edits duration → handleDurationChange()
// Clicks Save (💾) → handleSaveDuration()
// API: PUT /activities/{id} { duration: value }
// Result: Updated di DB + Calendar jika sync_google_calendar=true
```

**Bidirectional Sync:**
- Edit durasi di To-Do List → Update durasi di Calendar view
- (Jika Google Calendar connected → Update juga di Google Calendar)

### 3. Done Button
- **Action**: Klik "✓ Done" button pada aktivitas pending
- **Handler**: `handleToggleDone(activity, true)`
- **Update**: `is_done = 1`
- **Result**: 
  - Aktivitas pindah ke section "Completed"
  - Masuk perhitungan produktivitas Dashboard
  - Durasi dihitung ke total produktivitas

### 4. Productivity Tracking
- **Source**: Activities dengan `is_done = 1`
- **Metrics**:
  - Total minutes (sum of duration untuk completed activities)
  - Total activities selesai
  - Breakdown by category, source, role
- **Dashboard**: Mengambil data dari `/reports/dashboard`

## 🔌 API Endpoints

### Get Activities
```
GET /activities
Query Params:
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD
  - userId: integer (optional)
  - teamLeaderId: integer (optional)
  
Response: Array<Activity>
```

### Update Activity (Durasi atau Status)
```
PUT /activities/{id}
Body: {
  category_id: integer,
  activity_name: string,
  duration: integer (minutes),
  start_time: string (HH:MM),
  end_time: string (HH:MM),
  source_id: integer,
  notes: string,
  is_done: 0 or 1,
  sync_google_calendar: boolean (optional)
}

Response: Success message
```

### Get Dashboard Reports
```
GET /reports/dashboard
Query Params:
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD
  - teamLeaderId: integer (optional)
  
Response: {
  teamStats: Array,
  byCategory: Array,
  bySource: Array,
  byRole: Array,
  dailyTrend: Array,
  totals: {
    total_activities: number,
    total_minutes: number,
    total_days: number,
    active_users: number
  }
}
```

## 🎨 UI Components

### TodoList.jsx
```javascript
export default function TodoList({ teamLeaders, users, currentUser }) {
  // State
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedTeamLeader, setSelectedTeamLeader] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [activities, setActivities] = useState([])
  const [editingDurations, setEditingDurations] = useState({})
  const [savingId, setSavingId] = useState(null)
  
  // Handlers
  const handleDurationChange = (id, val) => { /* ... */ }
  const handleSaveDuration = (act) => { /* ... */ }
  const handleToggleDone = (act, status) => { /* ... */ }
  const loadActivities = async () => { /* ... */ }
  
  // Render
  return (
    <div>
      {/* Filter Navigation */}
      <div>Date Picker, Team/User Selector, Stats</div>
      
      {/* Pending Section */}
      <div>
        Activities dengan is_done = 0
        - Activity Name
        - Category Badge
        - Time Range
        - Source Badge
        - Notes
        - Editable Duration Input
        - Save (💾) Button
        - Done (✓) Button
      </div>
      
      {/* Completed Section */}
      <div>
        Activities dengan is_done = 1
        - Activity Name (strikethrough)
        - Status Badge "Selesai"
        - Time Range
        - Editable Duration Input
        - Save (💾) Button
        - Undo Button
      </div>
    </div>
  )
}
```

### Stats Display
```
Productivity: [totalMinutes]m ([completedCount] selesai)
- Diupdate real-time saat user toggle done/undo
- Hanya menghitung completed activities
```

## 🔗 Integration Points

### Calendar ↔ To-Do List
1. **Create**: User buat activity di Activity.jsx → stored di daily_activities
2. **Display**: TodoList.jsx fetch dari API → filter by date & user
3. **Edit Duration**: 
   - Edit di TodoList → `PUT /activities/{id}` → Update DB
   - (Optional) Sync ke Google Calendar jika user connected
4. **Reflect Changes**: Kalender refresh otomatis (if viewing same date)

### Dashboard ↔ To-Do List
1. **Productivity Data**: 
   - Dashboard fetch `/reports/dashboard` 
   - Query: `WHERE is_done = 1`
   - Sum: `total_minutes = SUM(duration where is_done=1)`
2. **Real-time Update**:
   - User klik Done di TodoList → is_done=1
   - Dashboard akan include aktivitas ini di perhitungan next refresh

## ✅ Workflow Example

### Scenario 1: Create dan Complete Activity
```
1. User buka Activity.jsx (Calendar)
2. Klik "Input Aktivitas"
3. Isi form:
   - Activity Name: "Meet Enterprise"
   - Duration: 60 menit
   - Start Time: 09:00
   - Category: "Meet Enterprise"
   - etc
4. Klik Save → Activity created (is_done = 0, google_event_id = null/generated)

5. User buka TodoList.jsx
6. Lihat activity di section "⏳ Tugas Pending"
7. Jika durasi perlu diubah: Edit → Click 💾 Save
8. Klik "✓ Done" → Activity pindah ke "✓ Tugas Selesai"

9. Dashboard otomatis include aktivitas ini saat next refresh
   - Total minutes bertambah 60
   - Activity count bertambah 1
```

### Scenario 2: Edit Duration (Bidirectional)
```
1. User di TodoList, edit durasi 60 → 45 menit
2. Click 💾 Save
3. API: PUT /activities/{id} { duration: 45, is_done: 0 }
4. Database updated
5. Calendar view (if open) akan show durasi 45 menit
6. (If Google Calendar sync enabled) → Google Calendar juga updated
```

### Scenario 3: Undo Done Status
```
1. User lihat aktivitas selesai di "✓ Tugas Selesai"
2. Klik "Batal" button
3. API: PUT /activities/{id} { is_done: 0 }
4. Activity pindah kembali ke "⏳ Tugas Pending"
5. Dashboard productivity minutes berkurang
```

## 🔐 Permission Model

- **Supervisor**: Bisa lihat semua tim's activities
- **Team Leader**: Hanya lihat team sendiri + caretaker
- **Caretaker**: Hanya lihat activity sendiri

Enforced di backend:
```javascript
// activities.js - GET endpoint
const allowed = allowedTeamIds(req.user);
if (allowed !== null) {
  query += ` AND da.team_leader_id IN (${allowed.map(() => '?').join(',')})`
  params.push(...allowed);
}
```

## 📊 Productivity Calculation

### Dashboard Query (reports.js)
```sql
SELECT COUNT(da.id) as total_activities,
       SUM(da.duration) as total_minutes,
       COUNT(DISTINCT da.activity_date) as total_days,
       COUNT(DISTINCT da.on_duty_user_id) as active_users
FROM daily_activities da
WHERE da.activity_date BETWEEN ? AND ? 
  AND da.is_done = 1  -- ONLY COMPLETED ACTIVITIES
```

### By Category
```sql
SELECT ac.name as category, 
       COUNT(da.id) as count, 
       SUM(da.duration) as total_minutes
FROM daily_activities da
JOIN activity_categories ac ON da.category_id = ac.id
WHERE da.activity_date BETWEEN ? AND ? 
  AND da.is_done = 1
GROUP BY ac.name
```

### By Role (TL vs Caretaker)
```sql
SELECT u.role, 
       COUNT(da.id) as count, 
       SUM(da.duration) as total_minutes
FROM daily_activities da
JOIN users u ON da.on_duty_user_id = u.id
WHERE da.activity_date BETWEEN ? AND ? 
  AND da.is_done = 1
GROUP BY u.role
```

## 🐛 Testing Checklist

- [ ] Create activity di Calendar, muncul di TodoList
- [ ] Edit durasi di TodoList, reflect di Calendar
- [ ] Klik Done, activity pindah ke Completed section
- [ ] Klik Undo, activity kembali ke Pending
- [ ] Dashboard shows correct productivity metrics
- [ ] Role-based access control works
- [ ] Multiple users/teams isolated correctly
- [ ] Google Calendar sync (if enabled) works bidirectionally
- [ ] Recurrence activities (daily/weekly/etc) show correctly

## 🚀 Known Limitations

1. **Single Date View**: TodoList hanya menampilkan satu tanggal. Untuk multi-date view, perlu fetch multiple date ranges.
2. **Real-time Sync**: Tidak ada WebSocket. Changes hanya visible setelah refresh.
3. **Google Calendar**: Optional feature. Jika tidak enable, activities hanya di internal DB.
4. **Offline**: Tidak ada offline support. Semua actions memerlukan API connectivity.

## 📝 Notes

- Durasi edit langsung save ke DB (no draft mode)
- Stats refreshed otomatis setiap kali activities berubah
- Completed activities tetap editable (durasi bisa diubah)
- Undo Done → activity kembali normal, tidak ada soft delete
