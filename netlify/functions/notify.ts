interface HandlerEvent {
  path: string
  httpMethod: string
  headers: Record<string, string | undefined>
  body: string | null
  isBase64Encoded: boolean
}

interface HandlerResponse {
  statusCode: number
  headers?: Record<string, string>
  body?: string
}

export async function handler(event: HandlerEvent): Promise<HandlerResponse> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST, OPTIONS' },
      body: JSON.stringify({
        success: false,
        error: 'Method Not Allowed. Only POST is supported.',
      }),
    }
  }

  try {
    let payload: Record<string, any> = {}
    if (event.body) {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = {}
      }
    }

    const reminderId = `REM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const timestamp = new Date().toISOString()
    const channels = Array.isArray(payload.channels) && payload.channels.length > 0 ? payload.channels : ['whatsapp', 'sms']
    const hasWA = channels.includes('whatsapp')
    const hasSMS = channels.includes('sms')
    const status = hasWA && hasSMS ? 'WhatsApp + SMS opened' : hasWA ? 'WhatsApp opened' : 'SMS composer opened'
    const recipient = payload.clientName || 'Valued Customer'
    const invoiceNumber = payload.invoiceNumber || 'INV-DRAFT'

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reminderId,
        status,
        timestamp,
        channels,
        recipient,
        invoiceNumber,
        recipientPhone: payload.recipientPhone,
        data: {
          id: reminderId,
          ...payload,
          status,
          createdAt: timestamp,
        },
      }),
    }
  } catch (error: unknown) {
    console.error('Payment reminder dispatch error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to dispatch payment reminder',
      }),
    }
  }
}
