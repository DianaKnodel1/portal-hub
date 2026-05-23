/**
 * Central domain cleaning utility.
 * Strips known subdomains (e.g. "portal.") from the current hostname
 * to get the tenant's root domain for lookup.
 *
 * Examples:
 *   portal.office23.de       → office23.de
 *   portal.digital-dgigmbh.de → digital-dgigmbh.de
 *   office23.de              → office23.de
 *   localhost                 → localhost
 */
export function getTenantDomain(hostname?: string): string {
  const h = (hostname ?? window.location.hostname).toLowerCase().trim();
  // Strip known portal subdomain prefix
  return h.replace(/^portal\./, "");
}

/**
 * Returns true if the current hostname is a local/preview environment
 * where tenant lookup failures should not block the app.
 */
export function isLocalOrPreview(hostname?: string): boolean {
  const h = (hostname ?? window.location.hostname).toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.includes("lovable.app") ||
    h.includes("lovableproject.com")
  );
}
