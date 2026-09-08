/**
 * Analytics for the Vue demo app.
 *
 * Two things make this different from a plain gtag snippet.
 *
 * First, this app is a single page using HASH routing. GA4's automatic
 * page_view fires once, on the initial document load, and its enhanced
 * measurement watches History API calls — not hash changes. Left alone it would
 * report the landing page and nothing else, so navigating to a demo or to the
 * benchmark would be invisible. The automatic page_view is therefore turned off
 * and one is sent explicitly on every route change instead.
 *
 * Second, every view reports `page_type` and `page_id` derived from the route,
 * plus `wrapper`, so reports can separate the benchmark from the demos and tell
 * the React, Vue, Angular and vanilla properties apart without pattern-matching
 * URLs in the GA console.
 *
 * NOTE: page_type, page_id and wrapper are custom parameters. They have to be
 * registered as custom dimensions in the GA4 admin (Admin > Custom definitions,
 * scope "Event") before they appear in reports. page_title and page_location
 * work immediately.
 */

const GA_ID = 'G-S1NK61TS72';
const WRAPPER = 'vue';

type GtagArgs = [string, ...unknown[]];
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

let ready = false;

/** Classify a route so reports can group by kind without parsing URLs. */
export function pageIdentity(path: string): { type: string; id: string } {
  const clean = path.replace(/^#/, '').replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!clean) return { type: 'gallery', id: 'gallery' };
  if (clean === 'benchmark') return { type: 'benchmark', id: 'benchmark' };
  return { type: 'demo', id: clean };
}

export function initAnalytics(): void {
  if (ready) return;
  // Local development traffic never reaches reporting.
  const host = window.location.hostname;
  if (
    window.location.protocol === 'file:' ||
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]'
  ) {
    return;
  }
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    // A page that already carries its own inline tag wins; don't double-count.
    ready = true;
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: GtagArgs) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;

  gtag('js', new Date());
  // send_page_view: false, because the automatic one cannot see hash routing.
  // trackPageView() below sends every view, the first one included.
  gtag('config', GA_ID, { send_page_view: false, wrapper: WRAPPER });
  ready = true;
}

/** Report one view. Call on first paint and on every route change. */
export function trackPageView(path: string): void {
  if (typeof window.gtag !== 'function') return;
  const page = pageIdentity(path);
  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_title: document.title,
    page_type: page.type,
    page_id: page.id,
    wrapper: WRAPPER,
  });
}

/** Report a one-off event. No-ops when analytics did not initialise. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, { ...params, wrapper: WRAPPER });
}
