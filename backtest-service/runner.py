"""
Backtest runners using vectorbt Pro when installed, else open-source vectorbt.
Data: Yahoo Finance via vectorbt YFData (works for most US tickers).
"""

from __future__ import annotations

import math
import os
import re
from datetime import timedelta as dt_timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

_ISO8601_DURATION = re.compile(
    r"^P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?(?:(?P<mins>\d+)M)?(?:(?P<secs>\d+(?:\.\d+)?)S)?)?$",
    re.IGNORECASE,
)


def load_vectorbt():
    """Prefer vectorbtpro (same patterns as vectorbt); fall back to vectorbt."""
    try:
        import vectorbtpro as vbt  # type: ignore

        return vbt, "vectorbtpro"
    except ImportError:
        import vectorbt as vbt  # type: ignore

        return vbt, "vectorbt"


def _pf_get(pf: Any, name: str) -> Any:
    """vectorbt uses methods (value()); vectorbtpro often uses properties (value)."""
    attr = getattr(pf, name, None)
    if attr is None:
        return None
    if callable(attr):
        try:
            return attr()
        except TypeError:
            return attr
    return attr


def _scalar_from_maybe_series(x: Any) -> Any:
    if x is None:
        return None
    if isinstance(x, pd.Series):
        if len(x) == 0:
            return None
        return x.iloc[-1]
    return x


def _json_float(x: Any) -> float | None:
    if x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(v) or math.isinf(v):
        return None
    return v


