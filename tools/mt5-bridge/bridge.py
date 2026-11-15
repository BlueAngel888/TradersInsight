"""Local, read-only bridge from a Windows MT5 terminal to TradersInsight.

Serves the same JSON shapes as the MetaApi endpoints TradersInsight uses, so the
app's /mt5 page and SMC scanner work unchanged with MT5_BRIDGE_URL set.

- Listens on 127.0.0.1 only (not reachable from the network).
- Refuses to start, and refuses every request, unless the logged-in account is DEMO.
- Never sends, modifies or closes orders.

Usage (Windows, MT5 desktop running and logged in to the demo account):
    pip install MetaTrader5
    python bridge.py            # http://127.0.0.1:8765
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

import MetaTrader5 as mt5

HOST, PORT = "127.0.0.1", 8765

TRADE_MODES = {
    mt5.ACCOUNT_TRADE_MODE_DEMO: "ACCOUNT_TRADE_MODE_DEMO",
    mt5.ACCOUNT_TRADE_MODE_CONTEST: "ACCOUNT_TRADE_MODE_CONTEST",
    mt5.ACCOUNT_TRADE_MODE_REAL: "ACCOUNT_TRADE_MODE_REAL",
}

TIMEFRAMES = {
    "1m": mt5.TIMEFRAME_M1, "2m": mt5.TIMEFRAME_M2, "3m": mt5.TIMEFRAME_M3, "4m": mt5.TIMEFRAME_M4,
    "5m": mt5.TIMEFRAME_M5, "6m": mt5.TIMEFRAME_M6, "10m": mt5.TIMEFRAME_M10, "12m": mt5.TIMEFRAME_M12,
    "15m": mt5.TIMEFRAME_M15, "20m": mt5.TIMEFRAME_M20, "30m": mt5.TIMEFRAME_M30,
    "1h": mt5.TIMEFRAME_H1, "2h": mt5.TIMEFRAME_H2, "3h": mt5.TIMEFRAME_H3, "4h": mt5.TIMEFRAME_H4,
    "6h": mt5.TIMEFRAME_H6, "8h": mt5.TIMEFRAME_H8, "12h": mt5.TIMEFRAME_H12,
    "1d": mt5.TIMEFRAME_D1, "1w": mt5.TIMEFRAME_W1, "1mn": mt5.TIMEFRAME_MN1,
}

BASE = r"^/users/current/accounts/[^/]+"
ROUTES = [
    (re.compile(BASE + r"/account-information$"), "account"),
    (re.compile(BASE + r"/positions$"), "positions"),
    (re.compile(BASE + r"/historical-market-data/symbols/([^/]+)/timeframes/([^/]+)/candles$"), "candles"),
]


class NotDemo(Exception):
    pass


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def account_info() -> dict:
    a = mt5.account_info()
    if a is None:
        raise RuntimeError(f"MT5 nu răspunde: {mt5.last_error()}")
    mode = TRADE_MODES.get(a.trade_mode, str(a.trade_mode))
    if mode != "ACCOUNT_TRADE_MODE_DEMO":
        raise NotDemo(f"Contul MT5 nu este demo (tip: {mode}).")
    return {
        "platform": "mt5", "broker": a.company, "currency": a.currency, "server": a.server,
        "balance": a.balance, "equity": a.equity, "margin": a.margin, "freeMargin": a.margin_free,
        "leverage": a.leverage, "marginLevel": a.margin_level, "name": a.name, "login": a.login,
        "type": mode, "tradeAllowed": bool(a.trade_allowed), "credit": a.credit,
    }


def positions() -> list:
    out = []
    for p in mt5.positions_get() or []:
        out.append({
            "id": str(p.ticket), "symbol": p.symbol,
            "type": "POSITION_TYPE_SELL" if p.type == mt5.POSITION_TYPE_SELL else "POSITION_TYPE_BUY",
            "volume": p.volume, "openPrice": p.price_open, "currentPrice": p.price_current,
            "stopLoss": p.sl or None, "takeProfit": p.tp or None,
            # MetaApi's `profit` includes swap; MT5's does not.
            "profit": p.profit + p.swap, "swap": p.swap, "time": iso(p.time),
        })
    return out


def candles(symbol: str, timeframe: str, limit: int) -> list:
    tf = TIMEFRAMES.get(timeframe)
    if tf is None:
        raise ValueError(f"Timeframe necunoscut: {timeframe}")
    if not mt5.symbol_select(symbol, True):
        raise ValueError(f"Simbol indisponibil la broker: {symbol}")
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, max(1, min(limit, 1000)))
    if rates is None:
        raise RuntimeError(f"Nu am primit lumânări pentru {symbol} {timeframe}: {mt5.last_error()}")
    return [
        {
            "symbol": symbol, "timeframe": timeframe, "time": iso(float(r["time"])),
            "open": float(r["open"]), "high": float(r["high"]), "low": float(r["low"]), "close": float(r["close"]),
            "tickVolume": int(r["tick_volume"]), "volume": int(r["real_volume"]), "spread": int(r["spread"]),
        }
        for r in rates
    ]


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        for pattern, name in ROUTES:
            m = pattern.match(url.path)
            if not m:
                continue
            try:
                # Every request re-checks the account: the user could switch accounts in MT5.
                info = account_info()
                if name == "account":
                    return self._send(200, info)
                if name == "positions":
                    return self._send(200, positions())
                limit = int(parse_qs(url.query).get("limit", ["300"])[0])
                return self._send(200, candles(unquote(m.group(1)), m.group(2), limit))
            except NotDemo as e:
                return self._send(403, {"message": str(e)})
            except ValueError as e:
                return self._send(404, {"message": str(e)})
            except Exception as e:  # noqa: BLE001
                return self._send(502, {"message": str(e)})
        self._send(404, {"message": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        self._send(405, {"message": "Bridge-ul este doar pentru citire."})

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[bridge] " + fmt % args + "\n")


def main() -> None:
    if not mt5.initialize():
        sys.exit(f"Nu m-am putut conecta la MT5 ({mt5.last_error()}). Deschide terminalul MT5 și loghează-te în contul demo.")
    try:
        info = account_info()
    except NotDemo as e:
        mt5.shutdown()
        sys.exit(f"{e} Bridge-ul pornește doar pe conturi demo.")
    print(f"Conectat: {info['name']} #{info['login']} @ {info['server']} (DEMO), sold {info['balance']} {info['currency']}")
    print(f"Bridge doar-citire pe http://{HOST}:{PORT}  (Ctrl+C pentru oprire)")
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
