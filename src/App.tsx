import { useState } from 'react'
import Dashboard from './components/Dashboard'
import InvoicePage from './components/InvoicePage'
import NotificationCenter from './components/NotificationCenter'
import { Invoice } from './data/types'
import { initialInvoice } from './data/initialData'

type InvoiceRecord = {
  id: string
  invoice: Invoice
  amount: number
  status: 'paid' | 'pending' | 'overdue'
}

function calculateInvoiceAmount(invoice: Invoice) {
  const subtotal = invoice.productLines.reduce((total, item) => {
    const quantity = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0

    return total + quantity * rate
  }, 0)

  const tax = subtotal * 0.1

  return subtotal + tax
}

function App() {
  const [view, setView] = useState<'dashboard' | 'invoice' | 'notifications'>('dashboard')

  const [invoiceData, setInvoiceData] = useState<Invoice>(() => {
    const savedInvoice = window.localStorage.getItem('invoiceData')

    if (savedInvoice) {
      try {
        return JSON.parse(savedInvoice)
      } catch {
        // Use the invoice page defaults
      }
    }

    return {} as Invoice
  })

  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>(
    () => crypto.randomUUID()
  )

  const handleCreateInvoice = () => {
    setCurrentInvoiceId(crypto.randomUUID())
    setInvoiceData({
      ...initialInvoice,
      productLines: initialInvoice.productLines.map((line) => ({
        ...line,
      })),
    })
    setView('invoice')
  }

  const handleInvoiceUpdated = (invoice: Invoice) => {
    setInvoiceData(invoice)

    window.localStorage.setItem(
      'invoiceData',
      JSON.stringify(invoice)
    )

    const amount = calculateInvoiceAmount(invoice)

    const savedRecords =
      window.localStorage.getItem('invoiceRecords')

    let records: InvoiceRecord[] = []

    if (savedRecords) {
      try {
        records = JSON.parse(savedRecords)
      } catch {
        records = []
      }
    }

    const existingRecord = records.find(
      (record) => record.id === currentInvoiceId
    )

    const newRecord: InvoiceRecord = {
      id: currentInvoiceId,
      invoice,
      amount,
      status: existingRecord?.status || 'pending',
    }

    if (existingRecord) {
      records = records.map((record) =>
        record.id === currentInvoiceId ? newRecord : record
      )
    } else {
      records.push(newRecord)
    }

    window.localStorage.setItem(
      'invoiceRecords',
      JSON.stringify(records)
    )
  }

  const handleBackToDashboard = () => {
    setView('dashboard')
  }

  return (
    <div>
      {/* Top Application Navigation Bar */}
      <nav className="app-nav-bar">
        <div className="app-nav-brand">
          <div className="app-nav-brand-logo">⚡</div>
          <span className="app-nav-brand-text">Independent Worker Hub</span>
        </div>

        <div className="app-nav-tabs">
          <button
            className={`app-nav-tab ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            <span>📊</span>
            <span>Dashboard</span>
          </button>

          <button
            className={`app-nav-tab ${view === 'notifications' ? 'active' : ''}`}
            onClick={() => setView('notifications')}
          >
            <span>🔔</span>
            <span>Payment Reminders</span>
          </button>

          <button
            className={`app-nav-tab ${view === 'invoice' ? 'active' : ''}`}
            onClick={() => setView('invoice')}
          >
            <span>📄</span>
            <span>Invoice Editor</span>
          </button>
        </div>
      </nav>

      {/* Main View Area */}
      <div className={`app ${view === 'dashboard' ? 'app--dashboard' : view === 'notifications' ? 'app--notifications' : 'app--invoice'}`}>
        {view === 'dashboard' ? (
          <Dashboard
            onCreateInvoice={handleCreateInvoice}
            onOpenNotifications={() => setView('notifications')}
          />
        ) : view === 'notifications' ? (
          <NotificationCenter
            onBackToDashboard={handleBackToDashboard}
          />
        ) : (
          <div>
            <button
              className="back-button"
              onClick={handleBackToDashboard}
            >
              ← Back to Dashboard
            </button>

            <InvoicePage
              data={invoiceData}
              onChange={handleInvoiceUpdated}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App