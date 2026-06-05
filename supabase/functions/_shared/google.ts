// Shared Google OAuth & Calendar utilities

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')

export function getClientId(): string {
  return Deno.env.get('GOOGLE_CLIENT_ID') || ''
}

export function getClientSecret(): string {
  return Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
}

export function getRedirectUri(): string {
  // Default to Supabase Edge Function URL for callback
  return Deno.env.get('GOOGLE_REDIRECT_URI') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-callback`
}

export function getFrontendUrl(): string {
  return Deno.env.get('FRONTEND_URL') || 'https://csmajoo.github.io/act/'
}

// Build Google OAuth consent URL
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state
  })
  return `${GOOGLE_OAUTH_URL}?${params.toString()}`
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<any> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code'
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  return await res.json()
}

// Refresh an expired access token
export async function refreshAccessToken(refreshToken: string): Promise<any> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token'
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }

  return await res.json()
}

// Get user's email from Google
export async function getGoogleUserInfo(accessToken: string): Promise<{ email: string }> {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) throw new Error('Failed to get user info')
  return await res.json()
}

// Get valid access token for user (refresh if needed)
export async function getValidAccessToken(user: {
  google_access_token?: string
  google_refresh_token?: string
  google_token_expiry?: number
}): Promise<{ accessToken: string; refreshed: boolean; newExpiry?: number; newAccessToken?: string }> {
  const now = Date.now()
  const expiry = user.google_token_expiry || 0

  // If token still valid (with 60s buffer), use it
  if (user.google_access_token && expiry > now + 60000) {
    return { accessToken: user.google_access_token, refreshed: false }
  }

  // Refresh the token
  if (!user.google_refresh_token) throw new Error('No refresh token')
  const tokens = await refreshAccessToken(user.google_refresh_token)
  const newExpiry = Date.now() + (tokens.expires_in * 1000)

  return {
    accessToken: tokens.access_token,
    refreshed: true,
    newAccessToken: tokens.access_token,
    newExpiry
  }
}

// Normalize time string to HH:MM:SS format
function normalizeTime(timeStr: string): string {
  if (!timeStr) return '00:00:00'
  // Handle "HH:MM" or "HH:MM:SS" format
  const parts = timeStr.split(':')
  if (parts.length === 2) {
    return `${parts[0]}:${parts[1]}:00`
  } else if (parts.length === 3) {
    return timeStr
  }
  return timeStr
}

// Build Google Calendar event from activity
export function buildCalendarEvent(activity: any, includeMeet = false): any {
  const tz = Deno.env.get('GOOGLE_CALENDAR_TZ') || 'Asia/Jakarta'

  const summary = activity.activity_name || activity.category_name || 'Aktivitas'
  const descLines = []
  if (activity.category_name) descLines.push(`Kategori: ${activity.category_name}`)
  if (activity.source_name) descLines.push(`Sumber: ${activity.source_name}`)
  if (activity.on_duty_name) descLines.push(`Petugas: ${activity.on_duty_name}`)
  if (activity.notes) descLines.push(`Catatan: ${activity.notes}`)
  descLines.push('— Productivity Tracker')

  const event: any = {
    summary,
    description: descLines.join('\n')
  }

  if (activity.start_time) {
    const startTime = normalizeTime(activity.start_time)
    const endTime = normalizeTime(activity.end_time || activity.start_time)
    event.start = {
      dateTime: `${activity.activity_date}T${startTime}`,
      timeZone: tz
    }
    event.end = {
      dateTime: `${activity.activity_date}T${endTime}`,
      timeZone: tz
    }
  } else {
    event.start = { date: activity.activity_date }
    event.end = { date: activity.activity_date }
  }

  if (includeMeet && activity.start_time) {
    event.conferenceData = {
      createRequest: {
        requestId: `meet-${activity.id}-${Date.now()}`,
        conferenceSolutionKey: { key: 'hangoutsMeet' }
      }
    }
  }

  return event
}

// Create a calendar event
export async function createCalendarEvent(
  accessToken: string,
  event: any,
  includeMeet = false
): Promise<string> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events${includeMeet ? '?conferenceDataVersion=1' : ''}`
  console.log('[createCalendarEvent] URL:', url)
  console.log('[createCalendarEvent] Event payload:', JSON.stringify(event, null, 2))

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[createCalendarEvent] Failed:', err)

    // Try once more without Meet conference data if that was the issue
    if (includeMeet && err.includes('conferenceData')) {
      console.log('[createCalendarEvent] Retrying without Meet...')
      delete event.conferenceData
      const retryRes = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      })
      if (retryRes.ok) {
        const data = await retryRes.json()
        return data.id
      }
      const retryErr = await retryRes.text()
      throw new Error(`Create event failed (after retry): ${retryErr}`)
    }

    throw new Error(`Create event failed: ${err}`)
  }

  const data = await res.json()
  return data.id
}

// Update a calendar event
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: any,
  includeMeet = false
): Promise<string> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}${includeMeet ? '?conferenceDataVersion=1' : ''}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })

  if (res.status === 404 || res.status === 410) {
    // Event was deleted - recreate
    return await createCalendarEvent(accessToken, event, includeMeet)
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Update event failed: ${err}`)
  }

  const data = await res.json()
  return data.id
}

// Delete a calendar event
export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  // Ignore 404/410 (already deleted)
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.text()
    throw new Error(`Delete event failed: ${err}`)
  }
}
