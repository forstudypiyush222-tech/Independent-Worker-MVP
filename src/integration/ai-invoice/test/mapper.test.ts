import { mapAIExtractionToInvoice } from '../aiInvoiceMapper';
import { initialInvoice } from '../../../data/initialData';
import type { AIInvoiceExtraction } from '../aiInvoiceTypes';
import type { Invoice } from '../../../data/types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failCount++;
  }
}

function runMapperTests() {
  console.log('====================================================');
  console.log('PHASE 3 — AI INVOICE MAPPER TEST SUITE');
  console.log('====================================================\n');

  const baseDate = new Date('2026-08-22T00:00:00.000Z');

  const baseInvoice: Invoice = {
    ...initialInvoice,
    companyName: 'Acme Solutions Ltd',
    name: 'John Doe',
    companyAddress: '100 Tech Park',
    companyCountry: 'India',
    invoiceTitle: 'INV-2026-001',
    currency: '₹',
    notes: 'Standard payment terms apply.',
  };

  // TEST 1 — Single Item Mapping
  console.log('TEST 1: Single item mapping');
  const extraction1: AIInvoiceExtraction = {
    clientName: 'Rahul Sharma',
    clientEmail: 'rahul@example.com',
    clientPhone: '+91 9876543210',
    items: [
      {
        description: 'AC Servicing and Gas Refill',
        quantity: 1,
        rate: 2500,
      },
    ],
    dueInDays: 7,
    notes: 'Urgent service request',
    taxRate: 18,
    suggestedDueDate: '2026-08-29',
  };

  const mapped1 = mapAIExtractionToInvoice(extraction1, baseInvoice, baseDate);
  assert(mapped1.clientName === 'Rahul Sharma', 'Client name mapped to Rahul Sharma');
  assert(mapped1.productLines.length === 1, 'Product lines has exactly 1 item');
  assert(mapped1.productLines[0]?.description === 'AC Servicing and Gas Refill', 'Item description matches');
  assert(mapped1.productLines[0]?.quantity === '1', 'Quantity converted to string "1"');
  assert(mapped1.productLines[0]?.rate === '2500.00', 'Rate converted to string "2500.00"');

  // TEST 2 — Multiple Items Mapping
  console.log('\nTEST 2: Multiple items mapping');
  const extraction2: AIInvoiceExtraction = {
    clientName: 'Priya Patel',
    clientEmail: '',
    clientPhone: '',
    items: [
      { description: 'Web UI Design', quantity: 2, rate: 8000 },
      { description: 'Backend API Setup', quantity: 1, rate: 12000 },
    ],
    dueInDays: 14,
    notes: '',
    taxRate: 18,
    suggestedDueDate: '2026-09-05',
  };

  const mapped2 = mapAIExtractionToInvoice(extraction2, baseInvoice, baseDate);
  assert(mapped2.productLines.length === 2, 'Maps 2 distinct product lines');
  assert(mapped2.productLines[0]?.quantity === '2', 'First item quantity is "2"');
  assert(mapped2.productLines[0]?.rate === '8000.00', 'First item rate is "8000.00"');
  assert(mapped2.productLines[1]?.rate === '12000.00', 'Second item rate is "12000.00"');

  // TEST 3 — Tax Rate Mapping
  console.log('\nTEST 3: Tax rate to taxLabel mapping');
  assert(mapped1.taxLabel === 'Sale Tax (18%)', 'Tax rate 18 formatted to "Sale Tax (18%)"');
  const noTaxExtraction: AIInvoiceExtraction = {
    ...extraction1,
    taxRate: 0,
  };
  const mappedNoTax = mapAIExtractionToInvoice(noTaxExtraction, baseInvoice, baseDate);
  assert(mappedNoTax.taxLabel === baseInvoice.taxLabel, 'Tax rate 0 preserves original tax label');

  // TEST 4 — Due Date Mapping
  console.log('\nTEST 4: Due date formatting');
  assert(mapped1.invoiceDueDate === 'Aug 29, 2026', 'Formats suggestedDueDate 2026-08-29 as "Aug 29, 2026"');
  const offsetExtraction: AIInvoiceExtraction = {
    ...extraction1,
    suggestedDueDate: null,
    dueInDays: 5,
  };
  const mappedOffset = mapAIExtractionToInvoice(offsetExtraction, baseInvoice, baseDate);
  assert(mappedOffset.invoiceDueDate === 'Aug 27, 2026', 'Calculates offset due date (Aug 27, 2026)');

  // TEST 5 — Strict Data Mapping Rule: Email and Phone are NOT persisted
  console.log('\nTEST 5: Strict data mapping rule (email/phone not in notes)');
  assert(!mapped1.notes.includes('rahul@example.com'), 'clientEmail is NOT appended to notes');
  assert(!mapped1.notes.includes('+91 9876543210'), 'clientPhone is NOT appended to notes');
  assert(mapped1.notes === 'Urgent service request', 'Notes contains job notes only');

  // TEST 6 — Immutability and Preservation of Unrelated Fields
  console.log('\nTEST 6: Preservation of existing fields & immutability');
  assert(mapped1.companyName === 'Acme Solutions Ltd', 'Preserves companyName');
  assert(mapped1.name === 'John Doe', 'Preserves name');
  assert(mapped1.companyAddress === '100 Tech Park', 'Preserves companyAddress');
  assert(mapped1.invoiceTitle === 'INV-2026-001', 'Preserves invoiceTitle/number');
  assert(mapped1.currency === '₹', 'Preserves currency symbol');
  assert(baseInvoice.clientName !== 'Rahul Sharma', 'Original invoice object is not mutated');

  // TEST 7 — Empty extraction handling
  console.log('\nTEST 7: Empty/sparse extraction handling');
  const sparseExtraction: AIInvoiceExtraction = {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    items: [],
    dueInDays: null,
    notes: '',
    taxRate: 0,
    suggestedDueDate: null,
  };
  const mappedSparse = mapAIExtractionToInvoice(sparseExtraction, baseInvoice, baseDate);
  assert(mappedSparse.clientName === baseInvoice.clientName, 'Empty clientName preserves existing clientName');
  assert(mappedSparse.productLines.length === baseInvoice.productLines.length, 'Empty items preserves existing productLines');
  assert(mappedSparse.notes === baseInvoice.notes, 'Empty notes preserves existing notes');
  assert(mappedSparse.invoiceDueDate === baseInvoice.invoiceDueDate, 'Missing due date preserves existing invoiceDueDate');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runMapperTests();
