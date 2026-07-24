/**
 * Browser-only facts about how the page is being viewed. All of it is media-query
 * or vendor-property shaped, so none of it is knowable on the server — call
 * these from an effect, never during render, or the first paint won't match.
 */

/** Running as an installed app rather than a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS never implemented display-mode; this is Safari's own flag.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * An iPhone or iPad. `navigator.standalone` exists only on iOS WebKit, which
 * makes it a better test than the user-agent string — iPadOS claims to be a Mac
 * and there is no honest way to tell from the UA alone.
 */
export function isIos(): boolean {
  return "standalone" in navigator;
}

/**
 * Registers the service worker if this context can have one. Registration is
 * idempotent, so every entry point calls it rather than coordinating.
 *
 * Returns null instead of throwing: no service worker means no alerts, which is
 * a degraded party app, not a broken one.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;

  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}
