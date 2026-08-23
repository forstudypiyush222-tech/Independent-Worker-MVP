import {
  calculateDueStatus,
  generateDefaultReminderMessage,
  executeReminderDispatch,
  normalizePhoneForWhatsApp,
  buildWhatsAppLink,
  buildSmsLink,
  extractClientPhone,
} from '../engine'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

console.log('--- Starting Payment Reminders Engine Unit Tests ---')

// Test 1: Due Date Calculations
const todayStr = new Date().toISOString().split('T')[0]
const statusToday = calculateDueStatus(todayStr, false)
assert(statusToday.dueStatus === 'due_today', 'Should be due_today for today')
assert(statusToday.dueLabel === 'Due today', 'Label should be Due today')
console.log('✓ Test 1: Due today calculation passed')

// Test 2: Overdue calculation
const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString().split('T')[0]
const statusOverdue = calculateDueStatus(pastDate, false)
assert(statusOverdue.dueStatus === 'overdue', 'Should be overdue for past dates')
assert(statusOverdue.dueLabel.includes('Overdue by 3 days'), 'Should specify overdue days count')
console.log('✓ Test 2: Overdue calculation passed')

// Test 3: Due in future calculation
const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().split('T')[0]
const statusFuture = calculateDueStatus(futureDate, false)
assert(statusFuture.dueStatus === 'due_soon', 'Should be due_soon for 5 days out')
assert(statusFuture.dueLabel === 'Due in 5 days', 'Label should say Due in 5 days')
console.log('✓ Test 3: Due soon calculation passed')

// Test 4: Paid invoice handling
const statusPaid = calculateDueStatus(pastDate, true)
assert(statusPaid.dueStatus === 'paid', 'Should be paid when isPaid=true')
assert(statusPaid.dueLabel === 'Paid', 'Label should be Paid')
console.log('✓ Test 4: Paid status calculation passed')

// Test 5: Message Generation
const msg = generateDefaultReminderMessage(
  'Rahul',
  'INV-12',
  '₹3,410',
  'Aug 29, 2026',
  'due_soon'
)
assert(msg.includes('Rahul'), 'Message should contain client name')
assert(msg.includes('INV-12'), 'Message should contain invoice title')
assert(msg.includes('₹3,410'), 'Message should contain amount')
assert(msg.includes('Aug 29, 2026'), 'Message should contain due date')
console.log('✓ Test 5: Default reminder message generator passed')

// Test 6: Phone normalization & link builders
const normalized = normalizePhoneForWhatsApp('9876543210')
assert(normalized === '919876543210', '10-digit Indian number should prepend 91')

const waLink = buildWhatsAppLink('9876543210', 'Hi Rahul')
assert(waLink.startsWith('https://wa.me/919876543210?text='), 'WhatsApp link must match format')
assert(waLink.includes('Hi%20Rahul'), 'Message must be URL encoded')

const smsLink = buildSmsLink('+919876543210', 'Hi Rahul')
assert(smsLink.startsWith('sms:+919876543210?body='), 'SMS link must match format')
console.log('✓ Test 6: Phone normalization and deep link builders passed')

// Test 7: Client phone extraction
const phoneExtracted = extractClientPhone({ clientAddress: 'Flat 402, Mumbai. Mobile: 9876543210' })
assert(phoneExtracted?.includes('9876543210') === true, 'Should extract phone from address string')
console.log('✓ Test 7: Phone extraction passed')

// Test 8: Dispatch execution with handoff tracking
const dispatch = executeReminderDispatch({
  invoiceId: 'inv-123',
  invoiceNumber: 'INV-12',
  clientName: 'Rahul',
  amount: 3410,
  currency: '₹',
  dueDate: 'Aug 29, 2026',
  channels: ['whatsapp', 'sms'],
  message: msg,
  recipientPhone: '+91 98765 43210',
})
assert(dispatch.response.success === true, 'Dispatch response should be success')
assert(dispatch.response.status === 'WhatsApp + SMS opened', 'Status should indicate WhatsApp + SMS opened')
assert(dispatch.record.status === 'WhatsApp + SMS opened', 'Record status should indicate WhatsApp + SMS opened')
console.log('✓ Test 8: Dispatch execution and action tracking passed')

console.log('\nAll Payment Reminder Engine tests completed successfully! (100% PASS)')
