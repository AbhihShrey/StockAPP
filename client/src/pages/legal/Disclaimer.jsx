import { LegalShell } from './LegalShell'

export function Disclaimer() {
  return (
    <LegalShell title="Financial Disclaimer" lastUpdated="April 26, 2026">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-5 text-sm leading-relaxed text-amber-100">
        <p className="font-semibold text-amber-200">Ember Finances is for informational purposes only.</p>
        <p className="mt-2 text-amber-100/90">
          Nothing on this site constitutes investment, financial, trading, tax, or legal advice. We are
          not a registered investment advisor, broker-dealer, or financial planner. Always consult a
          licensed professional before making any investment decision.
        </p>
      </div>

      <h2>1. Not investment advice</h2>
      <p>
        All content on Ember Finances — including watchlists, scanners, backtests, sector rotation views,
        alerts, news feeds, charts, scores, sentiment readings, and any other data or commentary — is
        provided strictly as informational tools. None of it constitutes a recommendation to buy,
        sell, or hold any security. You are solely responsible for your own investment decisions.
      </p>

      <h2>2. No guarantee of accuracy</h2>
      <p>
        Market data is sourced from third-party providers (currently Financial Modeling Prep) and may
        contain errors, omissions, or delays. Quotes may be delayed, real-time, or aftermarket — clearly
        labeled where possible but never guaranteed. Ember Finances makes no warranty as to accuracy,
        completeness, or timeliness of any data displayed.
      </p>

      <h2>3. Past performance is not indicative of future results</h2>
      <p>
        Backtests and historical metrics shown on Ember Finances represent hypothetical, past behavior of a
        strategy on historical data. They do <strong>not</strong> reflect actual trading and do
        <strong> not</strong> account for slippage, taxes, market impact, or your specific commission
        schedule. Real trading results will differ — often substantially — from any backtest.
      </p>

      <h2>4. Risk of loss</h2>
      <p>
        Trading and investing involves substantial risk, including the risk of total loss of principal.
        Leverage, options, and short selling magnify these risks. Only invest funds you can afford to
        lose. If you do not understand the risks of a particular instrument or strategy, do not trade
        it.
      </p>

      <h2>5. No fiduciary relationship</h2>
      <p>
        Use of Ember Finances does not create a fiduciary, advisor-client, broker-client, or other professional
        relationship between you and Ember Finances or its operators. We owe you no duty of care with respect
        to your investment decisions.
      </p>

      <h2>6. Forward-looking statements</h2>
      <p>
        Predictive features (volatility heatmap, regime indicators, scoring grids, etc.) are based on
        statistical models trained on past data. They cannot reliably predict future market behavior.
        Treat any forward-looking output as a probabilistic hypothesis, not a forecast.
      </p>

      <h2>7. Third-party links</h2>
      <p>
        Ember Finances may link to third-party websites or data providers. We are not responsible for the
        content, accuracy, or practices of those third parties.
      </p>

      <h2>8. Acknowledgement</h2>
      <p>
        By using Ember Finances, you acknowledge that you have read and understood this Disclaimer and agree
        that all use of the platform is at your own risk and discretion.
      </p>

    </LegalShell>
  )
}
