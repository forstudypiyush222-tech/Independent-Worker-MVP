import { extractInvoiceFromText } from '../aiInvoiceService';
import type { AIInvoiceExtractionResult } from '../aiInvoiceTypes';

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

async function runServiceTests() {
  console.log('====================================================');
  console.log('PHASE 3 — AI INVOICE SERVICE CONTRACT TEST SUITE');
  console.log('====================================================\n');

  // TEST 1 — Valid Success Response
  console.log('TEST 1: Valid 200 OK JSON response');
  const mockFetchSuccess: typeof fetch = async () => {
    const data: AIInvoiceExtractionResult = {
      success: true,
      data: {
        clientName: 'Rahul',
        clientEmail: '',
        clientPhone: '',
        items: [{ description: 'AC Repair', quantity: 1, rate: 2500 }],
        dueInDays: 7,
        notes: '',
        taxRate: 0,
        suggestedDueDate: '2026-08-29',
      },
      source: 'gemini',
    };
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const res1 = await extractInvoiceFromText('Repaired Rahul AC for 2500', { fetchFn: mockFetchSuccess });
  assert(res1.success === true, 'Service returns success: true');
  assert(res1.data?.clientName === 'Rahul', 'Parsed clientName Rahul');
  assert(res1.source === 'gemini', 'Source is gemini');

  // TEST 2 — 400 Bad Request JSON response
  console.log('\nTEST 2: 400 Bad Request JSON response');
  const mockFetch400: typeof fetch = async () => {
    return new Response(JSON.stringify({ success: false, error: "Field 'text' is required." }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const res2 = await extractInvoiceFromText('Valid input length test', { fetchFn: mockFetch400 });
  assert(res2.success === false, 'Returns success: false for 400');
  assert(res2.error === "Field 'text' is required.", 'Extracts custom error message from server response');

  // TEST 3 — 404 / 502 HTML Error (Dev server or proxy misconfiguration)
  console.log('\nTEST 3: 404 HTML Error response handled without SyntaxError crash');
  const mockFetch404Html: typeof fetch = async () => {
    return new Response('<!DOCTYPE html><html><body>404 Not Found</body></html>', {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'text/html' },
    });
  };

  const res3 = await extractInvoiceFromText('Valid input length test', { fetchFn: mockFetch404Html });
  assert(res3.success === false, 'Returns success: false on 404 HTML');
  assert(Boolean(res3.error && res3.error.includes('HTTP 404')), 'Error message includes HTTP 404 information');

  // TEST 4 — 200 OK with Non-JSON body
  console.log('\nTEST 4: 200 OK with Non-JSON text body');
  const mockFetch200Html: typeof fetch = async () => {
    return new Response('<!DOCTYPE html><html>SPA Fallback</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };

  const res4 = await extractInvoiceFromText('Valid input length test', { fetchFn: mockFetch200Html });
  assert(res4.success === false, 'Returns success: false when response is not JSON');
  assert(Boolean(res4.error && res4.error.includes('Unable to parse server response')), 'Informs user about invalid response format');

  // TEST 5 — Network Connection Error
  console.log('\nTEST 5: Network connection failure');
  const mockFetchNetworkError: typeof fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  const res5 = await extractInvoiceFromText('Valid input length test', { fetchFn: mockFetchNetworkError });
  assert(res5.success === false, 'Returns success: false on network error');
  assert(Boolean(res5.error && res5.error.includes('Network connection error')), 'Shows friendly network connection error');

  // TEST 6 — Client-side validation
  console.log('\nTEST 6: Client-side validation (< 5 chars)');
  const res6 = await extractInvoiceFromText('hi');
  assert(res6.success === false, 'Rejects short input client-side');
  assert(Boolean(res6.error && res6.error.includes('at least 5 characters')), 'Validation error message shown');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runServiceTests();
