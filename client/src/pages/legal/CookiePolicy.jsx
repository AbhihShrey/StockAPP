import { LegalShell } from './LegalShell'

export function CookiePolicy() {
  return (
    <LegalShell title="Cookie Policy" lastUpdated="April 26, 2026">
      <p>
        StockLine uses your browser&rsquo;s <code>localStorage</code> to remember your sign-in session and
        a small set of UI preferences. We do <strong>not</strong> use third-party advertising cookies,
        third-party analytics cookies, or cross-site tracking pixels.
      </p>

      <h2>1. What we store in your browser</h2>
      <ul>
        <li><strong>Authentication token</strong> (<code>investaiv1_token_v2</code>) — your session JWT, used to keep you signed in across page reloads.</li>
        <li><strong>Recent search symbols</strong> (<code>recent_search_symbols</code>) — the last few tickers you searched in the command palette.</li>
        <li><strong>Compare panel symbols</strong> (<code>compare_panel_symbols</code>) — the symbols you have pinned in the Charts comparison view.</li>
        <li><strong>Alert sound preference</strong> (<code>stockline_alert_sound</code>) — whether the in-browser alert chime is muted.</li>
        <li><strong>UI preferences</strong> — theme (dark/light/system), table density, default landing page, locale, chart style, quiet-hours window.</li>
      </ul>
      <p>None of these values are sent to third parties. They live in your browser and travel only between your device and our own servers (and only those needed for the request, e.g., the auth token).</p>

      <h2>2. What we do not use</h2>
      <ul>
        <li>No third-party advertising cookies.</li>
        <li>No tracking pixels (Facebook, X, TikTok, etc.).</li>
        <li>No third-party analytics scripts (Google Analytics, Mixpanel, Segment, etc.).</li>
        <li>No cross-site identifiers or fingerprinting.</li>
      </ul>

      <h2>3. Server-side cookies</h2>
      <p>
        Authentication is implemented with a JWT held in <code>localStorage</code>, not a cookie. The
        StockLine backend itself does not set any cookies on your browser.
      </p>

      <h2>4. Clearing data</h2>
      <p>
        You can clear all StockLine-related browser data at any time by signing out (which removes the
        auth token), or by clearing your browser&rsquo;s storage for this site. Doing so will sign you
        out and reset your UI preferences to defaults.
      </p>

      <h2>5. Changes</h2>
      <p>
        If we ever introduce new storage keys or third-party services, we will update this page and
        announce material changes in-app or by email.
      </p>

      <h2>6. Contact</h2>
      <p>Questions? Email <a href="mailto:stockline000@gmail.com">stockline000@gmail.com</a>.</p>

    </LegalShell>
  )
}
