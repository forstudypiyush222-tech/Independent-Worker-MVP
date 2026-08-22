export const DEFAULT_CURRENCY = '₹'

/**
 * Extracts and trims the currency from an invoice, falling back to DEFAULT_CURRENCY
 * if undefined, null, or empty.
 */
export function getInvoiceCurrency(invoice?: { currency?: string } | null): string {
  if (!invoice || typeof invoice.currency !== 'string') {
    return DEFAULT_CURRENCY
  }
  const trimmed = invoice.currency.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_CURRENCY
}

/**
 * Formats a monetary number with the specified or fallback currency symbol.
 */
export function formatCurrency(amount: number, currency?: string): string {
  const symbol = (currency && currency.trim()) || DEFAULT_CURRENCY
  const safeAmount = Number.isFinite(amount) ? amount : 0
  return `${symbol}${safeAmount.toFixed(2)}`
}

/**
 * Aggregates a list of records with amounts by their respective invoice currencies.
 * Returns a mapping of { [currencySymbol]: totalAmount }.
 */
export function aggregateAmountsByCurrency(
  records: Array<{ invoice?: { currency?: string } | null; amount: number }>
): Record<string, number> {
  const totals: Record<string, number> = {}

  records.forEach((record) => {
    const currency = getInvoiceCurrency(record.invoice)
    const amount = Number.isFinite(record.amount) ? record.amount : 0
    totals[currency] = (totals[currency] || 0) + amount
  })

  return totals
}

/**
 * Formats multi-currency aggregate totals into a single display string.
 * - If empty or 0 total: returns standard formatted 0 (e.g. ₹0.00).
 * - If single currency: returns that currency total (e.g. ₹5,000.00).
 * - If multiple currencies: returns cleanly separated list (e.g. $100.00 · ₹5,000.00).
 */
export function formatCurrencyTotals(
  totalsByCurrency: Record<string, number>,
  fallbackCurrency = DEFAULT_CURRENCY
): string {
  const entries = Object.entries(totalsByCurrency).filter(
    ([, amount]) => typeof amount === 'number'
  )

  if (entries.length === 0) {
    return `${fallbackCurrency}0.00`
  }

  if (entries.length === 1) {
    const [currency, amount] = entries[0]
    return formatCurrency(amount, currency)
  }

  // Multiple currencies
  return entries
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(' · ')
}
