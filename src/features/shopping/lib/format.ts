/**
 * Shopping-specific formatting helpers.
 * Shares VND formatting conventions with the Finance module.
 */

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatPrice(priceMinor: number): string {
  return vndFormatter.format(priceMinor);
}

/** Format quantity: whole numbers without decimals (1 → "1", 0.5 → "0.5"). */
export function formatQty(qty: number): string {
  return qty % 1 === 0 ? String(Math.floor(qty)) : String(qty);
}
