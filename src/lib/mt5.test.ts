import { describe, expect, it } from "vitest";
import { assertDemo, buildSnapshot, Mt5NotDemoError, positionSide, safeEqual, type Mt5AccountInfo } from "./mt5";

const account: Mt5AccountInfo = {
  platform: "mt5", broker: "Demo Broker", currency: "USD", server: "Demo-Server", balance: 10000, equity: 10012.5,
  margin: 100, freeMargin: 9912.5, leverage: 100, name: "Test", login: 123, type: "ACCOUNT_TRADE_MODE_DEMO",
};

describe("assertDemo", () => {
  it("accepts demo accounts", () => expect(() => assertDemo(account)).not.toThrow());
  it("refuses real, contest and unknown accounts", () => {
    for (const type of ["ACCOUNT_TRADE_MODE_REAL", "ACCOUNT_TRADE_MODE_CONTEST", "", undefined]) {
      expect(() => assertDemo({ type: type as string })).toThrow(Mt5NotDemoError);
    }
  });
});

describe("buildSnapshot", () => {
  it("sums profit across positions (swap is already included)", () => {
    const s = buildSnapshot(account, [
      { id: "1", symbol: "EURUSD", type: "POSITION_TYPE_BUY", volume: 0.01, openPrice: 1.1, profit: 5.15, swap: -0.1 },
      { id: "2", symbol: "XAUUSD", type: "POSITION_TYPE_SELL", volume: 0.01, openPrice: 2000, profit: 7.35 },
    ], new Date("2026-11-11T00:00:00Z"));
    expect(s.totalProfit).toBe(12.5);
    expect(s.fetchedAt).toBe("2026-11-11T00:00:00.000Z");
  });
  it("refuses a real account", () => {
    expect(() => buildSnapshot({ ...account, type: "ACCOUNT_TRADE_MODE_REAL" }, [])).toThrow(Mt5NotDemoError);
  });
});

describe("helpers", () => {
  it("maps position side", () => {
    expect(positionSide("POSITION_TYPE_SELL")).toBe("SELL");
    expect(positionSide("POSITION_TYPE_BUY")).toBe("BUY");
  });
  it("compares keys", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
