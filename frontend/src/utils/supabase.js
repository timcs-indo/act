import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fnkbvqrvcsnwnuhjkwbe.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZua2J2cXJ2Y3Nud251aGprd2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTMwMzQsImV4cCI6MjA5NjIyOTAzNH0.yf-PhTCXYWi3U2ZeRI5XRUjp8NG9RAlDX0YJcLJgvwc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signOut = async () => {
  await supabase.auth.signOut()
}

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  return data.session
}

// User helpers
export const getUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
  return { data, error }
}

// Activity helpers
export const getActivities = async (userId, date) => {
  const { data, error } = await supabase
    .from('daily_activities')
    .select('*, activity_categories(name), activity_sources(name)')
    .eq('on_duty_user_id', userId)
    .eq('activity_date', date)
  return { data, error }
}

export const createActivity = async (activity) => {
  const { data, error } = await supabase
    .from('daily_activities')
    .insert([activity])
    .select()
  return { data, error }
}

export const updateActivity = async (id, updates) => {
  const { data, error } = await supabase
    .from('daily_activities')
    .update(updates)
    .eq('id', id)
    .select()
  return { data, error }
}

export const deleteActivity = async (id) => {
  const { error } = await supabase
    .from('daily_activities')
    .delete()
    .eq('id', id)
  return { error }
}

// Categories & Sources
export const getCategories = async () => {
  const { data, error } = await supabase
    .from('activity_categories')
    .select('*')
  return { data, error }
}

export const getSources = async () => {
  const { data, error } = await supabase
    .from('activity_sources')
    .select('*')
  return { data, error }
}

// Handover tasks
export const getHandoverTasks = async (userId) => {
  const { data, error } = await supabase
    .from('handover_tasks')
    .select('*, activity_categories(name), activity_sources(name), assigned_from_user:assigned_from_user_id(name, role), assigned_to_user:assigned_to_user_id(name, role)')
    .eq('assigned_to_user_id', userId)
    .eq('is_processed', 0)
  return { data, error }
}

export const getOutgoingHandovers = async (userId) => {
  const { data, error } = await supabase
    .from('handover_tasks')
    .select('*, activity_categories(name), activity_sources(name), assigned_to_user:assigned_to_user_id(name, role)')
    .eq('assigned_from_user_id', userId)
  return { data, error }
}

export const createHandoverTask = async (task) => {
  const { data, error } = await supabase
    .from('handover_tasks')
    .insert([task])
    .select()
  return { data, error }
}
