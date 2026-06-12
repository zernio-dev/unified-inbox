/**
 * WhatsApp Business Calling, country gating.
 *
 * Meta blocks business-initiated calls (BIC) when the BUSINESS phone number
 * (not the company entity) is registered in one of five countries. Inbound
 * calls keep working, so the gate only hides the outbound dial pad.
 */

export const BIC_BLOCKED_BUSINESS_COUNTRIES = ['US', 'CA', 'EG', 'VN', 'NG'] as const;

/**
 * Resolve an E.164 phone number to an ISO-2 country code. Lightweight prefix
 * map (no libphonenumber); only covers the prefixes the calling gate needs.
 * Accepts the number with or without a leading `+`. Returns null for unknown.
 */
export function countryCodeFromE164(e164: string): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  if (!digits) return null;
  // NANP: +1 is shared between US and CA, but both are BIC-blocked, so the
  // distinction doesn't matter for the gate.
  if (digits.startsWith('1')) return 'US';
  const map: Record<string, string> = {
    '20': 'EG',
    '84': 'VN',
    '234': 'NG',
  };
  // Longer prefixes first so '234' (NG) wins over a shorter overlap.
  const prefixes = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (digits.startsWith(prefix)) return map[prefix];
  }
  return null;
}

/** Whether the country falls under Meta's business-initiated-calling block. */
export function isBicBlocked(countryCode: string | null): boolean {
  if (!countryCode) return false;
  return (BIC_BLOCKED_BUSINESS_COUNTRIES as readonly string[]).includes(countryCode);
}
