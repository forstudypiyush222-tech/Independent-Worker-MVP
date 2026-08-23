import { handler } from '../notify'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

async function runTests() {
  console.log('--- Starting Payment Reminders Serverless Tests ---')

  // Test 1: OPTIONS preflight
  const optionsRes = await handler({
    path: '/api/notify',
    httpMethod: 'OPTIONS',
    headers: {},
    body: null,
    isBase64Encoded: false,
  })
  assert(optionsRes.statusCode === 204, 'OPTIONS should return 204')
  console.log('✓ Test 1: OPTIONS preflight passed')

  // Test 2: Method Not Allowed
  const getRes = await handler({
    path: '/api/notify',
    httpMethod: 'GET',
    headers: {},
    body: null,
    isBase64Encoded: false,
  })
  assert(getRes.statusCode === 405, 'GET should return 405')
  console.log('✓ Test 2: Method Not Allowed passed')

  // Test 3: POST dispatch payment reminder
  const postRes = await handler({
    path: '/api/notify',
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      invoiceId: 'inv-123',
      invoiceNumber: 'INV-12',
      clientName: 'Rahul',
      amount: 3410,
      dueDate: 'Aug 29, 2026',
      channels: ['whatsapp', 'sms'],
      message: 'Payment reminder for INV-12',
      recipientPhone: '+91 98765 43210',
    }),
    isBase64Encoded: false,
  })
  assert(postRes.statusCode === 200, 'POST should return 200')
  const body = JSON.parse(postRes.body!)
  assert(body.success === true, 'Response should have success: true')
  assert(body.status === 'WhatsApp + SMS opened', 'Status should match handoff action')
  assert(body.recipient === 'Rahul', 'Recipient should match')
  assert(body.recipientPhone === '+91 98765 43210', 'Phone should be preserved')
  assert(body.channels.includes('whatsapp'), 'Should contain whatsapp')
  assert(body.channels.includes('sms'), 'Should contain sms')
  console.log('✓ Test 3: POST payment reminder dispatch passed')

  console.log('\nAll Serverless Payment Reminder tests completed successfully! (100% PASS)')
}

runTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
