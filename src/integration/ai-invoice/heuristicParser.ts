import type { AIInvoiceExtraction, AIInvoiceItem } from './aiInvoiceTypes';
import { validateAIInvoiceExtraction, calculateSuggestedDueDate } from './validation';

/**
 * Pure, deterministic heuristic / regex parser.
 * Serves as an offline fallback engine when Gemini AI is unconfigured or unreachable.
 *
 * NOTE ON CURRENCY LIMITATION:
 * The heuristic regex rules are designed primarily around common Indian/INR patterns
 * (₹, INR, Rs., and unlabeled amounts). Multi-currency parsing is intentionally out of scope
 * for Phase 1 and will be aligned with the application currency utility in subsequent phases.
 */
export function heuristicParse(text: string, baseDate: Date = new Date()): AIInvoiceExtraction {
  const cleanText = text.trim();

  // Common verbs and stop words to avoid mistaking for client names
  const stopWords = new Set([
    'I', 'We', 'You', 'They', 'Payment', 'Due', 'Total', 'Invoice', 'Please', 'Also', 'And',
    'Repaired', 'Installed', 'Serviced', 'Fixed', 'Built', 'Designed', 'Tailored', 'Taught',
    'Cleaned', 'Painted', 'Created', 'Replaced', 'Purchased', 'Sold', 'Delivered', 'Rendered',
    'Custom', 'Service', 'General', 'Work', 'Call'
  ]);

  // 1. Extract client name
  let clientName = '';

  // Match 1a: Possessive noun e.g. "Rahul's AC" or "Suresh's house"
  const possessiveMatch = cleanText.match(/\b([A-Z][a-z]+)(?:'s|’s)\b/);
  if (possessiveMatch && !stopWords.has(possessiveMatch[1])) {
    clientName = possessiveMatch[1].trim();
  }

  // Match 1b: Prepositional "for Rahul", "to Priya", "client Amit"
  if (!clientName) {
    const forMatch = cleanText.match(/(?:for|to|client|customer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (forMatch && !stopWords.has(forMatch[1])) {
      clientName = forMatch[1].replace(/'s$/i, '').trim();
    }
  }

  // Match 1c: Leading capitalized word if not an action/stop verb
  if (!clientName) {
    const leadMatch = cleanText.match(/^([A-Z][a-z]+)\s+/);
    if (leadMatch && !stopWords.has(leadMatch[1])) {
      clientName = leadMatch[1].replace(/'s$/i, '').trim();
    }
  }

  // 2. Extract preview-only contact information (Email & Phone)
  let clientEmail = '';
  const emailMatch = cleanText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) {
    clientEmail = emailMatch[0].trim();
  }

  let clientPhone = '';
  const phoneMatch = cleanText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/);
  if (phoneMatch) {
    clientPhone = phoneMatch[0].trim();
  }

  // 3. Extract payment due days
  let dueInDays: number | null = null;
  const dueMatch =
    cleanText.match(/(?:due\s+in|within|in)\s+(\d+)\s*days?/i) ||
    cleanText.match(/(\d+)\s*days?\s+(?:due|term)/i);

  if (dueMatch) {
    const parsedDays = parseInt(dueMatch[1], 10);
    if (!isNaN(parsedDays) && parsedDays >= 0) {
      dueInDays = parsedDays;
    }
  }

  // 4. Extract Tax Percentage (Tri-State: number > 0, 0, or null)
  let taxRate: number | null = null;

  // Check explicit zero tax / no tax patterns first
  const zeroTaxMatch = cleanText.match(
    /\b(no\s+tax|0%\s*tax|zero\s+tax|without\s+tax|tax\s+free|tax\s*:\s*0%|tax\s*is\s*0%|plus\s+0%\s*tax|0%\s*gst|gst\s*0%|tax\s*@\s*0%)\b/i
  );

  if (zeroTaxMatch) {
    taxRate = 0;
  } else {
    // Check explicit non-zero tax percentage patterns
    const taxMatch =
      cleanText.match(/(?:plus|\+|\with)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:tax|gst|vat)?/i) ||
      cleanText.match(/(?:tax|gst|vat)\s*(?:of|@)?\s*(\d+(?:\.\d+)?)\s*%/i);

    if (taxMatch) {
      const parsedTax = parseFloat(taxMatch[1]);
      if (!isNaN(parsedTax) && parsedTax >= 0) {
        taxRate = parsedTax;
      }
    }
  }

  // 5. Extract Line Items (services, quantities, unit rates)
  const items: AIInvoiceItem[] = [];

  // Split sentence on conjunctions, commas, periods (avoiding decimals in numbers like 18.5)
  const segments = cleanText.split(/(?:and|,|also|\.)(?![0-9])/i);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Pattern A: Quantity + Item + Rate (e.g. "3 ceiling fans for ₹1500 each" or "10 sessions at ₹500")
    const qtyRateMatch = trimmed.match(
      /(\d+)\s+([a-zA-Z\s&'-]+?)\s+(?:at|for|@|costing)\s*(?:₹|INR|Rs\.?|\$|€)?\s*(\d+(?:\.\d+)?)\s*(?:each|per\s+\w+)?/i
    );
    if (qtyRateMatch) {
      const qty = parseInt(qtyRateMatch[1], 10);
      let desc = qtyRateMatch[2].trim();
      const rate = parseFloat(qtyRateMatch[3]);

      if (desc && !isNaN(qty) && qty > 0 && !isNaN(rate) && rate >= 0) {
        if (clientName) {
          desc = desc.replace(new RegExp(`\\b${clientName}'?s?\\b`, 'gi'), '');
        }
        desc = desc.replace(/\s+/g, ' ').trim();
        items.push({
          description: desc || 'Custom Service',
          quantity: qty,
          rate,
        });
        continue;
      }
    }

    // Pattern B: Standard description for rate (e.g. "Repaired AC for ₹2500", "Replaced filter for ₹600")
    const standardMatch = trimmed.match(
      /([a-zA-Z\s&'-]+?)\s+(?:for|costing|at|@)\s*(?:₹|INR|Rs\.?|\$|€)?\s*(\d+(?:\.\d+)?)/i
    );
    if (standardMatch) {
      let desc = standardMatch[1].trim();
      const rate = parseFloat(standardMatch[2]);

      // Remove client name if inside description
      if (clientName) {
        desc = desc.replace(new RegExp(`\\b${clientName}'?s?\\b`, 'gi'), '');
      }
      desc = desc.replace(/\s+/g, ' ').trim();

      // Ignore phrases like "payment due in 7 days" matching as an item
      if (
        desc &&
        !isNaN(rate) &&
        rate >= 0 &&
        !desc.toLowerCase().includes('payment due') &&
        !desc.toLowerCase().includes('due in') &&
        !desc.toLowerCase().includes('tax')
      ) {
        items.push({
          description: desc,
          quantity: 1,
          rate,
        });
        continue;
      }
    }

    // Pattern C: Currency before description (e.g. "₹1200 for washing machine repair")
    const currencyFirstMatch = trimmed.match(
      /(?:₹|INR|Rs\.?|\$|€)\s*(\d+(?:\.\d+)?)\s+(?:for|towards)\s+([a-zA-Z\s&'-]+)/i
    );
    if (currencyFirstMatch) {
      const rate = parseFloat(currencyFirstMatch[1]);
      let desc = currencyFirstMatch[2].trim();
      if (clientName) {
        desc = desc.replace(new RegExp(`\\b${clientName}'?s?\\b`, 'gi'), '');
      }
      desc = desc.replace(/\s+/g, ' ').trim();
      if (desc && !isNaN(rate) && rate >= 0) {
        items.push({
          description: desc,
          quantity: 1,
          rate,
        });
      }
    }
  }

  // Fallback: If no items were parsed by patterns, construct a single fallback item
  if (items.length === 0) {
    const fallbackAmountMatch = cleanText.match(/(?:₹|INR|Rs\.?|\$|€)?\s*(\d+(?:\.\d+)?)/);
    const amount = fallbackAmountMatch ? parseFloat(fallbackAmountMatch[1]) : 0;
    let fallbackDesc = cleanText.slice(0, 60);
    if (clientName) {
      fallbackDesc = fallbackDesc.replace(new RegExp(`\\b${clientName}'?s?\\b`, 'gi'), '');
    }
    fallbackDesc = fallbackDesc.replace(/\s+/g, ' ').trim() || 'Service description';
    items.push({
      description: fallbackDesc,
      quantity: 1,
      rate: isNaN(amount) ? 0 : amount,
    });
  }

  const rawCandidate = {
    clientName: clientName || '',
    clientEmail,
    clientPhone,
    items,
    dueInDays,
    notes: cleanText,
    taxRate,
    suggestedDueDate: calculateSuggestedDueDate(dueInDays, baseDate),
  };

  const validation = validateAIInvoiceExtraction(rawCandidate, baseDate);
  if (validation.success) {
    return validation.data;
  }

  // Safe fallback structure if validation fails
  return {
    clientName: clientName || '',
    clientEmail: '',
    clientPhone: '',
    items: [{ description: 'Work performed', quantity: 1, rate: 0 }],
    dueInDays: null,
    notes: cleanText,
    taxRate: null,
    suggestedDueDate: null,
  };
}
