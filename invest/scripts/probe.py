# Temporary: checks whether yfinance (with curl_cffi browser impersonation) works from GitHub Actions.
import time, traceback
import yfinance as yf
print("yfinance", yf.__version__)
def t(name, fn):
    t0 = time.time()
    try:
        r = fn()
        print(f"{name:22} OK {time.time()-t0:.1f}s :: {str(r)[:300]}")
    except Exception as e:
        print(f"{name:22} FAIL {time.time()-t0:.1f}s :: {type(e).__name__}: {str(e)[:300]}")
t("download 5d daily", lambda: yf.download(["AAPL", "^GSPC", "GC=F", "EURUSD=X", "BTC-USD", "^TNX"], period="5d", interval="1d", progress=False, threads=False)["Close"].tail(2).to_dict())
t("intraday 1d 5m", lambda: len(yf.Ticker("NVDA").history(period="1d", interval="5m")))
t("history 1y", lambda: len(yf.Ticker("MSFT").history(period="1y")))
t("history max 1mo", lambda: len(yf.Ticker("^GSPC").history(period="max", interval="1mo")))
t("info", lambda: {k: yf.Ticker("AAPL").info.get(k) for k in ["marketCap", "trailingPE", "longName", "sector", "fullTimeEmployees"]})
t("fast_info", lambda: dict(list(yf.Ticker("VOO").fast_info.items())[:6]))
t("fund top holdings", lambda: yf.Ticker("VOO").funds_data.top_holdings.head(3).to_dict())
t("batch 60 download", lambda: yf.download(" ".join(["AAPL","MSFT","NVDA","GOOGL","AMZN","META","AVGO","TSLA","ORCL","AMD","PLTR","CRM","ADBE","CSCO","IBM","INTC","QCOM","TXN","MU","AMAT","SPCX","CBRS","FRVO","BRK-B","JPM","V","MA","BAC","WFC","GS","LLY","UNH","JNJ","ABBV","MRK","WMT","COST","PG","KO","PEP","XOM","CVX","SPY","VOO","QQQ","GLD","TLT","IBIT","^IXIC","^DJI","^RUT","^VIX","CL=F","SI=F","JPY=X","DX-Y.NYB","2222.SR","005930.KS","MC.PA","0700.HK"]), period="2d", interval="1d", progress=False, threads=True)["Close"].shape)
