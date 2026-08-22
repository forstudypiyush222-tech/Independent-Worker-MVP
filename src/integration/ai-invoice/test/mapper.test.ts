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
  console.log('PHASE 4 — AI INVOICE MAPPER TEST SUITE');
  console.log('====================================================\n');

  const baseDate = new Date('2026-08-22T00:00:00.000Z');

  const baseInvoice10Tax: Invoice = {
    ...initialInvoice,
    companyName: 'Acme Solutions Ltd',
    name: 'John Doe',
    companyAddress: '100 Tech Park',
    companyCountry: 'India',
    invoiceTitle: 'INV-2026-001',
    currency: '₹',
    taxLabel: 'Sale Tax (10%)',
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

  const mapped1 = mapAIExtractionToInvoice(extraction1, baseInvoice10Tax, baseDate);
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

  const mapped2 = mapAIExtractionToInvoice(extraction2, baseInvoice10Tax, baseDate);
  assert(mapped2.productLines.length === 2, 'Maps 2 distinct product lines');
  assert(mapped2.productLines[0]?.quantity === '2', 'First item quantity is "2"');
  assert(mapped2.productLines[0]?.rate === '8000.00', 'First item rate is "8000.00"');
  assert(mapped2.productLines[1]?.rate === '12000.00', 'Second item rate is "12000.00"');

  // TEST 3 — Tri-State Tax Semantics
  console.log('\nTEST 3: Tri-State Tax Semantics');

  // 3a. Explicit positive tax (18%)
  const mappedExplicit18 = mapAIExtractionToInvoice(
    { ...extraction1, taxRate: 18 },
    baseInvoice10Tax,
    baseDate
  );
  assert(mappedExplicit18.taxLabel === 'Sale Tax (18%)', 'Explicit 18% tax sets "Sale Tax (18%)"');

  // 3b. Explicit zero tax (0%)
  const mappedExplicit0 = mapAIExtractionToInvoice(
    { ...extraction1, taxRate: 0 },
    baseInvoice10Tax,
    baseDate
  );
  assert(mappedExplicit0.taxLabel === 'Sale Tax (0%)', 'Explicit 0% tax overrides existing 10% to "Sale Tax (0%)"');

  // 3c. Unspecified tax (null) preserves existing 10%
  const mappedUnspecifiedNull = mapAIExtractionToInvoice(
    { ...extraction1, taxRate: null },
    baseInvoice10Tax,
    baseDate
  );
  assert(mappedUnspecifiedNull.taxLabel === 'Sale Tax (10%)', 'Unspecified tax (null) preserves existing "Sale Tax (10%)"');

  // 3d. Existing 0% tax + explicit 18% tax becomes 18%
  const baseInvoice0Tax: Invoice = { ...baseInvoice10Tax, taxLabel: 'Sale Tax (0%)' };
  const mapped0To18 = mapAIExtractionToInvoice(
    { ...extraction1, taxRate: 18 },
    baseInvoice0Tax,
    baseDate
  );
  assert(mapped0To18.taxLabel === 'Sale Tax (18%)', 'Existing 0% tax + explicit 18% becomes "Sale Tax (18%)"');

  // 3e. Existing Custom Tax + null preserves custom tax label
  const baseInvoiceCustomTax: Invoice = { ...baseInvoice10Tax, taxLabel: 'VAT (5%)' };
  const mappedCustomNull = mapAIExtractionToInvoice(
    { ...extraction1, taxRate: null },
    baseInvoiceCustomTax,
    baseDate
  );
  assert(mappedCustomNull.taxLabel === 'VAT (5%)', 'Unspecified tax (null) preserves custom tax label "VAT (5%)"');

  // TEST 4 — Due Date Mapping
  console.log('\nTEST 4: Due date formatting');
  assert(mapped1.invoiceDueDate === 'Aug 29, 2026', 'Formats suggestedDueDate 2026-08-29 as "Aug 29, 2026"');
  const offsetExtraction: AIInvoiceExtraction = {
    ...extraction1,
    suggestedDueDate: null,
    dueInDays: 5,
  };
  const mappedOffset = mapAIExtractionToInvoice(offsetExtraction, baseInvoice10Tax, baseDate);
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
  assert(baseInvoice10Tax.clientName !== 'Rahul Sharma', 'Original invoice object is not mutated');

  // TEST 7 — Empty extraction handling
  console.log('\nTEST 7: Empty/sparse extraction handling');
  const sparseExtraction: AIInvoiceExtraction = {
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    items: [],
    dueInDays: null,
    notes: '',
    taxRate: null,
    suggestedDueDate: null,
  };
  const mappedSparse = mapAIExtractionToInvoice(sparseExtraction, baseInvoice10Tax, baseDate);
  assert(mappedSparse.clientName === baseInvoice10Tax.clientName, 'Empty clientName preserves existing clientName');
  assert(mappedSparse.productLines.length === baseInvoice10Tax.productLines.length, 'Empty items preserves existing productLines');
  assert(mappedSparse.notes === baseInvoice10Tax.notes, 'Empty notes preserves existing notes');
  assert(mappedSparse.taxLabel === baseInvoice10Tax.taxLabel, 'Null tax preserves existing taxLabel');
  assert(mappedSparse.invoiceDueDate === baseInvoice10Tax.invoiceDueDate, 'Missing due date preserves existing invoiceDueDate');

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
