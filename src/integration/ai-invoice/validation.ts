import { z } from 'zod';
import type { AIInvoiceExtraction } from './aiInvoiceTypes';

/**
 * Defensive input validation rules.
 * Ensures input is non-empty, of reasonable length, and clean before AI processing.
 */
export function validateAIInvoiceInput(input: unknown): { isValid: boolean; sanitizedText?: string; error?: string } {
  if (typeof input !== 'string') {
    return { isValid: false, error: 'Input must be a string' };
  }

  const trimmed = input.trim();

  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: 'Input text is too short. Please provide at least 5 characters describing the work performed.',
    };
  }

  if (trimmed.length > 2000) {
    return {
      isValid: false,
      error: 'Input text exceeds the maximum allowed length of 2000 characters.',
    };
  }

  return { isValid: true, sanitizedText: trimmed };
}

/**
 * Calculate suggested due date formatted as YYYY-MM-DD from offset days.
 */
export function calculateSuggestedDueDate(dueInDays: number | null, fromDate: Date = new Date()): string | null {
  if (dueInDays === null || dueInDays === undefined || isNaN(dueInDays) || dueInDays < 0) {
    return null;
  }
  const date = new Date(fromDate);
  date.setDate(date.getDate() + Math.round(dueInDays));
  return date.toISOString().split('T')[0];
}

/**
 * Zod Schema for strict output validation.
 * Untrusted AI model output is sanitized and verified against this contract.
 */
export const aiInvoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description cannot be empty'),
  quantity: z
    .number()
    .finite('Quantity must be a finite number')
    .gt(0, 'Quantity must be greater than 0'),
  rate: z
    .number()
    .finite('Rate must be a finite number')
    .gte(0, 'Rate cannot be negative'),
});

export const aiInvoiceExtractionSchema = z.object({
  clientName: z.string().trim().default(''),
  clientEmail: z.string().trim().default(''),
  clientPhone: z.string().trim().default(''),
  items: z.array(aiInvoiceItemSchema).min(1, 'At least one item is required'),
  dueInDays: z.number().int().nonnegative().nullable().default(null),
  notes: z.string().trim().default(''),
  taxRate: z.number().finite().gte(0, 'Tax rate cannot be negative').nullable().default(null),
  suggestedDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .nullable()
    .default(null),
});

/**
 * Validates and sanitizes raw candidate extraction data.
 */
export function validateAIInvoiceExtraction(
  data: unknown,
  baseDate: Date = new Date()
): { success: true; data: AIInvoiceExtraction } | { success: false; error: string } {
  const result = aiInvoiceExtractionSchema.safeParse(data);

  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: `Invalid extraction schema: ${errorDetails}` };
  }

  const parsed = result.data;

  // Ensure suggestedDueDate is computed if dueInDays was provided but suggestedDueDate is missing
  let suggestedDueDate = parsed.suggestedDueDate;
  if (!suggestedDueDate && parsed.dueInDays !== null) {
    suggestedDueDate = calculateSuggestedDueDate(parsed.dueInDays, baseDate);
  }

  return {
    success: true,
    data: {
      clientName: parsed.clientName,
      clientEmail: parsed.clientEmail,
      clientPhone: parsed.clientPhone,
      items: parsed.items,
      dueInDays: parsed.dueInDays,
      notes: parsed.notes,
      taxRate: parsed.taxRate,
      suggestedDueDate,
    },
  };
}
