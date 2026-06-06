// Environment detection utility
// Auto-detect if running locally or deployed on GitHub Pages

export const isProduction = () => {
  return window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
}

export const isDevelopment = () => {
  return !isProduction()
}

// Check if we should use Supabase mode (set via VITE_USE_SUPABASE env)
// When VITE_USE_SUPABASE=true → use Supabase as backend (both local dev & production)
// Otherwise → use Node.js backend at localhost:5000 (legacy)
export const isSupabaseMode = () => {
  return import.meta.env.VITE_USE_SUPABASE === 'true'
}

export const getApiBaseUrl = () => {
  // If Supabase mode flag is set, return special marker
  if (isSupabaseMode()) {
    return 'supabase'
  }
  // Otherwise: use Node.js backend (only viable in local dev)
  if (isDevelopment()) {
    return 'http://localhost:5000/api'
  }
  // Production without Supabase: no backend
  return import.meta.env.VITE_API_URL || null
}

console.log(`[Environment] Running in ${isProduction() ? 'PRODUCTION' : 'DEVELOPMENT'} mode`)
console.log(`[API Mode] ${isSupabaseMode() ? 'Supabase' : (getApiBaseUrl() || 'Not configured')}`)
