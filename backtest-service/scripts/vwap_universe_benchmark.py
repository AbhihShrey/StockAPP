#!/usr/bin/env python3
"""
Unbiased batch check: VWAP strategy vs buy & hold on a fixed ticker list with identical
dates and parameters for every symbol (no per-name tuning — avoids selection bias).

Run from repo root or backtest-service:
  cd backtest-service && .venv/bin/python scripts/vwap_universe_benchmark.py

Exit code is always 0 (reporting tool). Use --fail-if-mean-negative to fail CI when
mean(strategy - benchmark) total return % is < 0 over the universe (informational gate).

No strategy can outperform buy & hold on every mega-cap in every window without lookahead;
this script measures where the current rules win or lose so you can review risk honestly.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow `from runner import …` when executed as a file
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from runner import run_backtest  # noqa: E402

# MAG7 (client/src/lib/tradingViewSymbol.js) + liquid mega-caps / overview names
DEFAULT_TICKERS = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "META",
    "NVDA",
    "TSLA",
    "SPY",
    "QQQ",
    "AMD",
    "JPM",
    "AVGO",
    "COST",
    "NFLX",
    "COIN",
    "UNH",
    "XOM",
]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--start", default="2020-01-01", help="Inclusive start (ISO date)")
    p.add_argument("--end", default=None, help="Exclusive/through end for Yahoo (default: None = through last bar)")
    p.add_argument(
        "--tickers",
        default=",".join(DEFAULT_TICKERS),
        help="Comma-separated symbols (same order as processed)",
    )
    p.add_argument("--trend-sma", type=int, default=0, dest="trend_sma")
    p.add_argument("--roll-window", type=int, default=20, dest="roll_window")
    p.add_argument("--json", action="store_true", help="Print one JSON object instead of text table")
    p.add_argument(
        "--fail-if-mean-negative",
        action="store_true",
        help="Exit 1 if mean(strategy_total_pct - benchmark_total_pct) < 0",
    )
    args = p.parse_args()

    tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    params = {"trendSma": args.trend_sma, "rollWindow": args.roll_window}

    rows: list[dict[str, object]] = []
    for sym in tickers:
        try:
            r = run_backtest("vwap_trend", sym, args.start, args.end, params)
            s = r["metrics"]["totalReturnPct"]
            b = r["benchmark"]["metrics"]["totalReturnPct"]
            if s is None or b is None:
                rows.append({"symbol": sym, "error": "missing_metrics", "strat_pct": s, "bh_pct": b})
                continue
            diff = float(s) - float(b)
            rows.append(
                {
                    "symbol": sym,
                    "strat_pct": round(float(s), 2),
                    "bh_pct": round(float(b), 2),
                    "excess_pct": round(diff, 2),
                    "beats_bh": diff > 0,
                    "ties_bh": abs(diff) < 1e-6,
                }
            )
        except Exception as e:
            rows.append({"symbol": sym, "error": str(e)[:200]})

    ok = [x for x in rows if "excess_pct" in x]
    wins = sum(1 for x in ok if x["beats_bh"])
    ties = sum(1 for x in ok if x.get("ties_bh"))
    mean_excess = sum(float(x["excess_pct"]) for x in ok) / len(ok) if ok else None

    summary = {
        "start": args.start,
        "end": args.end,
        "params": params,
        "tickers_requested": len(tickers),
        "tickers_ok": len(ok),
        "wins_vs_buy_hold": wins,
        "ties_buy_hold": ties,
        "mean_excess_total_return_pct": None if mean_excess is None else round(mean_excess, 2),
        "protocol": "Same dates and params for every ticker; no per-symbol optimization.",
    }

    if args.json:
        print(json.dumps({"summary": summary, "rows": rows}, indent=2))
    else:
        print("VWAP universe benchmark (unbiased protocol)")
        print(f"  window: {args.start} → {args.end or 'latest'}")
        print(f"  params: {params}")
        print(
            f"  wins / ties / n: {wins} / {ties} / {len(ok)}   "
            f"mean excess return %: {summary['mean_excess_total_return_pct']}"
        )
        print()
        print(f"{'symbol':<6} {'strat%':>10} {'bh%':>10} {'excess':>10}  note")
        for x in rows:
            if "error" in x:
                print(f"{x['symbol']:<6} {'—':>10} {'—':>10} {'—':>10}  {x['error']}")
            else:
                tag = "tie" if x.get("ties_bh") else ("win" if x["beats_bh"] else "lose")
                print(
                    f"{x['symbol']:<6} {x['strat_pct']:>10.2f} {x['bh_pct']:>10.2f} "
                    f"{x['excess_pct']:>+10.2f}  {tag}"
                )
        print()
        print(
            "Interpretation: VWAP regime rules often sit out cash during parabolic legs, "
            "so buy & hold can win on high-momentum names even when the strategy wins on others."
        )

    if args.fail_if_mean_negative and mean_excess is not None and mean_excess < 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
