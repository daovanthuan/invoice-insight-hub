// Currency normalization and formatting utilities

// Map of currency variations to their standard code
const CURRENCY_MAP: Record<string, string> = {
  // USD variations
  'USD': 'USD',
  'US$': 'USD',
  '$': 'USD',
  'us$': 'USD',
  'usd': 'USD',
  'dollar': 'USD',
  'dollars': 'USD',
  
  // VND variations
  'VND': 'VND',
  'VNĐ': 'VND',
  'vnd': 'VND',
  'vnđ': 'VND',
  'đ': 'VND',
  '₫': 'VND',
  'đồng': 'VND',
  'dong': 'VND',
  
  // EUR variations
  'EUR': 'EUR',
  '€': 'EUR',
  'eur': 'EUR',
  'euro': 'EUR',
  'euros': 'EUR',
  
  // GBP variations
  'GBP': 'GBP',
  '£': 'GBP',
  'gbp': 'GBP',
  'pound': 'GBP',
  'pounds': 'GBP',
  
  // JPY variations
  'JPY': 'JPY',
  '¥': 'JPY',
  'jpy': 'JPY',
  'yen': 'JPY',
  
  // CNY/RMB variations
  'CNY': 'CNY',
  'RMB': 'CNY',
  'cny': 'CNY',
  'rmb': 'CNY',
  'yuan': 'CNY',
  
  // KRW variations
  'KRW': 'KRW',
  '₩': 'KRW',
  'krw': 'KRW',
  'won': 'KRW',
  
  // THB variations
  'THB': 'THB',
  '฿': 'THB',
  'thb': 'THB',
  'baht': 'THB',
  
  // SGD variations
  'SGD': 'SGD',
  'S$': 'SGD',
  'sgd': 'SGD',
  
  // AUD variations
  'AUD': 'AUD',
  'A$': 'AUD',
  'aud': 'AUD',
  
  // CAD variations
  'CAD': 'CAD',
  'C$': 'CAD',
  'cad': 'CAD',
  
  // CHF variations
  'CHF': 'CHF',
  'chf': 'CHF',
  'franc': 'CHF',
};

/**
 * Normalize a currency string to its standard ISO code
 * e.g., "US$" -> "USD", "$" -> "USD", "VNĐ" -> "VND"
 */
export function normalizeCurrency(currency: string | null | undefined): string {
  if (!currency) return 'VND';
  
  const trimmed = currency.trim();
  
  // Direct match
  if (CURRENCY_MAP[trimmed]) {
    return CURRENCY_MAP[trimmed];
  }
  
  // Try lowercase match
  const lower = trimmed.toLowerCase();
  if (CURRENCY_MAP[lower]) {
    return CURRENCY_MAP[lower];
  }
  
  // Try uppercase match
  const upper = trimmed.toUpperCase();
  if (CURRENCY_MAP[upper]) {
    return CURRENCY_MAP[upper];
  }
  
  // If it's a 3-letter code, assume it's already standard
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  
  // Default to the original value (uppercase)
  return trimmed.toUpperCase() || 'VND';
}

/**
 * Get the currency symbol for display
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'VND': '₫',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'KRW': '₩',
    'THB': '฿',
  };
  return symbols[currency] || currency;
}

/**
 * Format amount with currency - compact format for large numbers
 */
export function formatCurrencyCompact(amount: number, currency?: string): string {
  const curr = currency || 'VND';
  
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B ${curr}`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ${curr}`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K ${curr}`;
  }
  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${curr}`;
}

/**
 * Format amount with currency - full format
 */
export function formatCurrencyFull(amount: number, currency?: string): string {
  const curr = currency || 'VND';
  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${curr}`;
}

/**
 * Group amounts by normalized currency
 */
export function groupByCurrency<T>(
  items: T[],
  getCurrency: (item: T) => string | null | undefined,
  getAmount: (item: T) => number | null | undefined
): Record<string, number> {
  return items.reduce((acc: Record<string, number>, item) => {
    const currency = normalizeCurrency(getCurrency(item));
    acc[currency] = (acc[currency] || 0) + (getAmount(item) || 0);
    return acc;
  }, {});
}
