import { useEffect, useState } from 'react'
import './Dashboard.css'
import { Invoice } from '../data/types'

type InvoiceRecord = {
    id: string
    invoice: Invoice
    amount: number
    status: 'paid' | 'pending' | 'overdue'
}

type DashboardProps = {
    onCreateInvoice: () => void
}

function Dashboard({ onCreateInvoice }: DashboardProps) {
    const [invoiceRecords, setInvoiceRecords] = useState<InvoiceRecord[]>([])

    const [showChasePanel, setShowChasePanel] = useState(false)
    const [showIncomePanel, setShowIncomePanel] = useState(false)
    const [selectedInvoice, setSelectedInvoice] =
  useState<InvoiceRecord | null>(null)
  type PaymentFilter = 'all' | 'paid' | 'pending' | 'overdue'

const [paymentFilter, setPaymentFilter] =
  useState<PaymentFilter>('all')

useEffect(() => {
  const savedRecords = window.localStorage.getItem('invoiceRecords')

  if (savedRecords) {
    try {
      const records = JSON.parse(savedRecords)

      const updatedRecords = records.map((record: InvoiceRecord) => {
        if (record.status === 'paid') {
          return record
        }

        const dueDate = new Date(record.invoice.invoiceDueDate)
        const today = new Date()

        today.setHours(0, 0, 0, 0)
        dueDate.setHours(0, 0, 0, 0)

        if (dueDate < today) {
          return {
            ...record,
            status: 'overdue',
          }
        }

        return {
          ...record,
          status: 'pending',
        }
      })

      setInvoiceRecords(updatedRecords)

      window.localStorage.setItem(
        'invoiceRecords',
        JSON.stringify(updatedRecords)
      )
    } catch (_e) {
      setInvoiceRecords([])
    }
  }
}, [])

    const totalRevenue = invoiceRecords.reduce((sum, record) => {
        return sum + record.amount
    }, 0)

    const paidAmount = invoiceRecords
        .filter((record) => record.status === 'paid')
        .reduce((sum, record) => {
            return sum + record.amount
        }, 0)

    const pendingAmount = invoiceRecords
        .filter((record) => record.status === 'pending')
        .reduce((sum, record) => {
            return sum + record.amount
        }, 0)

    const overdueAmount = invoiceRecords
        .filter((record) => record.status === 'overdue')
        .reduce((sum, record) => {
            return sum + record.amount
        }, 0)
    const paidCount = invoiceRecords.filter(
  (record) => record.status === 'paid'
).length

const pendingCount = invoiceRecords.filter(
  (record) => record.status === 'pending'
).length

const overdueCount = invoiceRecords.filter(
  (record) => record.status === 'overdue'
).length

const collectionRate =
  totalRevenue > 0
    ? Math.round((paidAmount / totalRevenue) * 100)
    : 0
const filteredPaymentRecords =
  paymentFilter === 'all'
    ? invoiceRecords
    : invoiceRecords.filter(
        (record) => record.status === paymentFilter
      )
    const updateInvoiceStatus = (
  invoiceId: string,
  status: 'paid' | 'pending' | 'overdue'
) => {
  const updatedRecords = invoiceRecords.map((record) =>
    record.id === invoiceId
      ? { ...record, status }
      : record
  )

  setInvoiceRecords(updatedRecords)

  window.localStorage.setItem(
    'invoiceRecords',
    JSON.stringify(updatedRecords)
  )

  setSelectedInvoice(null)
}
    return (
        <div className="dashboard">

            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">BUSINESS OVERVIEW</p>
                    <h1>Good morning 👋</h1>
                    <p className="dashboard-subtitle">
                        Manage your work, payments and income in one place.
                    </p>
                </div>

                <button className="primary-button" onClick={onCreateInvoice}>
                    + Create Invoice
                </button>
            </header>

            {/* Stats */}
            <section className="stats-grid">
                <div className="stat-card">
                    <div className="stat-top">
                        <span>Total Revenue</span>
                        <span className="stat-icon">₹</span>
                    </div>
                    <h2>₹{totalRevenue.toFixed(2)}</h2>
                    <p className="positive">Total invoiced</p>
                </div>

                <div className="stat-card">
                    <div className="stat-top">
                        <span>Paid</span>
                        <span className="stat-icon">✓</span>
                    </div>
                    <h2>₹{paidAmount.toFixed(2)}</h2>
                    <p className="positive">
  {collectionRate}% collected · {paidCount} paid
</p>
                </div>

                <div className="stat-card">
                    <div className="stat-top">
                        <span>Pending</span>
                        <span className="stat-icon">◷</span>
                    </div>
                    <h2>₹{pendingAmount.toFixed(2)}</h2>
                    <p className="neutral">
  {pendingCount} invoice{pendingCount !== 1 ? 's' : ''} pending
</p>
                </div>

                <div className="stat-card overdue-card">
                    <div className="stat-top">
                        <span>Overdue</span>
                        <span className="stat-icon">!</span>
                    </div>
                    <h2>₹{overdueAmount.toFixed(2)}</h2>
                    <p className="negative">
  {overdueCount} payment{overdueCount !== 1 ? 's' : ''} overdue
</p>
                </div>
            </section>

            {/* Main content */}
            <section className="dashboard-grid">
                {/* Recent invoices */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <div>
                            <h3>Recent Invoices</h3>
                            <p>Keep track of your latest payments.</p>
                        </div>

                        <button className="text-button">View all</button>
                    </div>

                    <div className="invoice-list">
                        {invoiceRecords.length === 0 ? (
                            <div
                                style={{
                                    padding: '30px 0',
                                    textAlign: 'center',
                                    color: '#64748b',
                                }}
                            >
                                No invoices yet.
                            </div>
                        ) : (
                            invoiceRecords.slice(-5).reverse().map((record) => {
                                const clientName = record.invoice.clientName || 'Unnamed Customer'
                                const invoiceNumber =
  record.invoice.invoiceTitle || `INV-${record.id.slice(0, 6).toUpperCase()}`

                                const initials = clientName
                                    .split(' ')
                                    .map((word) => word[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()

                                return (
                                    <div className="invoice-row" key={record.id}>
                                        <div className="invoice-client">
                                            <div className="avatar">{initials}</div>

                                            <div>
                                                <strong>{clientName}</strong>
                                                <span>{invoiceNumber}</span>
                                            </div>
                                        </div>

                                        <strong>
                                            {record.invoice.currency || '₹'}
                                            {record.amount.toFixed(2)}
                                        </strong>

                                        <button
  className={`status ${record.status}`}
  onClick={() => {
    if (record.status === 'paid') {
      return
    }

    const updatedRecords = invoiceRecords.map((item) =>
      item.id === record.id
        ? { ...item, status: 'paid' as const }
        : item
    )

    setInvoiceRecords(updatedRecords)

    window.localStorage.setItem(
      'invoiceRecords',
      JSON.stringify(updatedRecords)
    )
  }}
>
  {record.status === 'paid'
    ? 'Paid'
    : 'Mark as Paid'}
</button>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    </div>
{/* Payment Management */}
<section className="dashboard-panel payments-panel">

  <div className="panel-header">
    <div>
      <p className="dashboard-eyebrow">
        PAYMENT MANAGEMENT
      </p>

      <h3>Track your money</h3>

      <p>
        See what is paid, pending and overdue.
      </p>
    </div>
  </div>

  {/* Payment Summary */}
  <div className="payment-summary">

    <div>
      <span>Total Invoiced</span>
      <strong>₹{totalRevenue.toFixed(2)}</strong>
    </div>

    <div>
      <span>Collected</span>
      <strong>₹{paidAmount.toFixed(2)}</strong>
    </div>

    <div>
      <span>Pending</span>
      <strong>₹{pendingAmount.toFixed(2)}</strong>
    </div>

    <div>
      <span>Overdue</span>
      <strong>₹{overdueAmount.toFixed(2)}</strong>
    </div>

  </div>

  {/* Filters */}
  <div className="payment-filters">

    <button
      className={paymentFilter === 'all' ? 'active' : ''}
      onClick={() => setPaymentFilter('all')}
    >
      All
    </button>

    <button
      className={paymentFilter === 'paid' ? 'active' : ''}
      onClick={() => setPaymentFilter('paid')}
    >
      Paid
    </button>

    <button
      className={paymentFilter === 'pending' ? 'active' : ''}
      onClick={() => setPaymentFilter('pending')}
    >
      Pending
    </button>

    <button
      className={paymentFilter === 'overdue' ? 'active' : ''}
      onClick={() => setPaymentFilter('overdue')}
    >
      Overdue
    </button>

  </div>

  {/* Payment List */}
  <div className="payment-list">

    {filteredPaymentRecords.length === 0 ? (

      <div className="empty-payments">
        No {paymentFilter === 'all' ? '' : paymentFilter} payments found.
      </div>

    ) : (

      filteredPaymentRecords
        .slice()
        .reverse()
        .map((record) => {

          const clientName =
            record.invoice.clientName ||
            'Unnamed Customer'

          return (
            <div
              className="payment-row"
              key={record.id}
            >

              <div className="payment-client">

                <div className="avatar">
                  {clientName
                    .split(' ')
                    .map((word) => word[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <strong>{clientName}</strong>

                  <span>{record.id}</span>
                </div>

              </div>

              <strong className="payment-amount">
                ₹{record.amount.toFixed(2)}
              </strong>

              <span
                className={`status ${record.status}`}
              >
                {record.status.charAt(0).toUpperCase() +
                  record.status.slice(1)}
              </span>

              <div className="payment-actions">

                {record.status !== 'paid' && (
                  <button
                    className="small-button"
                    onClick={() =>
                      updateInvoiceStatus(
                        record.id,
                        'paid'
                      )
                    }
                  >
                    Mark as Paid
                  </button>
                )}

                {record.status === 'overdue' && (
                  <button
                    className="reminder-button"
                    onClick={() =>
                      setSelectedInvoice(record)
                    }
                  >
                    Send Reminder
                  </button>
                )}

              </div>

            </div>
          )
        })

    )}

  </div>

</section>                  

                    {/* Quick actions */}
                    <div className="dashboard-panel">
                        <div className="panel-header">
                            <div>
                                <h3>Quick Actions</h3>
                                <p>Get things done faster.</p>
                            </div>
                        </div>

                        <div className="quick-actions">
                            <button className="action-card" onClick={onCreateInvoice}>
                                <span className="action-icon">＋</span>
                                <span>
                                    <strong>Create Invoice</strong>
                                    <small>Bill a customer</small>
                                </span>
                            </button>

                            <button className="action-card">
                                <span className="action-icon">₹</span>
                                <span>
                                    <strong>Record Payment</strong>
                                    <small>Mark an invoice as paid</small>
                                </span>
                            </button>

                            <button
                             className="action-card"
                            onClick={() => setShowChasePanel(true)}
>
                                <span className="action-icon">↗</span>
                                <span>
                                    <strong>Send Reminder</strong>
                                    <small>Chase an unpaid invoice</small>
                                </span>
                            </button>

                            <button className="action-card"
  onClick={() => setShowIncomePanel(true)}
>
                                <span className="action-icon">▣</span>
                                <span>
                                    <strong>View Income</strong>
                                    <small>Track your earnings</small>
                                </span>
                            </button>
                        </div>
                    </div>
            </section>

            {/* Money that needs attention */}
            <section className="attention-panel">
  <div>
    <p className="dashboard-eyebrow">NEEDS ATTENTION</p>

    <h3>
      {overdueAmount > 0
        ? `₹${overdueAmount.toFixed(2)} is waiting for you.`
        : 'You are all caught up.'}
    </h3>

    <p>
      {overdueCount > 0
        ? `You have ${overdueCount} overdue payment${
            overdueCount !== 1 ? 's' : ''
          }. Send reminders and get your money moving.`
        : 'No overdue payments right now.'}
    </p>
  </div>

  {overdueCount > 0 && (
    <button
  className="secondary-button"
  onClick={() => setShowChasePanel(true)}
>
  Chase Payments →
</button>
  )}
</section>
  {showChasePanel && (
  <div className="chase-overlay">
    <div className="chase-panel">

      <div className="chase-header">
        <div>
          <p className="dashboard-eyebrow">
            PAYMENT RECOVERY
          </p>

          <h2>Overdue Payments</h2>

          <p>
            {overdueCount} overdue invoice
            {overdueCount !== 1 ? 's' : ''} · ₹
            {overdueAmount.toFixed(2)} outstanding
          </p>
        </div>

        <button
          className="chase-close"
          onClick={() => {
            setShowChasePanel(false)
            setSelectedInvoice(null)
          }}
        >
          ×
        </button>
      </div>

      <div className="chase-list">
        {invoiceRecords
          .filter((record) => record.status === 'overdue')
          .map((record) => {
            const dueDate = new Date(record.invoice.invoiceDueDate)

const today = new Date()
today.setHours(0, 0, 0, 0)

dueDate.setHours(0, 0, 0, 0)

const daysOverdue = Math.max(
  0,
  Math.floor(
    (today.getTime() - dueDate.getTime()) /
      (1000 * 60 * 60 * 24)
  )
)
  return (
    
          
            <div className="chase-item" key={record.id}>
            
              <div>
                <strong>
                  {record.invoice.clientName ||
                    'Unnamed Customer'}
                </strong>

                <span>
                  {record.invoice.invoiceTitle || `INV-${record.id.slice(0, 6).toUpperCase()}`}
                </span>

                <small>
  Due: {record.invoice.invoiceDueDate || 'Unknown'}
</small>

<small>
  {daysOverdue === 0
    ? 'Due today'
    : `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`}
</small>
              </div>

              <div className="chase-amount">
                <strong>
                  {record.invoice.currency || '₹'}
                  {record.amount.toFixed(2)}
                </strong>

                <button
                  className="reminder-button"
                  onClick={() =>
                    setSelectedInvoice(record)
                  }
                >
                  Create Reminder
                </button>
              </div>

            </div>
                )
            })}
      </div>

      {selectedInvoice && (
        <div className="reminder-box">

          <p className="dashboard-eyebrow">
            PAYMENT REMINDER
          </p>

          <h3>
            {selectedInvoice.invoice.clientName ||
              'Customer'}
          </h3>

          <textarea
            value={`Hi ${
              selectedInvoice.invoice.clientName ||
              'there'
            },

Just a friendly reminder that invoice ${
              selectedInvoice.invoice.invoiceTitle ||
              selectedInvoice.id
            } for ${
              selectedInvoice.invoice.currency || '₹'
            }${selectedInvoice.amount.toFixed(2)} is currently overdue.

The payment was due on ${
              selectedInvoice.invoice.invoiceDueDate ||
              'the due date'
            }.

Please let me know if you have any questions.

Thank you.`}
            readOnly
          />

          <button
            className="secondary-button"
            onClick={() => {
              const message = `Hi ${
                selectedInvoice.invoice.clientName ||
                'there'
              },

Just a friendly reminder that invoice ${
                selectedInvoice.invoice.invoiceTitle ||
                selectedInvoice.id
              } for ${
                selectedInvoice.invoice.currency || '₹'
              }${selectedInvoice.amount.toFixed(2)} is currently overdue.

The payment was due on ${
                selectedInvoice.invoice.invoiceDueDate ||
                'the due date'
              }.

Please let me know if you have any questions.

Thank you.`

              navigator.clipboard.writeText(message)
              alert('Reminder copied!')
            }}
          >
            Copy Reminder
          </button>

        </div>
      )}

    </div>
  </div>
)}
    {showIncomePanel && (
  <div className="chase-overlay">
    <div className="chase-panel">

      <div className="chase-header">
        <div>
          <p className="dashboard-eyebrow">BUSINESS INSIGHTS</p>
          <h2>Income Overview</h2>
          <p>Understand your money at a glance.</p>
        </div>

        <button
          className="chase-close"
          onClick={() => setShowIncomePanel(false)}
        >
          ×
        </button>
      </div>

      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-top">
            <span>Total Invoiced</span>
            <span className="stat-icon">₹</span>
          </div>

          <h2>₹{totalRevenue.toFixed(2)}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Collected</span>
            <span className="stat-icon">✓</span>
          </div>

          <h2>₹{paidAmount.toFixed(2)}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Pending</span>
            <span className="stat-icon">◷</span>
          </div>

          <h2>₹{pendingAmount.toFixed(2)}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Collection Rate</span>
            <span className="stat-icon">%</span>
          </div>

          <h2>{collectionRate}%</h2>
        </div>

      </div>

      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3>Payment Summary</h3>
            <p>How your invoices are performing.</p>
          </div>
        </div>

        <p>
          <strong>{paidCount}</strong> paid invoices
        </p>

        <p>
          <strong>{pendingCount}</strong> pending invoices
        </p>

        <p>
          <strong>{overdueCount}</strong> overdue invoices
        </p>
      </div>

    </div>
  </div>
)}
        </div>
    )
}



export default Dashboard