import type { AIInvoiceExtractionResult } from './aiInvoiceTypes';
import { validateAIInvoiceInput } from './validation';

export interface AIInvoiceServiceOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  endpointUrl?: string;
}

/**
 * Frontend client service for AI Invoice Extraction.
 * Communicates strictly with the backend Netlify Serverless Function (POST /.netlify/functions/ai-invoice).
 * Never uses or exposes GEMINI_API_KEY on the client.
 */
export async function extractInvoiceFromText(
  rawText: string,
  options?: AIInvoiceServiceOptions
): Promise<AIInvoiceExtractionResult> {
  // 1. Client-side input validation
  const validation = validateAIInvoiceInput(rawText);
  if (!validation.isValid || !validation.sanitizedText) {
    return {
      success: false,
      error: validation.error || 'Please provide a valid job description (5 to 2000 characters).',
    };
  }

  const endpointUrl = options?.endpointUrl || '/.netlify/functions/ai-invoice';
  const fetchFn = options?.fetchFn || fetch;
  const timeoutMs = options?.timeoutMs || 10000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: validation.sanitizedText,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Read and parse response body safely
    const rawText = await response.text();
    let jsonResponse: Record<string, unknown> | null = null;

    if (rawText && rawText.trim().length > 0) {
      try {
        jsonResponse = JSON.parse(rawText);
      } catch {
        jsonResponse = null;
      }
    }

    if (!response.ok) {
      const errorMessage =
        jsonResponse && typeof jsonResponse.error === 'string'
          ? jsonResponse.error
          : `Extraction request failed (HTTP ${response.status}${
              response.statusText ? ` ${response.statusText}` : ''
            }).`;

      return {
        success: false,
        error: errorMessage,
      };
    }

    if (!jsonResponse || typeof jsonResponse !== 'object') {
      return {
        success: false,
        error: 'Unable to parse server response. Expected valid JSON.',
      };
    }

    const extractionResult = jsonResponse as unknown as AIInvoiceExtractionResult;
    return extractionResult;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. Please check your connection and try again.',
      };
    }

    return {
      success: false,
      error: 'Network connection error. Could not connect to the extraction service.',
    };
  }
}
