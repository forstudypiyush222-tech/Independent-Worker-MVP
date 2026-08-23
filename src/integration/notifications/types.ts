export type DueStatus = 'overdue' | 'due_today' | 'due_tomorrow' | 'due_soon' | 'paid' | 'upcoming'

export type ReminderChannel = 'whatsapp' | 'sms'

export interface InvoiceReminderItem {
  id: string
  invoiceNumber: string
  clientName: string
  amount: number
  currency?: string
  dueDate: string
  status: 'paid' | 'pending' | 'overdue'
  dueStatus: DueStatus
  dueLabel: string
  daysDiff: number
  contactNumber?: string
}

export interface PaymentReminderRequest {
  invoiceId: string
  invoiceNumber: string
  clientName: string
  amount: number
  currency?: string
  dueDate: string
  channels: ReminderChannel[]
  message: string
  recipientPhone?: string
}

export interface PaymentReminderResponse {
  success: boolean
  reminderId: string
  status: string
  timestamp: string
  channels: ReminderChannel[]
  recipient: string
  invoiceNumber: string
  recipientPhone?: string
  actionUrl?: string
  error?: string
}

export interface ReminderHistoryRecord {
  id: string
  invoiceId: string
  invoiceNumber: string
  clientName: string
  amount: number
  currency?: string
  dueDate: string
  channels: ReminderChannel[]
  message: string
  status: string
  timestamp: string
  recipientPhone?: string
}
