import {NextResponse} from 'next/server'

// M1 stub: logs the lead-capture payload and acknowledges it. Explicitly no
// persistence — wiring this to a real store (Sanity, a CRM, email) is later
// milestone work; this only proves the client-side form has somewhere to
// POST to.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  console.log('[api/lead] received lead (not persisted):', body)

  return NextResponse.json({ok: true})
}
