import {
  PaymentReminderRequest,
  PaymentReminderResponse,
  ReminderHistoryRecord,
} from './types'
import {
  executeReminderDispatch,
  getReminderHistory,
  saveReminderHistory,
  calculateDueStatus,
  generateDefaultReminderMessage,
  normalizePhoneForWhatsApp,
  buildWhatsAppLink,
  buildSmsLink,
  extractClientPhone,
} from './engine'

export async function sendPaymentReminder(
  payload: PaymentReminderRequest
): Promise<PaymentReminderResponse> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data: PaymentReminderResponse = await res.json()
      if (data.success) {
        const local = getReminderHistory()
        if (!local.some((item) => item.id === data.reminderId)) {
          const newRecord: ReminderHistoryRecord = {
            id: data.reminderId,
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            clientName: payload.clientName,
            amount: payload.amount,
            currency: payload.currency,
            dueDate: payload.dueDate,
            channels: data.channels || payload.channels,
            message: payload.message,
            status: data.status,
            timestamp: data.timestamp,
            recipientPhone: payload.recipientPhone,
          }
          saveReminderHistory([newRecord, ...local])
        }
      }
      return data
    }
  } catch (_e) {
    // Local fallback
  }

  const { response } = executeReminderDispatch(payload)
  return response
}

export {
  getReminderHistory,
  saveReminderHistory,
  calculateDueStatus,
  generateDefaultReminderMessage,
  normalizePhoneForWhatsApp,
  buildWhatsAppLink,
  buildSmsLink,
  extractClientPhone,
}
