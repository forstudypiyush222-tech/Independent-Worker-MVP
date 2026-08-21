import { useState } from 'react'
import Dashboard from './components/Dashboard'
import InvoicePage from './components/InvoicePage'
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
  const [view, setView] = useState<'dashboard' | 'invoice'>('dashboard')

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
    <div className="app">
      {view === 'dashboard' ? (
        <Dashboard
          onCreateInvoice={handleCreateInvoice}
        />
      ) : (
        <div>
          <button
            onClick={handleBackToDashboard}
            style={{
              margin: '20px',
              padding: '10px 18px',
              cursor: 'pointer',
            }}
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
  )
}

export default App