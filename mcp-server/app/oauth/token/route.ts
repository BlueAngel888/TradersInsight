import { issueTokens, readClient, readCode, readRefresh } from "@/lib/oauth";
import { pkceOk } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const err = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });

async function params(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, string>;
    return new URLSearchParams(j);
  }
  return new URLSearchParams(await req.text());
}

export async function POST(req: Request) {
  const p = await params(req);
  const grant = p.get("grant_type");
  const ok = (clientId: string) => Response.json(issueTokens(clientId), { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });

  if (grant === "authorization_code") {
    const code = readCode(p.get("code") ?? "");
    if (!code) return err("invalid_grant", "Cod invalid sau expirat.");
    if (p.get("client_id") && p.get("client_id") !== code.cid) return err("invalid_grant", "client_id diferit.");
    if (p.get("redirect_uri") && p.get("redirect_uri") !== code.ru) return err("invalid_grant", "redirect_uri diferit.");
    if (!pkceOk(p.get("code_verifier") ?? "", code.cc)) return err("invalid_grant", "PKCE invalid.");
    return ok(code.cid);
  }
  if (grant === "refresh_token") {
    const r = readRefresh(p.get("refresh_token") ?? "");
    if (!r || !readClient(r.cid)) return err("invalid_grant", "Refresh token invalid sau expirat.");
    return ok(r.cid);
  }
  return err("unsupported_grant_type", "Doar authorization_code și refresh_token.");
}
