import { handler, HandlerEvent, getCorsHeaders } from '../ai-invoice';
import type { AIInvoiceExtractionResult } from '../../../src/integration/ai-invoice/aiInvoiceTypes';

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

function createMockEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    path: '/.netlify/functions/ai-invoice',
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
    },
    body: JSON.stringify({
      text: "Repaired Rahul's AC for ₹2500 and replaced the filter for ₹600. Payment due in 7 days.",
    }),
    isBase64Encoded: false,
    ...overrides,
  };
}

async function runServerlessTests() {
  console.log('====================================================');
  console.log('PHASE 2 — NETLIFY SERVERLESS FUNCTION TEST SUITE');
  console.log('====================================================\n');

  const baseDate = new Date('2026-08-22T00:00:00.000Z');

  // TEST 1 — Valid POST request (Fallback / Offline)
  console.log('TEST 1: Valid POST request with valid text');
  const event1 = createMockEvent();
  const res1 = await handler(event1, {}, { baseDate, apiKey: '' });
  assert(res1.statusCode === 200, `Status code is 200 (got ${res1.statusCode})`);
  assert(Boolean(res1.headers && res1.headers['Content-Type'] === 'application/json'), 'Content-Type is application/json');
  const body1 = JSON.parse(res1.body || '{}') as AIInvoiceExtractionResult;
  assert(body1.success === true, 'Response success is true');
  assert(body1.source === 'heuristic', 'Source is heuristic when no API key is provided');
  assert(Boolean(body1.data?.clientName.toLowerCase().includes('rahul')), 'Extracts client name Rahul');
  assert(body1.data?.items.length === 2, `Extracts 2 items (found ${body1.data?.items.length})`);
  assert(body1.data?.items[0]?.rate === 2500, 'First item rate is 2500');
  assert(body1.data?.dueInDays === 7, 'dueInDays is 7');
  assert(body1.data?.suggestedDueDate === '2026-08-29', 'suggestedDueDate is 2026-08-29');
  assert(body1.data?.taxRate === null, 'Unspecified tax returns taxRate: null in serverless handler');

  // TEST 2 — Valid POST with base64 encoded body
  console.log('\nTEST 2: Valid POST with base64 encoded body');
  const rawPayload = JSON.stringify({
    text: 'Installed 3 ceiling fans for ₹1500 each for Amit. Payment due in 10 days.',
  });
  const base64Body = Buffer.from(rawPayload, 'utf-8').toString('base64');
  const event2 = createMockEvent({
    body: base64Body,
    isBase64Encoded: true,
  });
  const res2 = await handler(event2, {}, { baseDate, apiKey: '' });
  assert(res2.statusCode === 200, 'Status code is 200 for base64 encoded body');
  const body2 = JSON.parse(res2.body || '{}') as AIInvoiceExtractionResult;
  assert(body2.success === true, 'Decodes and extracts correctly');
  assert(Boolean(body2.data?.clientName.toLowerCase().includes('amit')), 'Extracts client Amit');
  assert(body2.data?.items[0]?.quantity === 3, 'Extracts quantity 3');

  // TEST 3 — HTTP OPTIONS Preflight request
  console.log('\nTEST 3: HTTP OPTIONS Preflight request');
  const event3 = createMockEvent({ httpMethod: 'OPTIONS', body: null });
  const res3 = await handler(event3);
  assert(res3.statusCode === 204, `OPTIONS returns 204 No Content (got ${res3.statusCode})`);
  assert(Boolean(res3.headers && res3.headers['Access-Control-Allow-Methods']), 'Contains Access-Control-Allow-Methods header');

  // TEST 4 — Disallowed HTTP methods (GET, PUT, DELETE, PATCH)
  console.log('\nTEST 4: Disallowed HTTP methods');
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    const event4 = createMockEvent({ httpMethod: method, body: null });
    const res4 = await handler(event4);
    assert(res4.statusCode === 405, `${method} returns 405 Method Not Allowed`);
    assert(Boolean(res4.headers && res4.headers.Allow?.toString().includes('POST')), `${method} includes Allow header with POST`);
    const body4 = JSON.parse(res4.body || '{}');
    assert(body4.success === false, `${method} returns success: false`);
  }

  // TEST 5 — Missing / Empty request body
  console.log('\nTEST 5: Missing or empty request body');
  const res5a = await handler(createMockEvent({ body: null }));
  assert(res5a.statusCode === 400, 'Null body returns 400');
  const res5b = await handler(createMockEvent({ body: '   ' }));
  assert(res5b.statusCode === 400, 'Empty whitespace body returns 400');

  // TEST 6 — Malformed JSON body
  console.log('\nTEST 6: Malformed JSON body');
  const res6 = await handler(createMockEvent({ body: '{ invalid json' }));
  assert(res6.statusCode === 400, 'Malformed JSON returns 400');
  const body6 = JSON.parse(res6.body || '{}');
  assert(body6.error.includes('Invalid JSON'), 'Error message specifies invalid JSON');

  // TEST 7 — Non-object JSON body (array, primitive)
  console.log('\nTEST 7: Non-object JSON payload');
  const res7a = await handler(createMockEvent({ body: JSON.stringify(['item1', 'item2']) }));
  assert(res7a.statusCode === 400, 'JSON array body returns 400');
  const res7b = await handler(createMockEvent({ body: JSON.stringify('plain string') }));
  assert(res7b.statusCode === 400, 'JSON primitive string body returns 400');

  // TEST 8 — Missing 'text' property
  console.log('\nTEST 8: Missing text property');
  const res8 = await handler(createMockEvent({ body: JSON.stringify({ description: 'no text key' }) }));
  assert(res8.statusCode === 400, "Missing 'text' returns 400");
  const body8 = JSON.parse(res8.body || '{}');
  assert(body8.error.includes("Field 'text' is required"), 'Error message mentions text field');

  // TEST 9 — Non-string 'text' property
  console.log('\nTEST 9: Non-string text property');
  const res9 = await handler(createMockEvent({ body: JSON.stringify({ text: 12345 }) }));
  assert(res9.statusCode === 400, "Numeric 'text' returns 400");

  // TEST 10 — Text shorter than 5 characters
  console.log('\nTEST 10: Input text < 5 characters');
  const res10 = await handler(createMockEvent({ body: JSON.stringify({ text: 'fix' }) }));
  assert(res10.statusCode === 400, 'Text < 5 chars returns 400');
  const body10 = JSON.parse(res10.body || '{}');
  assert(body10.error.includes('too short'), 'Error message states text is too short');

  // TEST 11 — Text longer than 2000 characters
  console.log('\nTEST 11: Input text > 2000 characters');
  const longText = 'AC repair service ₹1500. '.repeat(90); // ~2250 chars
  const res11 = await handler(createMockEvent({ body: JSON.stringify({ text: longText }) }));
  assert(res11.statusCode === 400, 'Text > 2000 chars returns 400');
  const body11 = JSON.parse(res11.body || '{}');
  assert(body11.error.includes('exceeds the maximum allowed length'), 'Error message states length exceeded');

  // TEST 12 — Missing GEMINI_API_KEY uses safe heuristic fallback
  console.log('\nTEST 12: Missing GEMINI_API_KEY safe fallback');
  const res12 = await handler(
    createMockEvent({
      body: JSON.stringify({
        text: 'Designed brand logo for Vijay for ₹8000. Payment due in 5 days.',
      }),
    }),
    {},
    { apiKey: '', baseDate }
  );
  assert(res12.statusCode === 200, 'Returns 200 even with missing API key');
  const body12 = JSON.parse(res12.body || '{}') as AIInvoiceExtractionResult;
  assert(body12.success === true, 'Extraction succeeds via heuristic');
  assert(body12.source === 'heuristic', "Source is 'heuristic'");
  assert(Boolean(body12.warning?.includes('GEMINI_API_KEY is not configured')), 'Warning explains fallback');
  assert(Boolean(body12.data?.clientName.toLowerCase().includes('vijay')), 'Extracts Vijay');

  // TEST 13 — Simulated Gemini 500 error falls back safely
  console.log('\nTEST 13: Simulated Gemini 500 API failure fallback');
  const mockFetch500: typeof fetch = async () => {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const res13 = await handler(
    createMockEvent({
      body: JSON.stringify({
        text: 'Consulting for Suresh for ₹12000. Payment due in 14 days.',
      }),
    }),
    {},
    {
      apiKey: 'test-key',
      fetchFn: mockFetch500,
      baseDate,
    }
  );
  assert(res13.statusCode === 200, 'Returns 200 with fallback on Gemini 500');
  const body13 = JSON.parse(res13.body || '{}') as AIInvoiceExtractionResult;
  assert(body13.success === true, 'Recovers and succeeds');
  assert(body13.source === 'heuristic', "Source is marked 'heuristic'");
  assert(Boolean(body13.data?.clientName.toLowerCase().includes('suresh')), 'Extracts Suresh');

  // TEST 14 — Malformed Gemini output falls back safely
  console.log('\nTEST 14: Malformed Gemini output fallback');
  const mockFetchMalformed: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'This is not valid JSON at all.' }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const res14 = await handler(
    createMockEvent({
      body: JSON.stringify({
        text: 'Plumbing repair for Deepak for ₹3500.',
      }),
    }),
    {},
    {
      apiKey: 'test-key',
      fetchFn: mockFetchMalformed,
      baseDate,
    }
  );
  assert(res14.statusCode === 200, 'Returns 200 with fallback on malformed Gemini output');
  const body14 = JSON.parse(res14.body || '{}') as AIInvoiceExtractionResult;
  assert(body14.success === true, 'Recovers cleanly');
  assert(body14.source === 'heuristic', 'Source marked as heuristic');
  assert(Boolean(body14.data?.clientName.toLowerCase().includes('deepak')), 'Extracts Deepak');

  // TEST 15 — Successful Gemini 1.5 Flash extraction
  console.log('\nTEST 15: Successful Gemini 1.5 Flash extraction');
  const mockGeminiSuccess: typeof fetch = async () => {
    const aiData = {
      clientName: 'Sunita Rao',
      clientEmail: 'sunita@example.com',
      clientPhone: '+91 9876543210',
      items: [
        {
          description: 'SEO Optimization & Content Strategy',
          quantity: 1,
          rate: 15000,
        },
      ],
      dueInDays: 15,
      notes: 'Please transfer to bank account',
      taxRate: 18,
      suggestedDueDate: '2026-09-06',
    };
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(aiData) }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const res15 = await handler(
    createMockEvent({
      body: JSON.stringify({
        text: 'SEO Optimization for Sunita Rao for ₹15000 plus 18% tax. Due in 15 days.',
      }),
    }),
    {},
    {
      apiKey: 'real-mock-key',
      fetchFn: mockGeminiSuccess,
      baseDate,
    }
  );
  assert(res15.statusCode === 200, 'Gemini success returns 200');
  const body15 = JSON.parse(res15.body || '{}') as AIInvoiceExtractionResult;
  assert(body15.success === true, 'Success is true');
  assert(body15.source === 'gemini', "Source is 'gemini'");
  assert(body15.data?.clientName === 'Sunita Rao', 'Extracted Sunita Rao');
  assert(body15.data?.items[0]?.rate === 15000, 'Extracted rate 15000');
  assert(body15.data?.taxRate === 18, 'Extracted taxRate 18');

  // TEST 16 — CORS headers resolution
  console.log('\nTEST 16: CORS header security');
  const corsLocal = getCorsHeaders('http://localhost:5173');
  assert(corsLocal['Access-Control-Allow-Origin'] === 'http://localhost:5173', 'Allows localhost origin');
  assert(corsLocal['Vary'] === 'Origin', 'Includes Vary: Origin');

  // Set explicit ALLOWED_ORIGIN
  process.env.ALLOWED_ORIGIN = 'https://app.workflow.internal';
  const corsConfigured = getCorsHeaders('https://app.workflow.internal');
  assert(
    corsConfigured['Access-Control-Allow-Origin'] === 'https://app.workflow.internal',
    'Matches ALLOWED_ORIGIN env var'
  );
  const corsBlocked = getCorsHeaders('https://malicious-site.com');
  assert(
    corsBlocked['Access-Control-Allow-Origin'] !== 'https://malicious-site.com',
    'Rejects unconfigured third-party origin'
  );
  delete process.env.ALLOWED_ORIGIN;

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runServerlessTests();
