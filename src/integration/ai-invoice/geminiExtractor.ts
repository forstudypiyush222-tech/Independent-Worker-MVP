import type {
  AIInvoiceRequest,
  AIInvoiceExtractionResult,
} from './aiInvoiceTypes';
import { validateAIInvoiceInput, validateAIInvoiceExtraction } from './validation';
import { heuristicParse } from './heuristicParser';

export interface GeminiExtractorOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  modelName?: string;
  baseDate?: Date;
}

/**
 * Builds the structured extraction prompt for the Gemini LLM.
 */
function buildExtractionPrompt(text: string): string {
  return `You are a professional invoice data extraction assistant.
Extract structured invoice data from the following natural language description of work.

Text: "${text}"

Return a JSON object matching this exact structure:
{
  "clientName": "extracted client name or empty string",
  "clientEmail": "extracted email or empty string",
  "clientPhone": "extracted phone or empty string",
  "items": [
    {
      "description": "item or service description",
      "quantity": 1,
      "rate": 0
    }
  ],
  "dueInDays": null,
  "notes": "any additional notes or payment instructions",
  "taxRate": null
}

Rules:
- Extract ALL items or services mentioned as individual items.
- Default quantity to 1 when not specified.
- Extract raw numeric rates (numbers only).
- Do not calculate subtotal, tax amount, or total amount.
- Extract tax percentage when explicitly mentioned (e.g. "18% tax" -> taxRate: 18, "0% tax" or "no tax" or "without tax" -> taxRate: 0).
- If tax is not mentioned or unknown, set taxRate to null.
- Extract payment terms / due days if mentioned (e.g. "due in 7 days" -> dueInDays: 7).
- Do not invent missing information; use empty strings or null.
- Return ONLY valid JSON, without markdown formatting or commentary.`;
}

/**
 * Orchestrates AI extraction from natural language text using Google Gemini 1.5 Flash
 * with automatic, resilient failover to the deterministic heuristic parser.
 */
export async function extractInvoiceData(
  request: AIInvoiceRequest,
  options?: GeminiExtractorOptions
): Promise<AIInvoiceExtractionResult> {
  const baseDate = options?.baseDate || new Date();

  // 1. Input validation
  const inputValidation = validateAIInvoiceInput(request?.text);
  if (!inputValidation.isValid || !inputValidation.sanitizedText) {
    return {
      success: false,
      error: inputValidation.error || 'Invalid input text.',
    };
  }

  const sanitizedText = inputValidation.sanitizedText;

  // 2. Check API key presence
  const apiKey =
    options?.apiKey ||
    (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : undefined);

  const isKeyMissingOrPlaceholder =
    !apiKey ||
    apiKey.trim() === '' ||
    apiKey === 'your_gemini_api_key' ||
    apiKey === 'your_gemini_api_key_here';

  if (isKeyMissingOrPlaceholder) {
    const fallbackData = heuristicParse(sanitizedText, baseDate);
    return {
      success: true,
      data: fallbackData,
      source: 'heuristic',
      warning: 'GEMINI_API_KEY is not configured. Processed with offline heuristic fallback.',
    };
  }

  // 3. Attempt Gemini extraction
  const fetchFn = options?.fetchFn || fetch;
  const timeoutMs = options?.timeoutMs || 8000;
  const modelName = options?.modelName || 'gemini-1.5-flash';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const prompt = buildExtractionPrompt(sanitizedText);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned HTTP status ${response.status} (${response.statusText})`);
    }

    const jsonResponse = await response.json();
    const rawContent =
      jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent || typeof rawContent !== 'string') {
      throw new Error('Gemini API returned an empty or malformed response structure.');
    }

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const cleanedJson = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(cleanedJson);
    } catch {
      throw new Error('Gemini response could not be parsed as valid JSON.');
    }

    // Strict schema & output validation via Zod
    const validation = validateAIInvoiceExtraction(parsedPayload, baseDate);
    if (!validation.success) {
      throw new Error(`Gemini output failed schema validation: ${validation.error}`);
    }

    return {
      success: true,
      data: validation.data,
      source: 'gemini',
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    const errorMessage = err instanceof Error ? err.message : 'Unknown Gemini error';
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const sanitizedWarning = isTimeout
      ? 'Gemini request timed out after 8 seconds. Used heuristic fallback.'
      : `Gemini extraction failed (${errorMessage}). Safely fell back to heuristic parser.`;

    const fallbackData = heuristicParse(sanitizedText, baseDate);

    return {
      success: true,
      data: fallbackData,
      source: 'heuristic',
      warning: sanitizedWarning,
    };
  }
}
