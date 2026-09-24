#!/usr/bin/env python3
"""
Yahoo Finance fetcher for the Invest app's data pipeline.

Uses yfinance (which impersonates a browser through curl_cffi; plain HTTP
clients are rate-limited by Yahoo from cloud runners). Reads the symbol list
written by `node update-data.mjs --list-symbols`, and writes one JSON file the
Node script merges into invest/data/*.js:

  {"history": bool, "quotes": {id: {...}}, "intraday": {id: {...}},
   "hist": {id: {"w","y","f","m"}}, "profiles": {id: {...}}, "errors": [...]}

Usage: python fetch_yahoo.py symbols.json out.json
"""
import json
import math
import sys
import time
import concurrent.futures as cf
from datetime import datetime, timezone

import yfinance as yf

WORKERS = 6


def num(x, p=7):
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(f):
        return None
    return float(f"{f:.{p}g}")


def intval(x):
    f = num(x, 15)
    return int(round(f)) if f is not None else None


def clean(d):
    return {k: v for k, v in d.items() if v is not None and v != "" and v != [] and v != {}}


def retry(fn, tries=3, wait=2.0):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - network errors come in many types
            last = e
            time.sleep(wait * (i + 1))
    raise last


def closes(df):
    """[(unix_seconds, close)] from a yfinance history frame."""
    if df is None or df.empty or "Close" not in df:
        return []
    out = []
    for ts, v in df["Close"].items():
        f = num(v, 6)
        if f is None:
            continue
        out.append((int(ts.timestamp()), f))
    return out


def build_quote(info, fast):
    p = num(info.get("regularMarketPrice") or info.get("currentPrice") or (fast or {}).get("last_price"))
    pc = num(info.get("regularMarketPreviousClose") or info.get("previousClose") or (fast or {}).get("previous_close"))
    ch = num(info.get("regularMarketChange"), 6)
    chp = num(info.get("regularMarketChangePercent"), 5)
    if ch is None and p is not None and pc:
        ch = num(p - pc, 6)
    if chp is None and p is not None and pc:
        chp = num((p - pc) / pc * 100, 5)
    dr = num(info.get("dividendRate") or info.get("trailingAnnualDividendRate"), 5)
    dy = None
    if dr and p:
        dy = num(dr / p * 100, 4)
    elif info.get("yield"):
        dy = num(float(info["yield"]) * 100, 4)
    er = info.get("netExpenseRatio")
    if er is None and info.get("annualReportExpenseRatio") is not None:
        er = float(info["annualReportExpenseRatio"]) * 100
    return clean({
        "p": p, "ch": ch, "chp": chp, "pc": pc,
        "o": num(info.get("regularMarketOpen") or info.get("open")),
        "h": num(info.get("regularMarketDayHigh") or info.get("dayHigh")),
        "l": num(info.get("regularMarketDayLow") or info.get("dayLow")),
        "v": intval(info.get("regularMarketVolume") or info.get("volume")),
        "av": intval(info.get("averageDailyVolume3Month") or info.get("averageVolume")),
        "mc": intval(info.get("marketCap")),
        "h52": num(info.get("fiftyTwoWeekHigh")), "l52": num(info.get("fiftyTwoWeekLow")),
        "pe": num(info.get("trailingPE"), 5), "fpe": num(info.get("forwardPE"), 5),
        "eps": num(info.get("epsTrailingTwelveMonths") or info.get("trailingEps"), 5),
        "feps": num(info.get("epsForward") or info.get("forwardEps"), 5),
        "dy": dy, "dr": dr,
        "so": intval(info.get("sharesOutstanding")), "pb": num(info.get("priceToBook"), 5),
        "ma50": num(info.get("fiftyDayAverage")), "ma200": num(info.get("twoHundredDayAverage")),
        "na": intval(info.get("totalAssets") or info.get("netAssets")),
        "er": num(er, 4),
        "ms": info.get("marketState"), "t": intval(info.get("regularMarketTime")),
        "pp": num(info.get("postMarketPrice")), "ppc": num(info.get("postMarketChangePercent"), 5), "ppt": intval(info.get("postMarketTime")),
        "pre": num(info.get("preMarketPrice")), "prec": num(info.get("preMarketChangePercent"), 5),
        "cur": info.get("currency"), "ex": info.get("fullExchangeName") or info.get("exchange"), "xc": info.get("exchange"),
        "qt": info.get("quoteType"), "name": info.get("longName") or info.get("shortName"),
        "earn": intval(info.get("earningsTimestampStart") or info.get("earningsTimestamp")),
        "src": "yahoo",
    })


