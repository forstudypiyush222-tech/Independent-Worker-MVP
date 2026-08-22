import { extractInvoiceData } from '../geminiExtractor';
import { heuristicParse } from '../heuristicParser';
import {
  validateAIInvoiceInput,
  validateAIInvoiceExtraction,
  calculateSuggestedDueDate,
} from '../validation';

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

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 4 — AI INVOICE EXTRACTION TEST SUITE');
  console.log('====================================================\n');

  const baseDate = new Date('2026-08-22T00:00:00.000Z');

  // TEST 1 — Basic invoice extraction & Unspecified Tax (null)
  console.log('TEST 1: Basic invoice extraction (Unspecified tax = null)');
  const t1 = heuristicParse(
    "Repaired Rahul's AC for ₹2500 and replaced the filter for ₹600. Payment due in 7 days.",
    baseDate
  );
  assert(t1.clientName.toLowerCase().includes('rahul'), 'Extracts client name (Rahul)');
  assert(t1.items.length === 2, `Extracts 2 items (found ${t1.items.length})`);
  assert(t1.items[0]?.rate === 2500, 'First item rate is 2500');
  assert(t1.items[1]?.rate === 600, 'Second item rate is 600');
  assert(t1.dueInDays === 7, 'Extracts dueInDays = 7');
  assert(t1.suggestedDueDate === '2026-08-29', 'Calculates suggestedDueDate as 2026-08-29');
  assert(t1.taxRate === null, 'Unspecified tax returns taxRate === null');
  assert(!t1.items[0]?.description.includes('  '), 'First item description has no double whitespace');

  // TEST 2 — Explicit Zero Tax ("no tax", "0% tax", "without tax")
  console.log('\nTEST 2: Explicit Zero Tax extraction');
  const t2a = heuristicParse('Repaired AC for Rahul for ₹2500, no tax.', baseDate);
  assert(t2a.taxRate === 0, 'Extracts taxRate === 0 for "no tax"');

  const t2b = heuristicParse('Repaired AC for ₹2500 with 0% tax.', baseDate);
  assert(t2b.taxRate === 0, 'Extracts taxRate === 0 for "0% tax"');

  const t2c = heuristicParse('Web design for ₹5000 without tax.', baseDate);
  assert(t2c.taxRate === 0, 'Extracts taxRate === 0 for "without tax"');

  // TEST 3 — Explicit Non-Zero Tax ("18% GST", "12% VAT")
  console.log('\nTEST 3: Explicit Non-Zero Tax extraction');
  const t3a = heuristicParse('Designed a website for Priya for ₹20000 plus 18% tax.', baseDate);
  assert(t3a.clientName.toLowerCase().includes('priya'), 'Extracts client name (Priya)');
  assert(t3a.taxRate === 18, `Tax rate is 18% (found ${t3a.taxRate}%)`);
  assert(t3a.items[0]?.rate === 20000, `Rate is 20000 (found ${t3a.items[0]?.rate})`);

  const t3b = heuristicParse('AC repair for ₹2500 plus 18% GST.', baseDate);
  assert(t3b.taxRate === 18, 'Extracts taxRate === 18 for "18% GST"');

  // TEST 4 — Quantity and unit rate
  console.log('\nTEST 4: Quantity and rate extraction');
  const t4 = heuristicParse(
    'Installed 3 ceiling fans for ₹1500 each for Amit. Payment due in 10 days.',
    baseDate
  );
  assert(t4.clientName.toLowerCase().includes('amit'), 'Extracts client name (Amit)');
  assert(t4.items.length >= 1, 'Extracts line item');
  assert(t4.items[0]?.quantity === 3, `Quantity is 3 (found ${t4.items[0]?.quantity})`);
  assert(t4.items[0]?.rate === 1500, `Rate is 1500 (found ${t4.items[0]?.rate})`);
  assert(t4.dueInDays === 10, 'Due in 10 days');

  // TEST 5 — Preview-Only Contact Information Extraction (Email & Phone)
  console.log('\nTEST 5: Preview-only Contact Info Extraction');
  const t5 = heuristicParse(
    'Fixed electrical wiring for John for ₹3500. Email him at john.doe@example.com or call 9876543210.',
    baseDate
  );
  assert(t5.clientEmail === 'john.doe@example.com', 'Extracts email for preview (john.doe@example.com)');
  assert(t5.clientPhone === '9876543210', 'Extracts phone for preview (9876543210)');

  // TEST 6 — Multiple services
  console.log('\nTEST 6: Multiple services');
  const t6 = heuristicParse(
    'Repaired AC for ₹2500, replaced filter for ₹600 and installed thermostat for ₹1800 for Rahul.',
    baseDate
  );
  assert(t6.items.length === 3, `Extracts 3 distinct services (found ${t6.items.length})`);
  assert(t6.items.some((i) => i.rate === 2500), 'Contains 2500 item');
  assert(t6.items.some((i) => i.rate === 600), 'Contains 600 item');
  assert(t6.items.some((i) => i.rate === 1800), 'Contains 1800 item');

  // TEST 7 — Invalid input (< 5 characters)
  console.log('\nTEST 7: Invalid short input rejection');
  const t7Validation = validateAIInvoiceInput('hi');
  assert(!t7Validation.isValid, 'Validation rejects < 5 char input');
  const t7Extractor = await extractInvoiceData({ text: 'hi' });
  assert(!t7Extractor.success, 'Extractor returns success: false for short input');
  assert(Boolean(t7Extractor.error), 'Extractor provides clear error message');

  // TEST 8 — Long input (> 2000 characters)
  console.log('\nTEST 8: Long input rejection (> 2000 characters)');
  const longText = 'Repaired AC for ₹2500. '.repeat(100);
  const t8Validation = validateAIInvoiceInput(longText);
  assert(!t8Validation.isValid, 'Validation rejects > 2000 char input');
  const t8Extractor = await extractInvoiceData({ text: longText });
  assert(!t8Extractor.success, 'Extractor returns success: false for long input');

  // TEST 9 — Missing API Key (Heuristic Fallback)
  console.log('\nTEST 9: Missing API key fallback');
  const t9 = await extractInvoiceData(
    { text: "Tailored 3 shirts for Vijay for ₹400 each. Payment due in 5 days." },
    { apiKey: '', baseDate }
  );
  assert(t9.success, 'Extraction succeeds');
  assert(t9.source === 'heuristic', `Source is heuristic (found ${t9.source})`);
  assert(Boolean(t9.warning), 'Warning describes heuristic fallback');
  assert(Boolean(t9.data?.clientName.toLowerCase().includes('vijay')), 'Client Vijay extracted');
  assert(t9.data?.dueInDays === 5, 'dueInDays is 5');
  assert(t9.data?.taxRate === null, 'Tax rate defaults to null when not specified');

  // TEST 10 — Simulated Gemini API Failure (HTTP 500)
  console.log('\nTEST 10: Simulated Gemini 500 error fallback');
  const mockFailFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Internal Server Error' } }), {
      status: 500,
      statusText: 'Internal Server Error',
    });

  const t10 = await extractInvoiceData(
    { text: "Plumbing work for Suresh for ₹3000, no tax. Due in 14 days." },
    { apiKey: 'mock-key', fetchFn: mockFailFetch, baseDate }
  );
  assert(t10.success, 'Recovers and succeeds via fallback');
  assert(t10.source === 'heuristic', 'Source marked as heuristic');
  assert(Boolean(t10.warning?.includes('Gemini extraction failed')), 'Warning notes Gemini failure');
  assert(Boolean(t10.data?.clientName.toLowerCase().includes('suresh')), 'Client Suresh extracted');
  assert(t10.data?.taxRate === 0, 'Explicit no tax extracted via fallback');
  assert(t10.data?.dueInDays === 14, 'dueInDays is 14');

  // TEST 11 — Malformed Gemini JSON response
  console.log('\nTEST 11: Malformed Gemini JSON fallback');
  const mockMalformedFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '```json\n{ "clientName": "Test", "items": "INVALID_NOT_AN_ARRAY" }\n```' }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  const t11 = await extractInvoiceData(
    { text: "Electrical wiring for Deepak for ₹8500." },
    { apiKey: 'mock-key', fetchFn: mockMalformedFetch, baseDate }
  );
  assert(t11.success, 'Fallback recovers cleanly from malformed AI output');
  assert(t11.source === 'heuristic', 'Source marked as heuristic');
  assert(Boolean(t11.data?.clientName.toLowerCase().includes('deepak')), 'Client Deepak extracted');

  // TEST 12 — Schema validation for tri-state tax and data types
  console.log('\nTEST 12: Zod schema contract validation');
  const nullTaxExtraction = validateAIInvoiceExtraction({
    clientName: 'Test',
    items: [{ description: 'Item 1', quantity: 1, rate: 100 }],
    taxRate: null,
  });
  assert(nullTaxExtraction.success, 'Accepts taxRate: null');
  assert(nullTaxExtraction.success && nullTaxExtraction.data.taxRate === null, 'taxRate preserved as null');

  const zeroTaxExtraction = validateAIInvoiceExtraction({
    clientName: 'Test',
    items: [{ description: 'Item 1', quantity: 1, rate: 100 }],
    taxRate: 0,
  });
  assert(zeroTaxExtraction.success, 'Accepts taxRate: 0');
  assert(zeroTaxExtraction.success && zeroTaxExtraction.data.taxRate === 0, 'taxRate preserved as 0');

  const invalidRateExtraction = validateAIInvoiceExtraction({
    clientName: 'Test',
    items: [{ description: 'Item 1', quantity: 1, rate: -50 }],
  });
  assert(!invalidRateExtraction.success, 'Rejects negative rates');

  const dateCalc = calculateSuggestedDueDate(7, new Date('2026-08-22T00:00:00.000Z'));
  assert(dateCalc === '2026-08-29', 'calculateSuggestedDueDate returns YYYY-MM-DD');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
