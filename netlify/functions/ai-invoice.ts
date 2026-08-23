import type {
  AIInvoiceExtractionResult,
} from '../../src/integration/ai-invoice/aiInvoiceTypes';
import {
  extractInvoiceData,
  GeminiExtractorOptions,
} from '../../src/integration/ai-invoice/geminiExtractor';
import { validateAIInvoiceInput } from '../../src/integration/ai-invoice/validation';
import { heuristicParse } from '../../src/integration/ai-invoice/heuristicParser';

export interface HandlerEvent {
  rawUrl?: string;
  rawQuery?: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders?: Record<string, string[] | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  multiValueQueryStringParameters?: Record<string, string[] | undefined>;
  body: string | null;
  isBase64Encoded: boolean;
}

export interface HandlerContext {
  [key: string]: unknown;
}

export interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  multiValueHeaders?: Record<string, Array<string | boolean | number>>;
  body?: string;
  isBase64Encoded?: boolean;
}

export type Handler = (
  event: HandlerEvent,
  context?: HandlerContext,
  extractorOptions?: GeminiExtractorOptions
) => Promise<HandlerResponse>;

/**
 * Resolves CORS headers based on request headers and environment configuration.
 * Avoids insecure wildcard '*' when an allowed origin or deployment origin is known.
 */
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN;
  const netlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;

  let allowOrigin = '';

  if (allowedOriginEnv) {
    const allowedList = allowedOriginEnv.split(',').map((o) => o.trim());
    if (requestOrigin && allowedList.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else if (allowedList.length === 1 && allowedList[0] !== '*') {
      allowOrigin = allowedList[0];
    }
  } else if (requestOrigin) {
    // In local development or when origin matches Netlify deployment URL
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
    const isMatchingDeployUrl = Boolean(netlifyUrl && requestOrigin === netlifyUrl);
    const isNetlifyPreview = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(requestOrigin);

    if (isLocalhost || isMatchingDeployUrl || isNetlifyPreview) {
      allowOrigin = requestOrigin;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }

  return headers;
}

/**
 * Netlify Serverless Function Handler for AI Invoice Extraction Engine (Phase 2).
 * Exposes POST /.netlify/functions/ai-invoice while keeping GEMINI_API_KEY server-side.
 */
export const handler: Handler = async (
  event: HandlerEvent,
  _context?: HandlerContext,
  extractorOptions?: GeminiExtractorOptions
): Promise<HandlerResponse> => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const corsHeaders = getCorsHeaders(origin);

  // 1. Handle HTTP OPTIONS (Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  // 2. Reject non-POST HTTP methods
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        Allow: 'POST, OPTIONS',
      },
      body: JSON.stringify({
        success: false,
        error: 'Method Not Allowed. Use POST.',
      }),
    };
  }

  // 3. Validate request body presence
  if (!event.body || event.body.trim() === '') {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Request body is required.',
      }),
    };
  }

  // 4. Decode base64 if needed and parse JSON
  let rawBodyText = event.body;
  if (event.isBase64Encoded) {
    try {
      rawBodyText = Buffer.from(event.body, 'base64').toString('utf-8');
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Failed to decode base64 request body.',
        }),
      };
    }
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBodyText);
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body.',
      }),
    };
  }

  if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Request body must be a JSON object.',
      }),
    };
  }

  const candidate = parsedBody as Record<string, unknown>;
  if (!('text' in candidate)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Field 'text' is required.",
      }),
    };
  }

  if (typeof candidate.text !== 'string') {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Field 'text' must be a string.",
      }),
    };
  }

  // 5. Input length & sanity validation
  const inputValidation = validateAIInvoiceInput(candidate.text);
  if (!inputValidation.isValid || !inputValidation.sanitizedText) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: inputValidation.error || 'Invalid input text.',
      }),
    };
  }

  // 6. Execute extraction (Gemini with automatic heuristic fallback)
  try {
    const extractionResult: AIInvoiceExtractionResult = await extractInvoiceData(
      { text: inputValidation.sanitizedText },
      extractorOptions
    );

    if (!extractionResult.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(extractionResult),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(extractionResult),
    };
  } catch (err: unknown) {
    // Log error internally; never leak internal details or stack traces to client
    console.error('Unhandled AI invoice serverless function error:', err);
    try {
      const fallbackData = heuristicParse(inputValidation.sanitizedText, new Date());
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: fallbackData,
          source: 'heuristic',
          warning: 'Extraction service recovered with offline heuristic fallback.',
        }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'An unexpected internal error occurred during invoice extraction.',
        }),
      };
    }
  }
};