def build_profile(info, tk):
    officers = info.get("companyOfficers") or []
    ceo = next((o for o in officers if any(s in (o.get("title") or "").lower() for s in ("chief executive", "ceo"))), None)
    summary = (info.get("longBusinessSummary") or "").strip()
    if len(summary) > 1400:
        cut = summary.rfind(". ", 0, 1400)
        summary = summary[: cut + 1] if cut > 0 else summary[:1400]
    yld = info.get("yield")
    er = info.get("netExpenseRatio")
    if er is None and info.get("annualReportExpenseRatio") is not None:
        er = float(info["annualReportExpenseRatio"]) * 100
    prof = {
        "sum": summary, "sec": info.get("sector"), "ind": info.get("industry"), "emp": intval(info.get("fullTimeEmployees")),
        "web": info.get("website"), "city": info.get("city"), "st": info.get("state"), "cty": info.get("country"),
        "ceo": ceo.get("name") if ceo else None, "ceot": ceo.get("title") if ceo else None,
        "beta": num(info.get("beta") or info.get("beta3Year"), 4),
        "rec": info.get("recommendationKey") if info.get("recommendationKey") not in (None, "none") else None,
        "recm": num(info.get("recommendationMean"), 3),
        "rev": intval(info.get("totalRevenue")), "revg": num(info.get("revenueGrowth"), 4), "eg": num(info.get("earningsGrowth"), 4),
        "gm": num(info.get("grossMargins"), 4), "om": num(info.get("operatingMargins"), 4), "pm": num(info.get("profitMargins"), 4),
        "roe": num(info.get("returnOnEquity"), 4), "cash": intval(info.get("totalCash")), "debt": intval(info.get("totalDebt")),
        "fcf": intval(info.get("freeCashflow")), "ebitda": intval(info.get("ebitda")), "ev": intval(info.get("enterpriseValue")),
        "evr": num(info.get("enterpriseToRevenue"), 4), "eve": num(info.get("enterpriseToEbitda"), 4), "peg": num(info.get("trailingPegRatio"), 4),
        "fl": intval(info.get("floatShares")), "sp": num(info.get("shortPercentOfFloat"), 4),
        "ins": num(info.get("heldPercentInsiders"), 4), "inst": num(info.get("heldPercentInstitutions"), 4),
        "earn": intval(info.get("earningsTimestampStart") or info.get("earningsTimestamp")),
        "exd": intval(info.get("exDividendDate")), "divd": intval(info.get("dividendDate")),
        "er": num(er, 4), "fam": info.get("fundFamily"), "cat": info.get("category"),
        "inc": intval(info.get("fundInceptionDate")), "aum": intval(info.get("totalAssets")),
        "yld": num(float(yld) * 100, 4) if yld is not None else None,
    }
    tgt = num(info.get("targetMeanPrice"))
    if tgt:
        prof["tgt"] = clean({
            "m": tgt, "h": num(info.get("targetHighPrice")), "l": num(info.get("targetLowPrice")),
            "md": num(info.get("targetMedianPrice")), "n": intval(info.get("numberOfAnalystOpinions")),
        })
    if info.get("quoteType") == "ETF":
        try:
            fd = tk.funds_data
            th = fd.top_holdings
            if th is not None and not th.empty:
                prof["hold"] = [[str(sym), str(row.get("Name", "")), num(row.get("Holding Percent"), 4)] for sym, row in th.head(10).iterrows()]
            sw = fd.sector_weightings or {}
            prof["sw"] = [[k, num(v, 4)] for k, v in sw.items() if v and float(v) > 0]
        except Exception:  # noqa: BLE001 - fund data is optional
            pass
    return clean(prof)


