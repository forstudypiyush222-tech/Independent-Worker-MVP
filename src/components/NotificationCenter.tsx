import { useState, useEffect } from 'react'
import './NotificationCenter.css'
import {
  InvoiceReminderItem,
  PaymentReminderResponse,
  ReminderChannel,
  ReminderHistoryRecord,
} from '../integration/notifications/types'
import {
  calculateDueStatus,
  generateDefaultReminderMessage,
  getReminderHistory,
  sendPaymentReminder,
  buildWhatsAppLink,
  buildSmsLink,
  extractClientPhone,
} from '../integration/notifications/notificationService'
import { formatCurrency } from '../utils/currency'
import { Invoice } from '../data/types'

interface NotificationCenterProps {
  onBackToDashboard?: () => void
}

type InvoiceRecord = {
  id: string
  invoice: Invoice
  amount: number
  status: 'paid' | 'pending' | 'overdue'
}

export default function NotificationCenter({
  onBackToDashboard,
}: NotificationCenterProps) {
  const [invoices, setInvoices] = useState<InvoiceReminderItem[]>([])
  const [selectedInvoice, setSelectedInvoice] =
    useState<InvoiceReminderItem | null>(null)

  // Channels selection
  const [useWhatsApp, setUseWhatsApp] = useState(true)
  const [useSMS, setUseSMS] = useState(false)

  // Custom/Preview message
  const [customMessage, setCustomMessage] = useState('')

  // Dispatch state & history
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] =
    useState<PaymentReminderResponse | null>(null)
  const [history, setHistory] = useState<ReminderHistoryRecord[]>([])

  // Load existing invoice data from localStorage
  useEffect(() => {
    let items: InvoiceReminderItem[] = []

    const savedRecords = window.localStorage.getItem('invoiceRecords')
    if (savedRecords) {
      try {
        const records: InvoiceRecord[] = JSON.parse(savedRecords)
        items = records.map((rec) => {
          const { dueStatus, dueLabel, daysDiff } = calculateDueStatus(
            rec.invoice.invoiceDueDate,
            rec.status === 'paid'
          )
          const contactNumber = rec.invoice.clientPhone?.trim() || extractClientPhone(rec.invoice)
          return {
            id: rec.id,
            invoiceNumber:
              rec.invoice.invoiceTitle ||
              `INV-${rec.id.slice(0, 6).toUpperCase()}`,
            clientName: rec.invoice.clientName || 'Unnamed Customer',
            amount: rec.amount || 0,
            currency: rec.invoice.currency,
            dueDate: rec.invoice.invoiceDueDate || 'Not set',
            status: rec.status,
            dueStatus,
            dueLabel,
            daysDiff,
            contactNumber,
          }
        })
      } catch {
        items = []
      }
    }

    // If no records in list, check active single invoiceData
    if (items.length === 0) {
      const activeInvoiceRaw = window.localStorage.getItem('invoiceData')
      if (activeInvoiceRaw) {
        try {
          const activeInvoice: Invoice = JSON.parse(activeInvoiceRaw)
          if (activeInvoice.clientName || activeInvoice.invoiceTitle) {
            const subtotal = (activeInvoice.productLines || []).reduce(
              (tot, line) =>
                tot + (Number(line.quantity) || 0) * (Number(line.rate) || 0),
              0
            )
            const total = subtotal * 1.1 // 10% standard tax estimate
            const { dueStatus, dueLabel, daysDiff } = calculateDueStatus(
              activeInvoice.invoiceDueDate,
              false
            )
            const contactNumber = activeInvoice.clientPhone?.trim() || extractClientPhone(activeInvoice)
            items.push({
              id: 'active-inv',
              invoiceNumber: activeInvoice.invoiceTitle || 'INV-001',
              clientName: activeInvoice.clientName || 'Rahul',
              amount: total || 3410,
              currency: activeInvoice.currency || '₹',
              dueDate: activeInvoice.invoiceDueDate || 'Aug 29, 2026',
              status: 'pending',
              dueStatus,
              dueLabel,
              daysDiff,
              contactNumber,
            })
          }
        } catch {
          // ignore
        }
      }
    }

    // Default fallback so user always has representative invoices to test
    if (items.length === 0) {
      items = [
        {
          id: 'sample-inv-1',
          invoiceNumber: 'INV-12',
          clientName: 'Rahul',
          amount: 3410,
          currency: '₹',
          dueDate: 'Aug 29, 2026',
          status: 'pending',
          dueStatus: 'due_soon',
          dueLabel: 'Due in 6 days',
          daysDiff: 6,
          contactNumber: '+91 98765 43210',
        },
        {
          id: 'sample-inv-2',
          invoiceNumber: 'INV-10',
          clientName: 'Acme Services',
          amount: 5200,
          currency: '₹',
          dueDate: 'Aug 18, 2026',
          status: 'overdue',
          dueStatus: 'overdue',
          dueLabel: 'Overdue by 5 days',
          daysDiff: -5,
          contactNumber: undefined,
        },
      ]
    }

    setInvoices(items)
    // Select first overdue or due soon invoice by default
    const defaultSelect =
      items.find((it) => it.dueStatus === 'overdue' || it.dueStatus === 'due_soon') ||
      items[0]
    setSelectedInvoice(defaultSelect || null)

    if (defaultSelect) {
      const formattedAmt = formatCurrency(
        defaultSelect.amount,
        defaultSelect.currency
      )
      setCustomMessage(
        generateDefaultReminderMessage(
          defaultSelect.clientName,
          defaultSelect.invoiceNumber,
          formattedAmt,
          defaultSelect.dueDate,
          defaultSelect.dueStatus
        )
      )
    }

    setHistory(getReminderHistory())
  }, [])

  // When selected invoice changes, update message
  const handleSelectInvoice = (inv: InvoiceReminderItem) => {
    setSelectedInvoice(inv)
    setLastResult(null)
    const formattedAmt = formatCurrency(inv.amount, inv.currency)
    setCustomMessage(
      generateDefaultReminderMessage(
        inv.clientName,
        inv.invoiceNumber,
        formattedAmt,
        inv.dueDate,
        inv.dueStatus
      )
    )
  }

  // Handle Send Reminder with actual WhatsApp / SMS deep linking
  const handleSendReminder = async () => {
    if (!selectedInvoice || sending) return

    const selectedChannels: ReminderChannel[] = []
    if (useWhatsApp) selectedChannels.push('whatsapp')
    if (useSMS) selectedChannels.push('sms')

    if (selectedChannels.length === 0) {
      alert('Please select at least one delivery channel (WhatsApp or SMS).')
      return
    }

    setSending(true)
    setLastResult(null)

    try {
      const phone = selectedInvoice.contactNumber
      const waUrl = buildWhatsAppLink(phone, customMessage)
      const smsUrl = buildSmsLink(phone, customMessage)

      // Actual Client Handoff:
      if (useWhatsApp) {
        // Open WhatsApp in a new tab
        window.open(waUrl, '_blank')
      } else if (useSMS) {
        // Open SMS composer directly
        window.location.href = smsUrl
      }

      // Record dispatch in history
      const result = await sendPaymentReminder({
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.invoiceNumber,
        clientName: selectedInvoice.clientName,
        amount: selectedInvoice.amount,
        currency: selectedInvoice.currency,
        dueDate: selectedInvoice.dueDate,
        channels: selectedChannels,
        message: customMessage,
        recipientPhone: phone,
      })

      setLastResult(result)
      setHistory(getReminderHistory())
    } catch (e) {
      console.error('Send reminder failed:', e)
    } finally {
      setSending(false)
    }
  }

  // Summary counts
  const overdueCount = invoices.filter((i) => i.dueStatus === 'overdue').length
  const dueSoonCount = invoices.filter(
    (i) => i.dueStatus === 'due_soon' || i.dueStatus === 'due_today' || i.dueStatus === 'due_tomorrow'
  ).length
  const paidCount = invoices.filter((i) => i.dueStatus === 'paid').length

  return (
    <div className="reminders-page">
      {/* Header */}
      <header className="reminders-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="reminders-eyebrow">INVOICE NOTIFICATIONS</p>
            <h1 className="reminders-title">Payment Reminders</h1>
            <p className="reminders-subtitle">
              Automatically identify upcoming and overdue invoices and send payment reminders.
            </p>
          </div>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="status-pill upcoming"
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '12px' }}
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      </header>

      {/* Summary Metrics Bar */}
      <div className="reminders-summary-bar">
        <div className="summary-metric-card overdue">
          <div className="summary-label">Overdue Invoices</div>
          <div className="summary-value">{overdueCount}</div>
        </div>

        <div className="summary-metric-card due-soon">
          <div className="summary-label">Due Soon / Today</div>
          <div className="summary-value">{dueSoonCount}</div>
        </div>

        <div className="summary-metric-card paid">
          <div className="summary-label">Paid Invoices</div>
          <div className="summary-value">{paidCount}</div>
        </div>

        <div className="summary-metric-card total">
          <div className="summary-label">Total Invoices</div>
          <div className="summary-value">{invoices.length}</div>
        </div>
      </div>

      {/* Main Grid: Invoices List vs Reminder Composer & History */}
      <div className="reminders-grid">
        {/* SECTION 1: Due Soon / Overdue Invoices */}
        <div className="reminders-card">
          <div className="reminders-card-header">
            <div>
              <h2 className="reminders-card-title">
                <span>📋</span> Due Soon & Overdue Invoices
              </h2>
              <div className="reminders-card-subtitle">
                Select an invoice below to draft and send a reminder
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
              {invoices.length} Invoices
            </span>
          </div>

          <div className="invoices-table-wrap">
            {invoices.map((inv) => {
              const isSelected = selectedInvoice?.id === inv.id
              return (
                <div
                  key={inv.id}
                  className={`invoice-reminder-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectInvoice(inv)}
                >
                  <div className="invoice-row-main">
                    <span className="invoice-row-client">{inv.clientName}</span>
                    <div className="invoice-row-meta">
                      <span>{inv.invoiceNumber}</span>
                      <span>•</span>
                      <span>Due: {inv.dueDate}</span>
                    </div>
                  </div>

                  <div className="invoice-row-right">
                    <span className="invoice-row-amount">
                      {formatCurrency(inv.amount, inv.currency)}
                    </span>
                    <span
                      className={`status-pill ${
                        inv.dueStatus === 'overdue'
                          ? 'overdue'
                          : inv.dueStatus === 'paid'
                          ? 'paid'
                          : 'due-soon'
                      }`}
                    >
                      {inv.dueStatus === 'overdue'
                        ? '🔴'
                        : inv.dueStatus === 'paid'
                        ? '🟢'
                        : '🟡'}{' '}
                      {inv.dueLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION 2 & 3: Send Reminder Panel & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* SECTION 2: Send Reminder */}
          <div className="reminders-card">
            <div className="reminders-card-header">
              <div>
                <h2 className="reminders-card-title">
                  <span>💬</span> Send Payment Reminder
                </h2>
                <div className="reminders-card-subtitle">
                  Configure reminder channels and dispatch
                </div>
              </div>
            </div>

            {selectedInvoice ? (
              <div className="composer-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field-group">
                    <label className="field-label">Recipient</label>
                    <div className="field-value-box">{selectedInvoice.clientName}</div>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Invoice Number</label>
                    <div className="field-value-box">{selectedInvoice.invoiceNumber}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field-group">
                    <label className="field-label">Amount</label>
                    <div className="field-value-box">
                      {formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Due Date</label>
                    <div className="field-value-box">{selectedInvoice.dueDate}</div>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Contact Info</label>
                  <div
                    className={`field-value-box ${
                      selectedInvoice.contactNumber ? '' : 'subdued'
                    }`}
                  >
                    {selectedInvoice.contactNumber ||
                      'No phone number available for this client.'}
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Delivery Channels</label>
                  <div className="channels-container">
                    <label
                      className={`channel-checkbox-label ${useWhatsApp ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={useWhatsApp}
                        onChange={(e) => setUseWhatsApp(e.target.checked)}
                      />
                      <span>WhatsApp</span>
                    </label>

                    <label
                      className={`channel-checkbox-label ${useSMS ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={useSMS}
                        onChange={(e) => setUseSMS(e.target.checked)}
                      />
                      <span>SMS</span>
                    </label>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Message Preview</label>
                  <textarea
                    rows={4}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="composer-textarea"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendReminder}
                  disabled={sending || (!useWhatsApp && !useSMS)}
                  className="send-reminder-btn"
                >
                  <span>✉️</span>
                  <span>{sending ? 'Opening...' : 'Send Reminder'}</span>
                </button>

                {/* Handoff Feedback */}
                {lastResult && (
                  <div className="success-banner">
                    <div className="success-banner-title">
                      <span>✓</span> Message ready in your messaging app
                    </div>
                    <div className="success-banner-meta">
                      <span>
                        <strong>Recipient:</strong> {lastResult.recipient}
                      </span>
                      <span>
                        <strong>Invoice:</strong> {lastResult.invoiceNumber}
                      </span>
                      <span>
                        <strong>Action:</strong> {lastResult.status}
                      </span>
                    </div>
                    {useWhatsApp && useSMS && (
                      <div style={{ marginTop: '6px' }}>
                        <a
                          href={buildSmsLink(selectedInvoice.contactNumber, customMessage)}
                          className="status-pill upcoming"
                          style={{ textDecoration: 'none', display: 'inline-flex', padding: '4px 8px', fontSize: '11px' }}
                        >
                          📱 Also Open SMS Composer →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                Select an invoice from the left to draft a payment reminder.
              </div>
            )}
          </div>

          {/* SECTION 3: Notification History */}
          <div className="reminders-card">
            <div className="reminders-card-header">
              <div>
                <h2 className="reminders-card-title">
                  <span>📜</span> Notification History
                </h2>
                <div className="reminders-card-subtitle">
                  Recent payment reminders sent to clients
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                {history.length} {history.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>

            <div className="history-list">
              {history.length === 0 ? (
                <div className="history-empty">
                  No payment reminders sent yet.
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="history-item-card">
                    <div className="history-item-top">
                      <span>
                        {item.clientName} • {item.invoiceNumber}
                      </span>
                      <span className="history-item-time">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="history-item-sub">
                      <span>
                        {formatCurrency(item.amount, item.currency)} • Due {item.dueDate}
                      </span>
                      <span>•</span>
                      <span className="history-channel-badge">
                        {item.status || item.channels
                          .map((c) => (c === 'whatsapp' ? 'WhatsApp' : 'SMS'))
                          .join(' + ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
