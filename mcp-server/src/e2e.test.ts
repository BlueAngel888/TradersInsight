// End to end: OAuth login → MCP initialize → list_accounts → preview_trade → execute_trade,
// with MetaApi replaced by an in-memory fake.
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as mcp from "../app/api/mcp/route";
import * as authorize from "../app/oauth/authorize/route";
import * as register from "../app/oauth/register/route";
import * as token from "../app/oauth/token/route";

const BASE = "https://mcp.example.com";
const sent: Record<string, unknown>[] = [];
const accounts = [
  { _id: "acc-demo", name: "IC Demo", login: "1001", server: "ICMarketsSC-Demo", region: "london", state: "DEPLOYED" },
  { _id: "acc-fn", name: "FundedNext 50k", login: "2002", server: "FundedNext-Server", region: "london", state: "DEPLOYED" },
];

function fakeMetaApi(url: string, init?: RequestInit): Response {
  const j = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (url.includes("/users/current/accounts?")) return j(accounts);
  const id = /accounts\/([^/]+)\//.exec(url)?.[1];
  if (url.endsWith("/account-information"))
    return j({ broker: "B", currency: "USD", server: id === "acc-fn" ? "FundedNext-Server" : "ICMarketsSC-Demo", balance: 10000, equity: 10000, margin: 0, freeMargin: 10000, leverage: 100, name: "F", login: 1, type: "ACCOUNT_TRADE_MODE_DEMO" });
  if (url.endsWith("/positions")) return j([]);
  if (url.endsWith("/orders")) return j([]);
  if (url.endsWith("/specification")) return j({ symbol: "EURUSD", tickSize: 0.00001, minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, digits: 5 });
  if (url.endsWith("/current-price")) return j({ symbol: "EURUSD", bid: 1.1, ask: 1.10002, lossTickValue: 1, profitTickValue: 1 });
  if (url.endsWith("/trade") && init?.method === "POST") {
    sent.push(JSON.parse(String(init.body)));
    return j({ numericCode: 10009, stringCode: "TRADE_RETCODE_DONE", message: "Request completed", orderId: "77", positionId: "77" });
  }
  return new Response("not found " + url, { status: 404 });
}

const realFetch = globalThis.fetch;
beforeAll(() => {
  process.env.METAAPI_TOKEN = "fake-token";
  process.env.MCP_PASSWORD = "correct-horse-battery";
  process.env.PUBLIC_URL = BASE;
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("agiliumtrade")) return fakeMetaApi(url, init);
    return realFetch(input, init);
  });
});
afterAll(() => vi.unstubAllGlobals());

let accessToken = "";
let rpcId = 0;
async function rpc(method: string, params: unknown = {}) {
  const res = await mcp.POST(
    new Request(`${BASE}/api/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { result: any };
}
const callTool = async (name: string, args: unknown) => {
  const r = await rpc("tools/call", { name, arguments: args });
  return { text: r.result.content[0].text as string, isError: !!r.result.isError };
};

describe("end to end", () => {
  it("rejects MCP calls without a token and points to the metadata", async () => {
    const res = await mcp.POST(new Request(`${BASE}/api/mcp`, { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`${BASE}/.well-known/oauth-protected-resource`);
  });

  it("logs in with the password through OAuth + PKCE", async () => {
    const reg = await register.POST(new Request(`${BASE}/oauth/register`, { method: "POST", body: JSON.stringify({ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], client_name: "Claude" }) }));
    const { client_id } = await reg.json();
    const verifier = "v".repeat(50);
    const q = new URLSearchParams({ client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback", state: "s1", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", response_type: "code" });
    expect((await authorize.GET(new Request(`${BASE}/oauth/authorize?${q}`))).status).toBe(200);

    const bad = new URLSearchParams(q);
    bad.set("password", "wrong");
    expect((await authorize.POST(new Request(`${BASE}/oauth/authorize`, { method: "POST", body: bad.toString() }))).status).toBe(401);

    const good = new URLSearchParams(q);
    good.set("password", "correct-horse-battery");
    const redirect = await authorize.POST(new Request(`${BASE}/oauth/authorize`, { method: "POST", body: good.toString() }));
    expect(redirect.status).toBe(302);
    const loc = new URL(redirect.headers.get("location")!);
    expect(loc.searchParams.get("state")).toBe("s1");

    const tok = await token.POST(
      new Request(`${BASE}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: loc.searchParams.get("code")!, code_verifier: verifier, client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback" }).toString(),
      }),
    );
    const t = await tok.json();
    expect(t.token_type).toBe("Bearer");
    accessToken = t.access_token;
  }, 10_000);

  it("initializes and lists tools", async () => {
    const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(init.result.serverInfo.name).toBe("traders-insight-mt5");
    const tools = await rpc("tools/list");
    expect(tools.result.tools.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(["list_accounts", "get_account", "analyze_market", "preview_trade", "execute_trade"]),
    );
  });

  it("lists accounts with the funded one read-only", async () => {
    const r = await callTool("list_accounts", {});
    const list = JSON.parse(r.text);
    expect(list.find((a: any) => a.login === "1001")).toMatchObject({ kind: "demo", tradingAllowed: true });
    expect(list.find((a: any) => a.login === "2002")).toMatchObject({ kind: "funded", tradingAllowed: false });
  });

  it("refuses to trade on the funded account", async () => {
    const r = await callTool("preview_trade", { account: "2002", action: "open", symbol: "EURUSD", side: "buy", volume: 0.1, stopLoss: 1.099 });
    expect(JSON.parse(r.text).status).toBe("REFUZAT");
  });

  it("previews, then executes only with the code, once", async () => {
    const p = JSON.parse((await callTool("preview_trade", { account: "IC Demo", action: "open", symbol: "EURUSD", side: "buy", riskPercent: 1, stopLoss: 1.09802, takeProfit: 1.106 })).text);
    expect(p.status).toBe("GATA DE CONFIRMARE");
    expect(p.trade).toContain("BUY 0.5 EURUSD");
    expect(sent).toHaveLength(0); // preview sends nothing

    const forged = await callTool("execute_trade", { confirmationCode: p.confirmationCode.slice(0, -2) + "xx" });
    expect(forged.isError).toBe(true);
    expect(sent).toHaveLength(0);

    const done = JSON.parse((await callTool("execute_trade", { confirmationCode: p.confirmationCode })).text);
    expect(done.status).toBe("EXECUTAT");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ actionType: "ORDER_TYPE_BUY", symbol: "EURUSD", volume: 0.5, stopLoss: 1.09802 });
  });
});