def _format_duration_for_display(v: Any) -> str:
    """Human-readable duration (avoid timedelta.isoformat() → P19DT2H40M0S in JSON)."""
    try:
        td = pd.Timedelta(v)
    except (TypeError, ValueError, OverflowError):
        return str(v)
    if pd.isna(td):
        return "—"
    total = float(td.total_seconds())
    sign = "-" if total < 0 else ""
    total = abs(total)
    days = int(total // 86400)
    rem = total % 86400
    hours = int(rem // 3600)
    mins = int((rem % 3600) // 60)
    secs = int(rem % 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if mins:
        parts.append(f"{mins}m")
    if not parts:
        parts.append(f"{secs}s" if secs else "0s")
    return sign + " ".join(parts)


def _format_iso8601_duration_string(s: str) -> str | None:
    m = _ISO8601_DURATION.match(s.strip())
    if not m:
        return None
    d = m.group("days")
    h = m.group("hours")
    mi = m.group("mins")
    se = m.group("secs")
    parts: list[str] = []
    if d:
        parts.append(f"{int(d)}d")
    if h:
        parts.append(f"{int(h)}h")
    if mi:
        parts.append(f"{int(mi)}m")
    if se is not None and float(se) > 0:
        parts.append(f"{float(se):g}s")
    return " ".join(parts) if parts else None


def _serialize_stat_value(v: Any) -> Any:
    """JSON-safe scalar for stats / metrics."""
    if v is None:
        return None
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (int, np.integer)):
        return int(v)
    jf = _json_float(v)
    if jf is not None:
        return jf
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, (pd.Timedelta, dt_timedelta)):
        return _format_duration_for_display(v)
    if isinstance(v, np.timedelta64):
        return _format_duration_for_display(pd.Timedelta(v))
    # datetime-like, but not timedelta (timedelta.isoformat is ISO-8601 duration noise)
    if hasattr(v, "isoformat") and callable(v.isoformat) and not isinstance(
        v, (pd.Timedelta, dt_timedelta, np.timedelta64)
    ):
        try:
            return v.isoformat()
        except Exception:
            pass
    if isinstance(v, str):
        pretty = _format_iso8601_duration_string(v)
        if pretty is not None:
            return pretty
    s = str(v)
    if s.startswith("P") and (m := _format_iso8601_duration_string(s)) is not None:
        return m
    if len(s) > 500:
        return s[:500] + "…"
    return s


def _stats_to_dict(pf: Any) -> dict[str, Any]:
    """All portfolio stats from vectorbt, JSON-serialized."""
    stats = _pf_get(pf, "stats")
    out: dict[str, Any] = {}
    if stats is None:
        return out
    if hasattr(stats, "to_dict"):
        raw = stats.to_dict()
        for k, val in raw.items():
            out[str(k)] = _serialize_stat_value(_scalar_from_maybe_series(val))
    return out


def _downsample_equity(series: pd.Series, max_points: int = 240) -> list[dict[str, Any]]:
    if series is None or len(series) == 0:
        return []
    s = series.dropna()
    if len(s) == 0:
        return []
    step = max(1, len(s) // max_points)
    out = []
    for ts, val in s.iloc[::step].items():
        fv = _json_float(val)
        if fv is None:
            continue
        t = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        out.append({"t": t, "v": fv})
    last_ts, last_v = s.iloc[-1], float(s.iloc[-1])
    if out and out[-1]["t"] != (last_ts.isoformat() if hasattr(last_ts, "isoformat") else str(last_ts)):
        out.append(
            {
                "t": last_ts.isoformat() if hasattr(last_ts, "isoformat") else str(last_ts),
                "v": last_v,
            }
        )
    return out


def _downsample_compare_equity(
    eq_s: pd.Series,
    eq_b: pd.Series,
    max_points: int = 240,
) -> list[dict[str, Any]]:
    """Aligned portfolio values for strategy vs benchmark on identical timestamps."""
    if eq_s is None or eq_b is None:
        return []
    idx = eq_s.index.intersection(eq_b.index)
    if len(idx) == 0:
        return []
    idx = idx.sort_values()
    s = eq_s.reindex(idx)
    b = eq_b.reindex(idx)
    ok = s.notna() & b.notna()
    s = s[ok]
    b = b[ok]
    if len(s) == 0:
        return []
    step = max(1, len(s) // max_points)
    out: list[dict[str, Any]] = []
    for i in range(0, len(s), step):
        ts = s.index[i]
        t = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        vs = _json_float(s.iloc[i])
        vb = _json_float(b.iloc[i])
        if vs is None or vb is None:
            continue
        out.append({"t": t, "strategy": vs, "benchmark": vb})
    li = len(s) - 1
    last_ts = s.index[li]
    last_t = last_ts.isoformat() if hasattr(last_ts, "isoformat") else str(last_ts)
    if out and out[-1]["t"] != last_t:
        vs = _json_float(s.iloc[li])
        vb = _json_float(b.iloc[li])
        if vs is not None and vb is not None:
            out.append({"t": last_t, "strategy": vs, "benchmark": vb})
    return out


def _risk_metrics_dict(
    pf: Any,
    equity: pd.Series | None,
    trades_fallback: int | None = None,
) -> dict[str, Any]:
    """Headline risk/return metrics (mirrors API `metrics` shape)."""
    all_stats = _stats_to_dict(pf)
    headline: dict[str, Any] = {
        "totalReturnPct": all_stats.get("Total Return [%]"),
        "sharpeRatio": all_stats.get("Sharpe Ratio"),
        "sortinoRatio": all_stats.get("Sortino Ratio"),
        "calmarRatio": all_stats.get("Calmar Ratio"),
        "maxDrawdownPct": all_stats.get("Max Drawdown [%]"),
    }
    derived = _metrics_from_equity_slice(equity) if equity is not None else {}
    for key in list(headline.keys()):
        if headline.get(key) is None and derived.get(key) is not None:
            headline[key] = derived[key]
    win_rate = all_stats.get("Win Rate [%]")
    total_trades = all_stats.get("Total Trades")
    if total_trades is None and trades_fallback is not None:
        total_trades = trades_fallback
    return {
        "totalReturnPct": _json_float(headline.get("totalReturnPct")),
        "sharpeRatio": _json_float(headline.get("sharpeRatio")),
        "sortinoRatio": _json_float(headline.get("sortinoRatio")),
        "calmarRatio": _json_float(headline.get("calmarRatio")),
        "maxDrawdownPct": _json_float(headline.get("maxDrawdownPct")),
        "winRatePct": _json_float(win_rate) if win_rate is not None else None,
        "totalTrades": int(float(total_trades)) if total_trades is not None else None,
    }


def _equity_series(pf: Any) -> pd.Series | None:
    equity = _pf_get(pf, "value")
    if equity is None:
        equity = _pf_get(pf, "portfolio_value")
    if equity is None:
        return None
    if isinstance(equity, pd.DataFrame):
        equity = equity.iloc[:, 0]
    if not isinstance(equity, pd.Series):
        return None
    return equity


def _metrics_from_equity_slice(equity: pd.Series, periods_per_year: float = 252.0) -> dict[str, Any]:
    """Sharpe, Sortino, Calmar, max DD from an equity curve slice (causal, no lookahead)."""
    eq = equity.dropna()
    if len(eq) < 5:
        return {}
    rets = eq.pct_change().dropna()
    if len(rets) < 3:
        return {}
    mu = float(rets.mean())
    sig = float(rets.std())
    sharpe = (mu / sig * math.sqrt(periods_per_year)) if sig > 1e-12 else None

    downside = rets[rets < 0]
    dstd = float(downside.std()) if len(downside) > 0 else 0.0
    sortino = (mu / dstd * math.sqrt(periods_per_year)) if dstd > 1e-12 else None

    cummax = eq.cummax()
    dd = (eq / cummax - 1.0).min()
    max_dd_pct = float(dd * 100) if not math.isnan(dd) else None

    total_ret_pct = float((eq.iloc[-1] / eq.iloc[0] - 1.0) * 100) if eq.iloc[0] != 0 else None

    # Calmar: annualized return / |max drawdown| (use simple period annualization)
    years = len(eq) / periods_per_year
    ann_ret = ((eq.iloc[-1] / eq.iloc[0]) ** (1.0 / years) - 1.0) * 100 if years > 0 and eq.iloc[0] > 0 else None
    calmar = None
    if ann_ret is not None and max_dd_pct is not None and max_dd_pct < -1e-6:
        calmar = ann_ret / abs(max_dd_pct)

    return {
        "totalReturnPct": _json_float(total_ret_pct),
        "sharpeRatio": _json_float(sharpe),
        "sortinoRatio": _json_float(sortino),
        "calmarRatio": _json_float(calmar),
        "maxDrawdownPct": _json_float(max_dd_pct),
    }


def _sma_cross_portfolio(
    vbt: Any,
    close: pd.Series,
    fast: int,
    slow: int,
    init_cash: float,
    fees: float,
) -> Any:
    if fast >= slow:
        raise ValueError("fast window must be < slow window")
    fast_ma = vbt.MA.run(close, fast)
    slow_ma = vbt.MA.run(close, slow)
    entries = fast_ma.ma_crossed_above(slow_ma)
    exits = fast_ma.ma_crossed_below(slow_ma)
    return vbt.Portfolio.from_signals(close, entries, exits, init_cash=init_cash, fees=fees, freq="1D")


def _yf_series(data: Any, name: str) -> pd.Series | None:
    """vectorbt YFData may return a DataFrame (e.g. MultiIndex columns for one ticker)."""
    if data is None:
        return None
    raw = data.get(name) if hasattr(data, "get") else None
    if raw is None:
        return None
    if isinstance(raw, pd.DataFrame):
        if raw.shape[1] == 0:
            return None
        return raw.iloc[:, 0]
    return raw if isinstance(raw, pd.Series) else None


def _download_close(vbt: Any, symbol: str, start: str | None, end: str | None) -> pd.Series:
    data = vbt.YFData.download(symbol, start=start, end=end)
    close = _yf_series(data, "Close")
    if close is None or (hasattr(close, "empty") and close.empty):
        raise ValueError(f"No price data for {symbol!r}")
    return close


def _download_ohlcv(vbt: Any, symbol: str, start: str | None, end: str | None) -> pd.DataFrame:
    data = vbt.YFData.download(symbol, start=start, end=end)
    close = _yf_series(data, "Close")
    high = _yf_series(data, "High")
    low = _yf_series(data, "Low")
    vol = _yf_series(data, "Volume")
    if close is None or close.empty:
        raise ValueError(f"No price data for {symbol!r}")
    h = high if high is not None else close
    l = low if low is not None else close
    v = vol if vol is not None else pd.Series(1.0, index=close.index)
    df = pd.DataFrame({"high": h, "low": l, "close": close, "volume": v.astype(float)})
    return df.dropna(subset=["close"])


def _interval_to_freq(interval: str) -> str:
    s = str(interval).strip().lower()
    if s.endswith("m"):
        return f"{int(s[:-1])}min"
    if s.endswith("h"):
        return f"{int(s[:-1])}H"
    if s.endswith("d"):
        return f"{int(s[:-1])}D"
    return "1D"


def _download_intraday_ohlcv(
    vbt: Any,
    symbol: str,
    start: str | None,
    end: str | None,
    interval: str = "5m",
) -> pd.DataFrame:
    """Intraday OHLCV from FMP stable API (preferred over Yahoo/yfinance)."""
    sym = str(symbol).strip().upper()
    iv = str(interval).strip().lower()
    if iv != "5m":
        raise ValueError("Only interval=5m is supported for opening range backtests right now.")

    api_key = os.environ.get("FMP_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Missing FMP_API_KEY for intraday backtests.")

    params = {"symbol": sym, "apikey": api_key}
    url = f"https://financialmodelingprep.com/stable/historical-chart/5min?{urlencode(params)}"
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "investaiv1-backtest"})
    with urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")

    try:
        import json

        data = json.loads(raw) if raw else None
    except Exception:
        data = None

    arr = data if isinstance(data, list) else []
    if not arr:
        raise ValueError(f"No intraday rows from FMP for {sym!r}")

    rows = []
    for r in arr:
        ts = r.get("date") or r.get("datetime") or r.get("time")
        if not ts:
            continue
        rows.append(
            {
                "ts": ts,
                "open": r.get("open"),
                "high": r.get("high"),
                "low": r.get("low"),
                "close": r.get("close"),
                "volume": r.get("volume") or 0,
            }
        )
    if not rows:
        raise ValueError(f"No usable intraday rows from FMP for {sym!r}")

    df = pd.DataFrame(rows)
    # FMP timestamps are typically exchange-local strings without timezone.
    # Interpret them as America/New_York and convert to UTC for consistent downstream handling.
    ts = pd.to_datetime(df["ts"], errors="coerce")
    ts = ts.dt.tz_localize("America/New_York", nonexistent="shift_forward", ambiguous="NaT").dt.tz_convert("UTC")
    df["ts"] = ts
    df = df.dropna(subset=["ts"]).sort_values("ts").set_index("ts")

    for col in ("open", "high", "low", "close"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0.0)
    df = df.dropna(subset=["close"])

    # Validate coverage: do not silently truncate multi-year requests to “whatever intraday is available”.
    # If the provider cannot serve the requested range, fail with a clear message so UI doesn't mislead.
    req_start_utc = None
    req_end_utc = None
    if start:
        s = pd.Timestamp(start)
        req_start_utc = s.tz_convert("UTC") if getattr(s, "tzinfo", None) is not None else s.tz_localize("UTC")
    if end:
        e = pd.Timestamp(end)
        req_end_utc = e.tz_convert("UTC") if getattr(e, "tzinfo", None) is not None else e.tz_localize("UTC")

    provider_min = df.index.min()
    provider_max = df.index.max()
    if req_start_utc is not None and provider_min is not None and provider_min > (req_start_utc + pd.Timedelta(days=1)):
        raise ValueError(
            f"Intraday 5m data for {sym} is not available back to {start}. "
            f"Earliest returned bar is {provider_min.strftime('%Y-%m-%d')}. "
            "Please choose a more recent date range for Opening Range, or use a daily strategy."
        )

    # Apply range filters after coverage check
    if req_start_utc is not None:
        df = df[df.index >= req_start_utc]
    if req_end_utc is not None:
        # interpret end as inclusive date boundary; include the whole end day
        df = df[df.index < (req_end_utc + pd.Timedelta(days=1))]

    if df.empty:
        raise ValueError(f"No intraday rows from FMP for {sym!r} in the selected range.")

    return df[["open", "high", "low", "close", "volume"]]


def _ny_session_date_index(idx: pd.DatetimeIndex) -> pd.Index:
    """Return YYYY-MM-DD session date (America/New_York) for each timestamp."""
    ts = idx
    try:
        ts = ts.tz_convert("America/New_York") if ts.tz is not None else ts.tz_localize("UTC").tz_convert("America/New_York")
    except Exception:
        # fallback: treat as naive, already NY-like
        ts = idx
    return pd.Index(ts.date, name="session_date")


def run_opening_range_hl(
    vbt: Any,
    symbol: str,
    start: str | None,
    end: str | None,
    init_cash: float = 100_000.0,
    fees: float = 0.0005,
    interval: str = "5m",
    opening_minutes: int = 30,
    buffer_bps: float = 0.0,
    force_flat_eod: bool = True,
) -> tuple[Any, pd.Series]:
    """
    Opening Range High/Low breakout (intraday).

    - Compute each session's opening range high/low from the first `opening_minutes`.
    - Go long on breakout above OR-high (plus optional `buffer_bps`).
    - Exit on breakdown below OR-low (minus optional `buffer_bps`) or end-of-day (if `force_flat_eod`).

    Notes:
    - Uses only intraday bars available from Yahoo for the selected range.
    """
    if opening_minutes < 5 or opening_minutes > 180:
        raise ValueError("opening_minutes must be between 5 and 180")
    if buffer_bps < 0 or buffer_bps > 200:
        raise ValueError("buffer_bps must be between 0 and 200")

    df = _download_intraday_ohlcv(vbt, symbol, start, end, interval=interval)
    freq = _interval_to_freq(interval)
    close, entries, exits = _orhl_signals(
        df,
        interval=interval,
        opening_minutes=opening_minutes,
        buffer_bps=buffer_bps,
        force_flat_eod=force_flat_eod,
    )
    pf = vbt.Portfolio.from_signals(close, entries, exits, init_cash=init_cash, fees=fees, freq=freq)
    return pf, close


def _orhl_signals(
    df: pd.DataFrame,
    interval: str,
    opening_minutes: int,
    buffer_bps: float,
    force_flat_eod: bool,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    # Restrict to regular US session (09:30–16:00 America/New_York) to avoid premarket bias.
    dny = df.copy()
    try:
        idx_ny = dny.index.tz_convert("America/New_York") if dny.index.tz is not None else dny.index.tz_localize("UTC").tz_convert("America/New_York")
        t = idx_ny.time
        is_rth = (t >= pd.Timestamp("09:30").time()) & (t <= pd.Timestamp("16:00").time())
        dny = dny.loc[is_rth]
    except Exception:
        # If timezone conversion fails, proceed without session filtering.
        pass

    close = dny["close"].astype(float)
    high = dny["high"].astype(float)
    low = dny["low"].astype(float)
    opening_step_min = int(str(interval).lower().replace("m", "") or "5")
    opening_bars = max(1, int(round(opening_minutes / max(1, opening_step_min))))

    sess = _ny_session_date_index(close.index)
    if len(pd.unique(sess)) > 70:
        raise ValueError(
            "Opening range backtests require intraday data. Please use a shorter date range (≈ 2–3 months)."
        )

    pos_in_sess = pd.Series(np.arange(len(close)), index=close.index).groupby(sess).cumcount()
    in_opening = pos_in_sess < opening_bars

    per_sess_high = high.where(in_opening).groupby(sess).max()
    per_sess_low = low.where(in_opening).groupby(sess).min()
    or_high_s = pd.Series(per_sess_high.reindex(sess).to_numpy(), index=close.index).ffill()
    or_low_s = pd.Series(per_sess_low.reindex(sess).to_numpy(), index=close.index).ffill()

    after_opening = pos_in_sess >= opening_bars

    buf = float(buffer_bps) / 10_000.0
    up_level = or_high_s * (1.0 + buf)
    dn_level = or_low_s * (1.0 - buf)

    prev_h = high.shift(1)
    prev_l = low.shift(1)
    prev_up = up_level.shift(1)
    prev_dn = dn_level.shift(1)

    # Use high/low to detect intrabar breaks more realistically than close-only.
    entries = after_opening & (high > up_level) & (prev_h <= prev_up)
    breakdown_dn = after_opening & (low < dn_level) & (prev_l >= prev_dn)

    if force_flat_eod:
        last_bar = pos_in_sess.groupby(sess).transform("max") == pos_in_sess
        exits = breakdown_dn | last_bar
    else:
        exits = breakdown_dn

    return close, entries, exits


def _total_return_pct_from_pf(pf: Any) -> float | None:
    eq = _equity_series(pf)
    if eq is None or len(eq) < 2:
        return None
    try:
        a = float(eq.iloc[0])
        b = float(eq.iloc[-1])
    except Exception:
        return None
    if a == 0:
        return None
    return (b / a - 1.0) * 100.0


def _compute_cumulative_vwap(df: pd.DataFrame) -> pd.Series:
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    c = df["close"].astype(float)
    v = df["volume"].astype(float).fillna(0.0).clip(lower=0.0)
    v = v.replace(0.0, 1.0)
    tp = (h + l + c) / 3.0
    return (tp * v).cumsum() / v.cumsum()


def _rolling_vwap(df: pd.DataFrame, window: int) -> pd.Series:
    """Rolling daily VWAP: Σ(typical×vol) / Σ(vol) over `window` sessions."""
    if window <= 1:
        return _compute_cumulative_vwap(df)
    h = df["high"].astype(float)
    l = df["low"].astype(float)
    c = df["close"].astype(float)
    v = df["volume"].astype(float).fillna(0.0).clip(lower=0.0)
    v = v.replace(0.0, 1.0)
    tp = (h + l + c) / 3.0
    w = int(window)
    min_p = max(3, min(w // 3, w - 1))
    num = (tp * v).rolling(w, min_periods=min_p).sum()
    den = v.rolling(w, min_periods=min_p).sum()
    return (num / den).ffill()


def run_vwap_trend(
    vbt: Any,
    symbol: str,
    start: str | None,
    end: str | None,
    init_cash: float = 100_000.0,
    fees: float = 0.0005,
    trend_sma: int = 0,
    roll_window: int = 20,
) -> tuple[Any, pd.Series]:
    """
    Regime long when close is above cumulative VWAP OR rolling VWAP (re-enters after exits).
    Optional trend SMA (set >0) further requires close above SMA when SMA is defined.
    Fixes the prior bug: entries required a VWAP *cross* up, so after an SMA exit while still
    above VWAP the strategy never re-entered.
    """
    df = _download_ohlcv(vbt, symbol, start, end)
    close = df["close"].astype(float)
    vwap_c = _compute_cumulative_vwap(df)
    vwap_r = _rolling_vwap(df, roll_window)
    long_zone = (close > vwap_c) | (close > vwap_r)
    if trend_sma and trend_sma > 0:
        tw = int(trend_sma)
        min_p = max(5, min(tw, max(1, len(close) // 3)))
        sma = close.rolling(tw, min_periods=min_p).mean()
        long_zone = long_zone & (sma.isna() | (close > sma.astype(float)))
    lz = long_zone.fillna(False).to_numpy(dtype=bool, na_value=False)
    prev = np.empty_like(lz, dtype=bool)
    prev[0] = False
    if len(lz) > 1:
        prev[1:] = lz[:-1]
    en = lz & ~prev
    ex = ~lz & prev
    entries = pd.Series(en, index=close.index)
    exits = pd.Series(ex, index=close.index)
    pf = vbt.Portfolio.from_signals(
        close,
        entries,
        exits,
        init_cash=init_cash,
        fees=fees,
        freq="1D",
    )
    return pf, close


def run_sma_cross(
    vbt: Any,
    symbol: str,
    start: str | None,
    end: str | None,
    fast: int = 20,
    slow: int = 50,
    init_cash: float = 100_000.0,
    fees: float = 0.0005,
) -> tuple[Any, pd.Series]:
    close = _download_close(vbt, symbol, start, end)
    pf = _sma_cross_portfolio(vbt, close, fast, slow, init_cash, fees)
    return pf, close


def _normalize_trade_date(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or pd.isna(v)):
        return None
    try:
        ts = pd.Timestamp(v)
    except Exception:
        return None
    if pd.isna(ts):
        return None
    return ts.strftime("%Y-%m-%d")


def _date_from_bar_index(idx_val: Any, close: pd.Series) -> str | None:
    if close is None or len(close.index) == 0:
        return None
    try:
        ii = int(np.asarray(idx_val).item())
    except (TypeError, ValueError):
        return None
    if ii < 0 or ii >= len(close.index):
        return None
    return _normalize_trade_date(close.index[ii])


def _pick_trade_column(df: pd.DataFrame, side: str) -> str | None:
    """Resolve timestamp column for entry or exit (vectorbt OSS vs Pro naming)."""
    key = "entry" if side == "entry" else "exit"
    exact = [
        f"{key.title()} Timestamp",
        f"{key.title()} Time",
        f"{key}_timestamp",
        f"{key}_time",
    ]
    cols = list(df.columns)
    for want in exact:
        for c in cols:
            if str(c) == want or str(c).lower() == want.lower():
                return str(c)
    for c in cols:
        cl = str(c).lower().replace(" ", "_")
        if key not in cl:
            continue
        if any(
            x in cl
            for x in (
                "timestamp",
                "time",
                "date",
                "stamp",
                "datetime",
            )
        ):
            return str(c)
    return None


def _pick_bar_index_column(df: pd.DataFrame, side: str) -> str | None:
    key = "entry" if side == "entry" else "exit"
    for c in df.columns:
        cl = str(c).lower().replace(" ", "_")
        if cl in (f"{key}_index", f"{key}_idx", f"{key}index"):
            return str(c)
    return None


def _extract_trades(pf: Any, close: pd.Series | None = None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    try:
        tr = getattr(pf, "trades", None)
        if tr is None:
            return out
        rec = getattr(tr, "records_readable", None)
        if rec is None and callable(getattr(tr, "readable", None)):
            rec = tr.readable()
        if rec is None or (hasattr(rec, "empty") and rec.empty):
            return out
        df = rec if isinstance(rec, pd.DataFrame) else pd.DataFrame(rec)
        entry_ts_col = _pick_trade_column(df, "entry")
        exit_ts_col = _pick_trade_column(df, "exit")
        entry_idx_col = _pick_bar_index_column(df, "entry")
        exit_idx_col = _pick_bar_index_column(df, "exit")
        entry_px_col = next(
            (c for c in df.columns if "entry" in c.lower() and "price" in c.lower()),
            None,
        )
        exit_px_col = next(
            (c for c in df.columns if "exit" in c.lower() and "price" in c.lower()),
            None,
        )
        pnl_col = "PnL" if "PnL" in df.columns else next((c for c in df.columns if "pnl" in str(c).lower()), None)
        ret_col = next((c for c in df.columns if c == "Return" or "return" in c.lower()), None)

        for i, row in df.iterrows():
            entry_ts = row.get(entry_ts_col) if entry_ts_col else None
            exit_ts = row.get(exit_ts_col) if exit_ts_col else None
            entry_date = _normalize_trade_date(entry_ts)
            exit_date = _normalize_trade_date(exit_ts)
            if entry_date is None and entry_idx_col is not None:
                entry_date = _date_from_bar_index(row.get(entry_idx_col), close)
            if exit_date is None and exit_idx_col is not None:
                exit_date = _date_from_bar_index(row.get(exit_idx_col), close)
            pnl = row.get(pnl_col) if pnl_col else None
            ret = row.get(ret_col) if ret_col else None
            if hasattr(pnl, "item"):
                pnl = float(pnl.item())
            if hasattr(ret, "item"):
                ret = float(ret.item())
            if ret is not None and abs(float(ret)) <= 1.0:
                ret = float(ret) * 100.0
            out.append(
                {
                    "tradeIndex": len(out) + 1,
                    "entryDate": entry_date,
                    "exitDate": exit_date,
                    "entryPrice": _json_float(row.get(entry_px_col)) if entry_px_col else None,
                    "exitPrice": _json_float(row.get(exit_px_col)) if exit_px_col else None,
                    "pnl": _json_float(pnl),
                    "returnPct": _json_float(ret) if ret is not None else None,
                }
            )
    except Exception:
        return out
    return out


STRATEGY_REGISTRY = {
    "sma_cross": {
        "label": "SMA crossover",
        "description": "Long when fast SMA crosses above slow; exit on cross below.",
        "run": run_sma_cross,
    },
    "vwap_trend": {
        "label": "VWAP trend",
        "description": "Long while close is above cumulative VWAP or rolling VWAP (daily typical×volume). Re-enters after dips. Optional trend SMA (0=off) tightens entries.",
        "run": run_vwap_trend,
    },
    "opening_range_hl": {
        "label": "Opening range high/low",
        "description": "Intraday OR breakout: long on break above the first N minutes’ high; exit on break below the first N minutes’ low or end-of-day (default).",
        "run": run_opening_range_hl,
    },
}


def list_strategies() -> list[dict[str, Any]]:
    return [
        {"id": k, "label": v["label"], "description": v["description"]}
        for k, v in STRATEGY_REGISTRY.items()
    ]


def run_backtest(
    strategy_id: str,
    symbol: str,
    start: str | None,
    end: str | None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    params = params or {}
    if strategy_id not in STRATEGY_REGISTRY:
        raise ValueError(f"Unknown strategy {strategy_id!r}")

    vbt, engine_name = load_vectorbt()
    init_cash = float(params.get("initCash") or 100_000.0)
    fees = float(params.get("fees") or 0.0005)

    methodology: dict[str, Any] = {
        "reportingNote": (
            "Indicators use only past bars up to each date (standard close-based backtest). "
            "A buy & hold benchmark (long from the first bar, same initial cash and fee schedule) "
            "is always computed on the same price series for charts and risk metrics."
        ),
    }

    fast = int(params.get("fastWindow") or params.get("fast") or 20)
    slow = int(params.get("slowWindow") or params.get("slow") or 50)
    params_used: dict[str, Any] = {
        "fees": fees,
        "initCash": init_cash,
    }
    freq_used = "1D"

    if strategy_id == "sma_cross":
        close = _download_close(vbt, symbol, start, end)
        pf = _sma_cross_portfolio(vbt, close, fast, slow, init_cash, fees)
        params_used["fastWindow"] = fast
        params_used["slowWindow"] = slow
    elif strategy_id == "vwap_trend":
        trend_sma = int(params.get("trendSma") if params.get("trendSma") is not None else params.get("trend_sma") or 0)
        roll_window = int(params.get("rollWindow") or params.get("roll_window") or 20)
        roll_window = max(5, min(252, roll_window))
        methodology["reportingNote"] = (
            "Long when close exceeds cumulative session VWAP from the window start OR a rolling VWAP "
            f"({roll_window}d); flat otherwise. Signals use regime edges (enter when the rule turns true, exit when false). "
            "Optional trend SMA>0 additionally requires close above that SMA once it is defined. "
            "Buy & hold benchmark: same window and Yahoo closes, long from the first bar, same cash and fees."
        )
        pf, close = run_vwap_trend(
            vbt,
            symbol,
            start,
            end,
            init_cash,
            fees,
            trend_sma=trend_sma,
            roll_window=roll_window,
        )
        params_used["trendSma"] = trend_sma
        params_used["rollWindow"] = roll_window
    elif strategy_id == "opening_range_hl":
        interval = str(params.get("interval") or "5m")
        freq_used = _interval_to_freq(interval)
        optimize = bool(params.get("optimize") if params.get("optimize") is not None else True)
        opening_minutes = int(params.get("openingMinutes") or params.get("opening_minutes") or 30)
        buffer_bps = float(params.get("bufferBps") or params.get("buffer_bps") or 0.0)
        force_flat_eod = bool(params.get("forceFlatEod") if params.get("forceFlatEod") is not None else True)
        methodology["reportingNote"] = (
            "Opening Range High/Low (intraday): compute opening range from the first N minutes of each NY session; "
            "enter long on breakout above OR-high (optionally buffered), exit on breakdown below OR-low or end-of-day. "
            "Uses Yahoo intraday bars (interval-limited by provider). Buy & hold benchmark: same intraday close series, "
            "same cash and fees. "
            + ("Parameters are optimized in-window for total return (not out-of-sample)." if optimize else "Parameters are fixed (no optimization).")
        )
        # Download once (intraday-limited); reuse for grid search without leaking future bars.
        df_or = _download_intraday_ohlcv(vbt, symbol, start, end, interval=interval)
        close_or = df_or["close"].astype(float)
        pf_bh_or = vbt.Portfolio.from_signals(
            close_or,
            True,
            False,
            init_cash=init_cash,
            fees=fees,
            freq=freq_used,
        )
        bh_ret = _total_return_pct_from_pf(pf_bh_or)

        if optimize:
            grid_open = [15, 30, 45, 60]
            grid_buf = [0.0, 5.0, 10.0]
            best_excess = None
            best_pf = None
            for om in grid_open:
                for bb in grid_buf:
                    try:
                        close_sig, en, ex = _orhl_signals(
                            df_or,
                            interval=interval,
                            opening_minutes=om,
                            buffer_bps=bb,
                            force_flat_eod=force_flat_eod,
                        )
                        pf_try = vbt.Portfolio.from_signals(
                            close_sig,
                            en,
                            ex,
                            init_cash=init_cash,
                            fees=fees,
                            freq=freq_used,
                        )
                        tr = _total_return_pct_from_pf(pf_try)
                        if tr is None or bh_ret is None:
                            continue
                        excess = tr - bh_ret
                        if best_excess is None or excess > best_excess:
                            best_excess = excess
                            best_pf = pf_try
                            opening_minutes = om
                            buffer_bps = bb
                    except Exception:
                        continue
            if best_pf is None:
                raise ValueError("Could not optimize opening range parameters (no viable intraday runs).")
            pf, close = best_pf, close_or
        else:
            close_sig, en, ex = _orhl_signals(
                df_or,
                interval=interval,
                opening_minutes=opening_minutes,
                buffer_bps=buffer_bps,
                force_flat_eod=force_flat_eod,
            )
            pf = vbt.Portfolio.from_signals(
                close_sig,
                en,
                ex,
                init_cash=init_cash,
                fees=fees,
                freq=freq_used,
            )
            close = close_or
        params_used["interval"] = interval
        params_used["openingMinutes"] = opening_minutes
        params_used["bufferBps"] = buffer_bps
        params_used["forceFlatEod"] = force_flat_eod
        params_used["optimize"] = optimize
    else:
        raise ValueError(f"Unhandled strategy {strategy_id!r}")

    equity_full = _equity_series(pf)
    if equity_full is None:
        raise ValueError("Could not read portfolio equity")

    all_stats = _stats_to_dict(pf)
    trades = _extract_trades(pf, close)
    total_trades_fb = len(trades) if trades else None
    metrics = _risk_metrics_dict(pf, equity_full, trades_fallback=total_trades_fb)

    pf_bh = vbt.Portfolio.from_signals(
        close,
        True,
        False,
        init_cash=init_cash,
        fees=fees,
        freq=freq_used,
    )
    equity_bh = _equity_series(pf_bh)
    equity_compare = (
        _downsample_compare_equity(equity_full, equity_bh)
        if equity_bh is not None
        else []
    )
    equity_chart = (
        [{"t": r["t"], "v": r["strategy"]} for r in equity_compare]
        if equity_compare
        else _downsample_equity(equity_full)
    )
    metrics_bh = _risk_metrics_dict(pf_bh, equity_bh, trades_fallback=1)

    return {
        "symbol": symbol.upper().strip(),
        "strategyId": strategy_id,
        "engine": engine_name,
        "start": str(close.index.min())[:10] if len(close.index) else start,
        "end": str(close.index.max())[:10] if len(close.index) else end,
        "paramsUsed": params_used,
        "methodology": methodology,
        "metrics": metrics,
        "allStats": all_stats,
        "equity": equity_chart,
        "equityCompare": equity_compare,
        "benchmark": {
            "label": "Buy & hold",
            "metrics": metrics_bh,
        },
        "trades": trades,
        "tradesForReportedPeriod": trades,
        "rawStats": {k: v for k, v in all_stats.items() if v is not None},
    }
