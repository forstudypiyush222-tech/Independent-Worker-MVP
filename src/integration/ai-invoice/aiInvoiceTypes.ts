/**
 * Strongly typed contracts for AI Invoice Extraction Engine (Phase 1).
 * Completely isolated from UI and production components.
 */

export interface AIInvoiceRequest {
  text: string;
}

export interface AIInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface AIInvoiceExtraction {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: AIInvoiceItem[];
  dueInDays: number | null;
  notes: string;
  taxRate: number | null;
  suggestedDueDate: string | null;
}

export interface AIInvoiceExtractionResult {
  success: boolean;
  data?: AIInvoiceExtraction;
  source?: 'gemini' | 'heuristic';
  warning?: string;
  error?: string;
}
