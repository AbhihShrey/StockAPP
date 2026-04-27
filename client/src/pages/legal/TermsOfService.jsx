import { LegalShell } from './LegalShell'

export function TermsOfService() {
  return (
    <LegalShell title="Terms of Service" lastUpdated="April 26, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of StockLine
        (&ldquo;StockLine&rdquo;, the &ldquo;Service&rdquo;). By creating an account or using the Service,
        you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 13 years old (16 in the EEA) and able to form a binding contract under
        applicable law. You may not use StockLine if you are barred from doing so under any applicable law.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your password and any activity that occurs under your account.</li>
        <li>You agree to provide accurate information when registering and to keep that information current.</li>
        <li>Notify us immediately of any unauthorized use of your account.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse engineer, scrape, or systematically extract market data from the Service in violation of our data provider&rsquo;s terms.</li>
        <li>Interfere with the operation of the Service, attempt to bypass rate limits, or perform unauthorized security testing.</li>
        <li>Use the Service to transmit malware, spam, or unlawful content.</li>
        <li>Resell or rebrand the Service or its data outputs without prior written consent.</li>
      </ul>

      <h2>4. Intellectual property</h2>
      <p>
        StockLine and its underlying software, design, and content are owned by Abhih Kodavanty and
        are protected by intellectual property laws. We grant you a limited, revocable, non-exclusive,
        non-transferable license to access and use the Service for personal, non-commercial use.
      </p>
      <p>
        Market data displayed in the Service is licensed from Financial Modeling Prep and is subject to
        their terms. You receive no ownership rights to that data.
      </p>

      <h2>5. No investment advice</h2>
      <p>
        StockLine is provided strictly for informational and educational purposes. <strong>Nothing on the
        Service constitutes investment, financial, tax, or legal advice.</strong> See our
        {' '}<a href="/disclaimer">Disclaimer</a> for the full scope of this provision.
      </p>

      <h2>6. Service availability and changes</h2>
      <p>
        We strive to keep StockLine available, but we may modify, suspend, or discontinue any feature at
        any time without notice. We are not liable for any unavailability, delay in data, or loss
        resulting from such changes.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may delete your account at any time from Settings. We may suspend or terminate your access
        for violations of these Terms or for any other reason at our discretion. Provisions that by
        their nature should survive termination (intellectual property, disclaimers, limitation of
        liability, governing law) will continue to apply.
      </p>

      <h2>8. Disclaimer of warranties</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES
        OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY OF DATA. WE DO NOT WARRANT THAT
        MARKET DATA IS REAL-TIME, COMPLETE, OR ERROR-FREE.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, STOCKLINE AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS,
        REVENUE, DATA, OR INVESTMENT VALUE, ARISING OUT OF YOUR USE OF THE SERVICE — EVEN IF WE HAVE
        BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO
        THE SERVICE SHALL NOT EXCEED THE GREATER OF (a) THE AMOUNT YOU PAID US IN THE PRIOR 12 MONTHS
        OR (b) USD $50.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless StockLine and its operators from any claims, damages, or
        expenses arising from your violation of these Terms or your misuse of the Service.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of California, without regard to its
        conflict-of-laws principles. Any dispute will be resolved in the state or federal courts
        located in Alameda County, California, and you consent to personal jurisdiction there.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may revise these Terms from time to time. Material changes will be announced via email or
        in-app notice. Continued use of the Service after the effective date constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>Questions about these Terms? Reach us at <a href="mailto:stockline000@gmail.com">stockline000@gmail.com</a>.</p>

      <p className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-zinc-500">
        <strong className="text-zinc-300">Template notice.</strong> This document is a starting-point
        template and is not legal advice. Replace the bracketed placeholders and have a qualified
        attorney review it before publishing.
      </p>
    </LegalShell>
  )
}