def intraday(tk):
    df = tk.history(period="1d", interval="5m", prepost=False, auto_adjust=False)
    pts = closes(df)
    if len(pts) < 2:
        return None
    md = tk.history_metadata or {}
    reg = ((md.get("currentTradingPeriod") or {}).get("regular") or {})
    first, last = pts[0][0], pts[-1][0]
    s = min(reg.get("start", first), first)
    e = max(reg.get("end", last), last)
    if e - s > 26 * 3600:
        s = max(first, e - 24 * 3600)
    n = 600 if e - s <= 9 * 3600 else 1800
    slots = (last - s) // n + 1
    c = [None] * slots
    for t, v in pts:
        k = round((t - s) / n)
        if 0 <= k < slots:
            c[k] = v
    for k in range(slots):
        if c[k] is None:
            c[k] = c[k - 1] if k else pts[0][1]
    c[-1] = pts[-1][1]
    pc = num(md.get("chartPreviousClose") or md.get("previousClose"))
    return clean({"s": int(s), "e": int(e), "n": n, "pc": pc, "c": [num(v, 6) for v in c]})


def thin(arr, mx):
    if len(arr) <= mx:
        return arr
    step = len(arr) / mx
    out = [arr[int(i * step)] for i in range(mx)]
    out[-1] = arr[-1]
    return out


def history(tk):
    def get(period, interval):
        try:
            return closes(tk.history(period=period, interval=interval, auto_adjust=False))
        except Exception:  # noqa: BLE001
            return []
    w = get("5d", "30m")
    y = get("1y", "1d")
    f = get("5y", "1wk")
    m = get("max", "1mo")
    if not y and not f:
        return None
    return {
        "w": thin([[t // 60, v] for t, v in w], 130),
        "y": [[t // 86400, v] for t, v in y],
        "f": [[t // 86400, v] for t, v in f],
        "m": [[t // 86400, v] for t, v in m],
    }


def work(entry, want_hist, want_prof):
    sid, ysym = entry["id"], entry["y"]
    tk = yf.Ticker(ysym)
    res = {"id": sid}
    try:
        info = retry(lambda: tk.info or {}, tries=2)
    except Exception as e:  # noqa: BLE001
        info = {}
        res["err"] = f"info {type(e).__name__}"
    fast = None
    if not (info.get("regularMarketPrice") or info.get("currentPrice")):
        try:
            fi = tk.fast_info
            fast = {"last_price": fi.last_price, "previous_close": fi.previous_close}
        except Exception:  # noqa: BLE001
            pass
    q = build_quote(info, fast)
    if q.get("p") is not None:
        res["quote"] = q
    try:
        d = retry(lambda: intraday(tk), tries=2)
        if d:
            res["intraday"] = d
    except Exception:  # noqa: BLE001
        pass
    if want_prof and info:
        try:
            res["profile"] = build_profile(info, tk)
        except Exception:  # noqa: BLE001
            pass
    if want_hist:
        try:
            h = history(tk)
            if h:
                res["hist"] = h
        except Exception:  # noqa: BLE001
            pass
    return res


def main():
    cfg = json.load(open(sys.argv[1]))
    want_hist = bool(cfg.get("history"))
    prof_ids = set(cfg.get("profiles") or [])
    started = time.time()
    out = {"history": want_hist, "quotes": {}, "intraday": {}, "hist": {}, "profiles": {}, "errors": [],
           "started": datetime.now(timezone.utc).isoformat()}
    entries = cfg["symbols"]
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(work, e, want_hist, e["id"] in prof_ids): e for e in entries}
        for fut in cf.as_completed(futs):
            e = futs[fut]
            try:
                r = fut.result()
            except Exception as err:  # noqa: BLE001
                out["errors"].append(f"{e['id']}: {type(err).__name__}")
                continue
            sid = r["id"]
            if "quote" in r:
                out["quotes"][sid] = r["quote"]
            else:
                out["errors"].append(f"{sid}: no quote {r.get('err', '')}")
            if "intraday" in r:
                out["intraday"][sid] = r["intraday"]
            if "hist" in r:
                out["hist"][sid] = r["hist"]
            if "profile" in r:
                out["profiles"][sid] = r["profile"]
    out["seconds"] = round(time.time() - started)
    json.dump(out, open(sys.argv[2], "w"))
    print(f"yahoo: quotes {len(out['quotes'])}/{len(entries)}, intraday {len(out['intraday'])}, "
          f"history {len(out['hist'])}, profiles {len(out['profiles'])}, {out['seconds']}s")
    if out["errors"]:
        print("missing:", ", ".join(out["errors"][:40]))


if __name__ == "__main__":
    main()
