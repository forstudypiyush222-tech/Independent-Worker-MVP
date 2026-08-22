import type { Invoice, ProductLine } from '../../data/types';
import type { AIInvoiceExtraction } from './aiInvoiceTypes';
import { format } from 'date-fns/format';

/**
 * Pure mapping function that transforms an AI extraction result into an updated Invoice object.
 *
 * STRICT DATA MAPPING RULES:
 * 1. clientName: Maps to invoice.clientName.
 * 2. items: Maps to invoice.productLines with string quantities and rates.
 * 3. taxRate: Formats as 'Sale Tax (X%)' in invoice.taxLabel if > 0.
 * 4. suggestedDueDate / dueInDays: Formatted as 'MMM dd, yyyy' in invoice.invoiceDueDate.
 * 5. notes: Maps extraction.notes to invoice.notes (job notes only).
 * 6. clientEmail & clientPhone: PREVIEW ONLY. NEVER appended to notes or persisted.
 * 7. Preserves company info, invoice ID, currency, and untouched labels immutably.
 */
export function mapAIExtractionToInvoice(
  extraction: AIInvoiceExtraction,
  currentInvoice: Invoice,
  baseDate: Date = new Date()
): Invoice {
  // 1. Client Name
  const clientName =
    extraction.clientName && extraction.clientName.trim().length > 0
      ? extraction.clientName.trim()
      : currentInvoice.clientName;

  // 2. Product Lines
  let productLines: ProductLine[] = currentInvoice.productLines;
  if (Array.isArray(extraction.items) && extraction.items.length > 0) {
    productLines = extraction.items.map((item) => {
      const quantityStr =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0
          ? item.quantity.toString()
          : '1';

      const rateStr =
        typeof item.rate === 'number' && Number.isFinite(item.rate)
          ? item.rate.toFixed(2)
          : '0.00';

      return {
        description: item.description ? item.description.trim() : '',
        quantity: quantityStr,
        rate: rateStr,
      };
    });
  }

  // 3. Tax Label
  let taxLabel = currentInvoice.taxLabel;
  if (typeof extraction.taxRate === 'number' && Number.isFinite(extraction.taxRate) && extraction.taxRate > 0) {
    taxLabel = `Sale Tax (${extraction.taxRate}%)`;
  }

  // 4. Due Date
  let invoiceDueDate = currentInvoice.invoiceDueDate;
  if (extraction.suggestedDueDate && /^\d{4}-\d{2}-\d{2}$/.test(extraction.suggestedDueDate)) {
    const [year, month, day] = extraction.suggestedDueDate.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (!isNaN(parsedDate.getTime())) {
      invoiceDueDate = format(parsedDate, 'MMM dd, yyyy');
    }
  } else if (
    typeof extraction.dueInDays === 'number' &&
    Number.isFinite(extraction.dueInDays) &&
    extraction.dueInDays >= 0
  ) {
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + Math.round(extraction.dueInDays));
    invoiceDueDate = format(targetDate, 'MMM dd, yyyy');
  }

  // 5. Notes (STRICT: job notes only, clientEmail and clientPhone are NOT appended)
  const notes =
    extraction.notes && extraction.notes.trim().length > 0
      ? extraction.notes.trim()
      : currentInvoice.notes;

  // Return new immutable copy with mapped fields and preserved existing fields
  return {
    ...currentInvoice,
    clientName,
    productLines,
    taxLabel,
    invoiceDueDate,
    notes,
  };
}
