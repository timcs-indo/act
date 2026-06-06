// Bulk delete Google Calendar events created by Productivity Tracker
// Searches events with description containing "Productivity Tracker"
// and deletes them within an optional date range
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin, getUserFromAuth } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/google.ts'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authUser = await getUserFromAuth(req)
    if (!authUser) return errorResponse('Unauthorized', 401)

    const body = await req.json().catch(() => ({}))
    const { user_id, time_min, time_max } = body

    // Use the specified user OR current authenticated user
    const targetUserId = user_id || authUser.id

    const supabase = getSupabaseAdmin()
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, google_refresh_token, google_access_token, google_token_expiry')
      .eq('id', targetUserId)
      .single()

    if (userError || !targetUser) return errorResponse('User not found', 404)
    if (!targetUser.google_refresh_token) return errorResponse('Google not connected', 400)

    // Get valid access token
    const tokenResult = await getValidAccessToken(targetUser)

    // Persist new token if refreshed
    if (tokenResult.refreshed) {
      await supabase
        .from('users')
        .update({
          google_access_token: tokenResult.newAccessToken,
          google_token_expiry: tokenResult.newExpiry
        })
        .eq('id', targetUserId)
    }

    const accessToken = tokenResult.accessToken

    // Build search query - looks for events with our app marker
    const searchQuery = 'Productivity Tracker'
    const timeMin = time_min || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()  // 1 year ago default
    const timeMax = time_max || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()  // 1 year ahead default

    // List events matching the search query
    let allEvents: any[] = []
    let pageToken: string | undefined = undefined
    let pageCount = 0
    const MAX_PAGES = 10  // safety limit

    do {
      const params = new URLSearchParams({
        q: searchQuery,
        timeMin,
        timeMax,
        maxResults: '250',
        singleEvents: 'true'  // expand recurring events
      })
      if (pageToken) params.set('pageToken', pageToken)

      const listUrl = `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (!listRes.ok) {
        const err = await listRes.text()
        return errorResponse(`Failed to list events: ${err}`, 500)
      }

      const listData = await listRes.json()
      allEvents = allEvents.concat(listData.items || [])
      pageToken = listData.nextPageToken
      pageCount++
    } while (pageToken && pageCount < MAX_PAGES)

    console.log(`[Cleanup] Found ${allEvents.length} matching events`)

    // Delete each event in parallel
    const deleteResults = await Promise.all(
      allEvents.map(async (event) => {
        try {
          const delRes = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/primary/events/${event.id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` }
            }
          )
          // 200 = deleted, 404/410 = already gone (count as success)
          if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
            return { success: true, id: event.id, summary: event.summary }
          }
          return { success: false, id: event.id, error: `HTTP ${delRes.status}` }
        } catch (e) {
          return { success: false, id: event.id, error: e.message }
        }
      })
    )

    const deletedCount = deleteResults.filter(r => r.success).length
    const failedCount = deleteResults.length - deletedCount

    return jsonResponse({
      total_found: allEvents.length,
      deleted_count: deletedCount,
      failed_count: failedCount,
      sample_deleted: deleteResults.filter(r => r.success).slice(0, 5).map(r => r.summary)
    })
  } catch (e) {
    console.error('google-cleanup error:', e)
    return errorResponse(e.message, 500)
  }
})
