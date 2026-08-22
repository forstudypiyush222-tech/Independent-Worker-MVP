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
  console.log('PHASE 1 — AI INVOICE EXTRACTION TEST SUITE');
  console.log('====================================================\n');

  const baseDate = new Date('2026-08-22T00:00:00.000Z');

  // TEST 1 — Basic invoice extraction
  console.log('TEST 1: Basic invoice extraction');
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

  // TEST 2 — Quantity and unit rate
  console.log('\nTEST 2: Quantity and rate extraction');
  const t2 = heuristicParse(
    'Installed 3 ceiling fans for ₹1500 each for Amit. Payment due in 10 days.',
    baseDate
  );
  assert(t2.clientName.toLowerCase().includes('amit'), 'Extracts client name (Amit)');
  assert(t2.items.length >= 1, 'Extracts line item');
  assert(t2.items[0]?.quantity === 3, `Quantity is 3 (found ${t2.items[0]?.quantity})`);
  assert(t2.items[0]?.rate === 1500, `Rate is 1500 (found ${t2.items[0]?.rate})`);
  assert(t2.dueInDays === 10, 'Due in 10 days');

  // TEST 3 — Tax percentage extraction
  console.log('\nTEST 3: Tax extraction');
  const t3 = heuristicParse('Designed a website for Priya for ₹20000 plus 18% tax.', baseDate);
  assert(t3.clientName.toLowerCase().includes('priya'), 'Extracts client name (Priya)');
  assert(t3.taxRate === 18, `Tax rate is 18% (found ${t3.taxRate}%)`);
  assert(t3.items[0]?.rate === 20000, `Rate is 20000 (found ${t3.items[0]?.rate})`);

  // TEST 4 — Missing optional information handling
  console.log('\nTEST 4: Missing optional info & defaults');
  const t4 = heuristicParse('Fixed the washing machine for ₹1200.', baseDate);
  assert(typeof t4.clientName === 'string', 'clientName is string');
  assert(t4.clientEmail === '', 'clientEmail is empty string');
  assert(t4.clientPhone === '', 'clientPhone is empty string');
  assert(t4.dueInDays === null, 'dueInDays defaults to null');
  assert(t4.items.length >= 1, 'Extracts item');
  assert(t4.items[0]?.rate === 1200, 'Item rate is 1200');

  // TEST 5 — Multiple services
  console.log('\nTEST 5: Multiple services');
  const t5 = heuristicParse(
    'Repaired AC for ₹2500, replaced filter for ₹600 and installed thermostat for ₹1800 for Rahul.',
    baseDate
  );
  assert(t5.items.length === 3, `Extracts 3 distinct services (found ${t5.items.length})`);
  assert(t5.items.some((i) => i.rate === 2500), 'Contains 2500 item');
  assert(t5.items.some((i) => i.rate === 600), 'Contains 600 item');
  assert(t5.items.some((i) => i.rate === 1800), 'Contains 1800 item');

  // TEST 6 — Invalid input (< 5 characters)
  console.log('\nTEST 6: Invalid short input rejection');
  const t6Validation = validateAIInvoiceInput('hi');
  assert(!t6Validation.isValid, 'Validation rejects < 5 char input');
  const t6Extractor = await extractInvoiceData({ text: 'hi' });
  assert(!t6Extractor.success, 'Extractor returns success: false for short input');
  assert(Boolean(t6Extractor.error), 'Extractor provides clear error message');

  // TEST 7 — Long input (> 2000 characters)
  console.log('\nTEST 7: Long input rejection (> 2000 characters)');
  const longText = 'Repaired AC for ₹2500. '.repeat(100); // ~2300 chars
  const t7Validation = validateAIInvoiceInput(longText);
  assert(!t7Validation.isValid, 'Validation rejects > 2000 char input');
  const t7Extractor = await extractInvoiceData({ text: longText });
  assert(!t7Extractor.success, 'Extractor returns success: false for long input');

  // TEST 8 — Missing API Key (Heuristic Fallback)
  console.log('\nTEST 8: Missing API key fallback');
  const t8 = await extractInvoiceData(
    { text: "Tailored 3 shirts for Vijay for ₹400 each. Payment due in 5 days." },
    { apiKey: '', baseDate }
  );
  assert(t8.success, 'Extraction succeeds');
  assert(t8.source === 'heuristic', `Source is heuristic (found ${t8.source})`);
  assert(Boolean(t8.warning), 'Warning describes heuristic fallback');
  assert(Boolean(t8.data?.clientName.toLowerCase().includes('vijay')), 'Client Vijay extracted');
  assert(t8.data?.dueInDays === 5, 'dueInDays is 5');

  // TEST 9 — Simulated Gemini API Failure (HTTP 500)
  console.log('\nTEST 9: Simulated Gemini 500 error fallback');
  const mockFailFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Internal Server Error' } }), {
      status: 500,
      statusText: 'Internal Server Error',
    });

  const t9 = await extractInvoiceData(
    { text: "Plumbing work for Suresh for ₹3000. Due in 14 days." },
    { apiKey: 'mock-key', fetchFn: mockFailFetch, baseDate }
  );
  assert(t9.success, 'Recovers and succeeds via fallback');
  assert(t9.source === 'heuristic', 'Source marked as heuristic');
  assert(Boolean(t9.warning?.includes('Gemini extraction failed')), 'Warning notes Gemini failure');
  assert(Boolean(t9.data?.clientName.toLowerCase().includes('suresh')), 'Client Suresh extracted');
  assert(t9.data?.dueInDays === 14, 'dueInDays is 14');

  // TEST 10 — Malformed Gemini JSON response
  console.log('\nTEST 10: Malformed Gemini JSON fallback');
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

  const t10 = await extractInvoiceData(
    { text: "Electrical wiring for Deepak for ₹8500." },
    { apiKey: 'mock-key', fetchFn: mockMalformedFetch, baseDate }
  );
  assert(t10.success, 'Fallback recovers cleanly from malformed AI output');
  assert(t10.source === 'heuristic', 'Source marked as heuristic');
  assert(Boolean(t10.data?.clientName.toLowerCase().includes('deepak')), 'Client Deepak extracted');

  // EXTRA TEST 11 — Schema validations (Negative rates & zero quantity rejection)
  console.log('\nTEST 11: Zod schema contract validation');
  const invalidRateExtraction = validateAIInvoiceExtraction({
    clientName: 'Test',
    items: [{ description: 'Item 1', quantity: 1, rate: -50 }],
  });
  assert(!invalidRateExtraction.success, 'Rejects negative rates');

  const zeroQtyExtraction = validateAIInvoiceExtraction({
    clientName: 'Test',
    items: [{ description: 'Item 1', quantity: 0, rate: 100 }],
  });
  assert(!zeroQtyExtraction.success, 'Rejects zero quantity');

  const emptyDescExtraction = validateAIInvoiceExtraction({
    clientName: 'Test',
    items: [{ description: '   ', quantity: 1, rate: 100 }],
  });
  assert(!emptyDescExtraction.success, 'Rejects empty item description');

  // Date calculation helper
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
