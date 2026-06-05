# Supabase Query Patterns - Quick Reference

## Converting API Calls to Supabase

### Pattern 1: List Activities for Today

**OLD (API):**
```javascript
const res = await api.get('/activities', { 
  params: { date, userId: currentUser.id } 
})
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('daily_activities')
  .select(`
    *,
    activity_categories:activity_category_id(name),
    activity_sources:activity_source_id(name),
    assigned_to_user:assigned_to_user_id(name, role)
  `)
  .eq('on_duty_user_id', currentUser.id)
  .eq('activity_date', date)
  .order('created_at', { ascending: false })

if (error) throw error
setActivities(data)
```

---

### Pattern 2: Create Activity

**OLD (API):**
```javascript
const res = await api.post('/activities', {
  category_id: categoryId,
  source_id: sourceId,
  description: desc,
  activity_date: date
})
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('daily_activities')
  .insert([{
    on_duty_user_id: currentUser.id,
    activity_category_id: categoryId,
    activity_source_id: sourceId,
    description: desc,
    activity_date: date,
    created_at: new Date().toISOString()
  }])
  .select()

if (error) throw error
setActivities([...activities, data[0]])
```

---

### Pattern 3: Update Activity

**OLD (API):**
```javascript
await api.put(`/activities/${id}`, {
  category_id: categoryId,
  description: desc
})
```

**NEW (Supabase):**
```javascript
const { error } = await supabase
  .from('daily_activities')
  .update({
    activity_category_id: categoryId,
    description: desc
  })
  .eq('id', id)

if (error) throw error
setActivities(activities.map(a => a.id === id ? {...a, activity_category_id: categoryId, description: desc} : a))
```

---

### Pattern 4: Delete Activity

**OLD (API):**
```javascript
await api.delete(`/activities/${id}`)
```

**NEW (Supabase):**
```javascript
const { error } = await supabase
  .from('daily_activities')
  .delete()
  .eq('id', id)

if (error) throw error
setActivities(activities.filter(a => a.id !== id))
```

---

### Pattern 5: Get Handover Tasks (Incoming)

**OLD (API):**
```javascript
const res = await api.get(`/tasks/handover/${userId}`)
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('handover_tasks')
  .select(`
    *,
    activity_categories:activity_category_id(name),
    activity_sources:activity_source_id(name),
    assigned_from_user:assigned_from_user_id(name, role),
    assigned_to_user:assigned_to_user_id(name, role)
  `)
  .eq('assigned_to_user_id', userId)
  .order('is_processed', { ascending: true })
  .order('assigned_date', { ascending: false })

if (error) throw error
setHandoverTasks(data)
```

---

### Pattern 6: Get Outgoing Handover Tasks (Handed From)

**OLD (API):**
```javascript
const res = await api.get(`/tasks/handover-from/${userId}`)
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('handover_tasks')
  .select(`
    *,
    activity_categories:activity_category_id(name),
    activity_sources:activity_source_id(name),
    assigned_to_user:assigned_to_user_id(name, role)
  `)
  .eq('assigned_from_user_id', userId)
  .order('is_processed', { ascending: true })
  .order('assigned_date', { ascending: false })

if (error) throw error
setOutgoingHandovers(data)
```

---

### Pattern 7: Create Handover Task

**OLD (API):**
```javascript
await api.post('/tasks', {
  activity_id: id,
  assigned_to_user_id: toUserId,
  notes: description
})
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('handover_tasks')
  .insert([{
    activity_id: id,
    assigned_from_user_id: currentUser.id,
    assigned_to_user_id: toUserId,
    activity_category_id: categoryId,
    activity_source_id: sourceId,
    description: description,
    assigned_date: new Date().toISOString(),
    is_processed: 0
  }])
  .select()

if (error) throw error
// Add to state...
```

---

### Pattern 8: Mark Handover as Done

**OLD (API):**
```javascript
await api.put(`/tasks/${id}`, { is_processed: 1 })
```

**NEW (Supabase):**
```javascript
const { error } = await supabase
  .from('handover_tasks')
  .update({ is_processed: 1 })
  .eq('id', id)

if (error) throw error
// Update state...
```

---

### Pattern 9: Get All Users (for dropdowns, etc.)

**OLD (API):**
```javascript
const res = await api.get('/users')
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .order('name')

if (error) throw error
setUsers(data)
```

---

### Pattern 10: Get Team Leaders Only

**OLD (API):**
```javascript
const res = await api.get('/users?role=team_leader')
```

**NEW (Supabase):**
```javascript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'team_leader')
  .order('name')

if (error) throw error
setTeamLeaders(data)
```

---

## Key Differences to Remember:

| OLD API | NEW Supabase |
|---------|-------------|
| `res.data` | `data` |
| API error: `error.response.data` | Supabase error: `error.message` |
| `api.get()` | `supabase.from().select()` |
| `api.post()` | `supabase.from().insert()` |
| `api.put()` | `supabase.from().update()` |
| `api.delete()` | `supabase.from().delete()` |
| Column: `category_id` | Column: `activity_category_id` |
| Column: `source_id` | Column: `activity_source_id` |
| Column: `assigned_to` | Column: `assigned_to_user_id` |

---

## Select Relationships (Joins):

For nested data, use this format in `.select()`:

```javascript
// Get activity with related category and source
.select(`
  *,
  activity_categories:activity_category_id(name),
  activity_sources:activity_source_id(name)
`)

// Get handover with all related info
.select(`
  *,
  activity_categories:activity_category_id(name),
  activity_sources:activity_source_id(name),
  assigned_from_user:assigned_from_user_id(name, role),
  assigned_to_user:assigned_to_user_id(name, role)
`)
```

---

## Error Handling Pattern:

```javascript
try {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')

  if (error) {
    console.error('Supabase error:', error.message)
    throw error
  }

  // Use data...
  setState(data)
} catch (error) {
  console.error('Failed to fetch:', error)
  // Show user-friendly error message
}
```

---

## Important Notes:

1. **Always destructure**: `const { data, error } = ...`
2. **Always check error**: `if (error) throw error`
3. **Column names changed**: `category_id` → `activity_category_id`, `source_id` → `activity_source_id`
4. **Import**: `import { supabase } from '../utils/supabase'`
5. **No await on .select()**: The query runs immediately, not deferred

---

## Debugging Supabase Queries:

```javascript
// See what's being sent
console.log('Query result:', data, error)

// Check data shape
console.log('Columns:', Object.keys(data[0] || {}))

// Verify joins worked
console.log('Has category?', data[0]?.activity_categories)
```
