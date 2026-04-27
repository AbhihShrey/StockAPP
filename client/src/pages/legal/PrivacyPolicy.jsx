import { LegalShell } from './LegalShell'

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="April 26, 2026">
      <p>
        This Privacy Policy explains what information StockLine (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
        how we use it, and the choices you have. By creating an account or using StockLine you agree to the
        practices described below.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information.</strong> Your email address and a hashed (bcrypt) version of your password. We never store passwords in plain text.</li>
        <li><strong>Account preferences.</strong> Your watchlists, alerts, alert history, screener filters, portfolio holdings, and notification settings.</li>
        <li><strong>Browser-local data.</strong> Recent search symbols, comparison panel symbols, theme/density/locale preferences, and an alert-sound flag — stored only in your browser&rsquo;s <code>localStorage</code> and never sent to our servers.</li>
        <li><strong>Technical metadata.</strong> Standard server logs (IP address, timestamp, user-agent) used for security and rate limiting.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To authenticate your account and keep your session active.</li>
        <li>To deliver alert notifications by email or in-browser push when conditions you configured are met.</li>
        <li>To send transactional email related to your account (verification, password reset, daily digest if enabled).</li>
        <li>To detect abuse and apply rate limits.</li>
      </ul>
      <p>We do <strong>not</strong> sell your data, do <strong>not</strong> show advertising, and do <strong>not</strong> share your information with third-party advertisers or data brokers.</p>

      <h2>3. Third parties we rely on</h2>
      <ul>
        <li><strong>Financial Modeling Prep (FMP)</strong> — provides the market data shown on StockLine. Symbols you look up may appear in their request logs. See <a href="https://financialmodelingprep.com" target="_blank" rel="noopener noreferrer">financialmodelingprep.com</a>.</li>
        <li><strong>Email provider (SMTP)</strong> — used to deliver verification, password-reset, and alert emails. They process your email address solely to deliver mail.</li>
        <li><strong>Hosting provider</strong> — runs the StockLine application servers and stores the database.</li>
      </ul>

      <h2>4. Cookies and local storage</h2>
      <p>
        StockLine does not use third-party advertising or analytics cookies. We use your browser&rsquo;s
        <code> localStorage</code> only to remember your authentication token and your UI preferences.
        See our <a href="/cookies">Cookie Policy</a> for details.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Account data is retained while your account is active. Alert history is capped at the most recent
        1,000 events per user. Password-reset and email-verification tokens expire within 1 hour and are
        deleted shortly after expiry.
      </p>

      <h2>6. Your rights</h2>
      <ul>
        <li><strong>Access.</strong> You may request a copy of your stored data using the &ldquo;Download my data&rdquo; option in Settings.</li>
        <li><strong>Deletion.</strong> You may delete your account at any time from Settings → Account → Delete account. Deletion is immediate and permanent.</li>
        <li><strong>Correction.</strong> Contact us if any stored information is inaccurate.</li>
      </ul>
      <p>If you are located in the European Economic Area, the United Kingdom, or California, you have additional rights under GDPR / UK GDPR / CCPA. Contact us to exercise them.</p>

      <h2>7. Security</h2>
      <p>
        Passwords are hashed with bcrypt. Tokens for password reset and email verification are stored
        only as hashes. All traffic between your browser and our servers is encrypted with TLS. No
        system is perfectly secure — please use a strong, unique password and enable two-factor
        authentication in Settings.
      </p>

      <h2>8. Children</h2>
      <p>
        StockLine is not directed at children under 13 (or under 16 in the EEA). We do not knowingly collect
        personal information from children.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be communicated via
        email or an in-app notice prior to taking effect.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or requests? Reach us at <a href="mailto:stockline000@gmail.com">stockline000@gmail.com</a>.
      </p>

    </LegalShell>
  )
}
