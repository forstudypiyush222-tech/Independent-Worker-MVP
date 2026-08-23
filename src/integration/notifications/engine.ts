import {
  DueStatus,
  PaymentReminderRequest,
  PaymentReminderResponse,
  ReminderChannel,
  ReminderHistoryRecord,
} from './types'

export const REMINDER_HISTORY_KEY = 'paymentReminderHistory'

/**
 * Normalizes phone numbers for WhatsApp deep link.
 * For 10-digit numbers in India, prepends '91'.
 */
export function normalizePhoneForWhatsApp(phone?: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''

  // Standard 10-digit mobile number (e.g., 9876543210)
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`
  }

  // 11-digit starting with 0 (e.g., 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`
  }

  // Already includes country code or international format
  return digits
}

/**
 * Builds WhatsApp prefilled deep link.
 */
export function buildWhatsAppLink(phone: string | undefined, message: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone)
  const encodedMsg = encodeURIComponent(message)
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
    : `https://wa.me/?text=${encodedMsg}`
}

/**
 * Builds SMS prefilled deep link.
 */
export function buildSmsLink(phone: string | undefined, message: string): string {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : ''
  const encodedMsg = encodeURIComponent(message)
  return cleanPhone
    ? `sms:${cleanPhone}?body=${encodedMsg}`
    : `sms:?body=${encodedMsg}`
}

/**
 * Extracts phone number if present in invoice address or fields.
 */
export function extractClientPhone(invoice: any): string | undefined {
  if (!invoice) return undefined

  if (invoice.clientPhone && typeof invoice.clientPhone === 'string') {
    return invoice.clientPhone.trim()
  }
  if (invoice.phone && typeof invoice.phone === 'string') {
    return invoice.phone.trim()
  }

  // Check clientAddress / clientAddress2 / notes for phone pattern
  const textSources = [
    invoice.clientAddress,
    invoice.clientAddress2,
    invoice.notes,
  ]
    .filter(Boolean)
    .join(' ')

  const match = textSources.match(
    /(?:Phone|Mobile|Tel|Contact|WhatsApp)?[:\s-]*(\+?91[\s-]?)?([6-9]\d{9})\b/i
  )
  if (match) {
    return match[0].trim()
  }

  return undefined
}

/**
 * Calculates due status and human-readable label from an invoice due date.
 */
export function calculateDueStatus(
  dueDateStr?: string,
  isPaid: boolean = false
): { dueStatus: DueStatus; dueLabel: string; daysDiff: number } {
  if (isPaid) {
    return { dueStatus: 'paid', dueLabel: 'Paid', daysDiff: 0 }
  }

  if (!dueDateStr) {
    return { dueStatus: 'upcoming', dueLabel: 'No due date set', daysDiff: 0 }
  }

  const dueDate = new Date(dueDateStr)
  if (isNaN(dueDate.getTime())) {
    return { dueStatus: 'upcoming', dueLabel: 'Due date unknown', daysDiff: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)

  const diffTime = dueDate.getTime() - today.getTime()
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff)
    return {
      dueStatus: 'overdue',
      dueLabel: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
      daysDiff,
    }
  }

  if (daysDiff === 0) {
    return {
      dueStatus: 'due_today',
      dueLabel: 'Due today',
      daysDiff: 0,
    }
  }

  if (daysDiff === 1) {
    return {
      dueStatus: 'due_tomorrow',
      dueLabel: 'Due tomorrow',
      daysDiff: 1,
    }
  }

  if (daysDiff <= 7) {
    return {
      dueStatus: 'due_soon',
      dueLabel: `Due in ${daysDiff} days`,
      daysDiff,
    }
  }

  return {
    dueStatus: 'upcoming',
    dueLabel: `Due in ${daysDiff} days`,
    daysDiff,
  }
}

/**
 * Generate standard payment reminder message.
 */
export function generateDefaultReminderMessage(
  clientName: string,
  invoiceNumber: string,
  formattedAmount: string,
  dueDate: string,
  dueStatus: DueStatus
): string {
  const name = clientName || 'there'
  const inv = invoiceNumber || 'your invoice'

  if (dueStatus === 'overdue') {
    return `Hi ${name}, this is a reminder that invoice ${inv} for ${formattedAmount} was due on ${dueDate || 'the due date'} and is currently overdue. Please arrange payment at your earliest convenience. Thank you.`
  }

  if (dueStatus === 'due_today') {
    return `Hi ${name}, this is a reminder that invoice ${inv} for ${formattedAmount} is due today (${dueDate}). Please arrange payment by the due date. Thank you.`
  }

  return `Hi ${name}, this is a reminder that invoice ${inv} for ${formattedAmount} is due on ${dueDate || 'the due date'}. Please arrange payment by the due date. Thank you.`
}

export const SEED_REMINDER_HISTORY: ReminderHistoryRecord[] = [
  {
    id: 'rem-init-01',
    invoiceId: 'seed-inv-1',
    invoiceNumber: 'INV-1024',
    clientName: 'Acme Corp',
    amount: 5400,
    currency: '₹',
    dueDate: 'Aug 20, 2026',
    channels: ['whatsapp', 'sms'],
    message:
      'Hi Acme Corp, this is a reminder that invoice INV-1024 for ₹5,400 is overdue. Please arrange payment. Thank you.',
    status: 'WhatsApp + SMS opened',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    recipientPhone: '+91 98765 43210',
  },
  {
    id: 'rem-init-02',
    invoiceId: 'seed-inv-2',
    invoiceNumber: 'INV-1023',
    clientName: 'Rahul Sharma',
    amount: 3100,
    currency: '₹',
    dueDate: 'Aug 29, 2026',
    channels: ['whatsapp'],
    message:
      'Hi Rahul Sharma, this is a reminder that invoice INV-1023 for ₹3,100 is due on Aug 29, 2026. Please arrange payment by the due date. Thank you.',
    status: 'WhatsApp opened',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    recipientPhone: '+91 98123 45678',
  },
]

export function getReminderHistory(): ReminderHistoryRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return SEED_REMINDER_HISTORY
  }

  const raw = window.localStorage.getItem(REMINDER_HISTORY_KEY)
  if (!raw) {
    window.localStorage.setItem(
      REMINDER_HISTORY_KEY,
      JSON.stringify(SEED_REMINDER_HISTORY)
    )
    return SEED_REMINDER_HISTORY
  }

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return SEED_REMINDER_HISTORY
  } catch {
    return SEED_REMINDER_HISTORY
  }
}

export function saveReminderHistory(records: ReminderHistoryRecord[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify(records))
    } catch (e) {
      console.warn('Failed to save reminder history:', e)
    }
  }
}

/**
 * Execute reminder dispatch and log action in history.
 */
export function executeReminderDispatch(
  request: PaymentReminderRequest
): { response: PaymentReminderResponse; record: ReminderHistoryRecord } {
  const reminderId = `REM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const timestamp = new Date().toISOString()
  const channels: ReminderChannel[] =
    request.channels && request.channels.length > 0
      ? request.channels
      : ['whatsapp', 'sms']

  const hasWA = channels.includes('whatsapp')
  const hasSMS = channels.includes('sms')
  const statusText =
    hasWA && hasSMS
      ? 'WhatsApp + SMS opened'
      : hasWA
      ? 'WhatsApp opened'
      : 'SMS composer opened'

  const record: ReminderHistoryRecord = {
    id: reminderId,
    invoiceId: request.invoiceId,
    invoiceNumber: request.invoiceNumber || 'INV-DRAFT',
    clientName: request.clientName || 'Valued Customer',
    amount: request.amount || 0,
    currency: request.currency || '₹',
    dueDate: request.dueDate || 'Due Date',
    channels,
    message: request.message,
    status: statusText,
    timestamp,
    recipientPhone: request.recipientPhone,
  }

  if (typeof window !== 'undefined') {
    const current = getReminderHistory()
    saveReminderHistory([record, ...current])
  }

  const response: PaymentReminderResponse = {
    success: true,
    reminderId,
    status: statusText,
    timestamp,
    channels,
    recipient: request.clientName || 'Valued Customer',
    invoiceNumber: request.invoiceNumber || 'INV-DRAFT',
    recipientPhone: request.recipientPhone,
  }

  return { response, record }
}
