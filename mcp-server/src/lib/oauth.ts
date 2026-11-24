// Minimal OAuth 2.1 authorization server for one user (PKCE, dynamic client
// registration), so the server can be added as a custom connector in Claude.
// Login = the MCP_PASSWORD. Everything is signed, nothing is stored.

import { requirePassword, signingKey } from "./config";
import { safeEqual, sign, verify } from "./tokens";

export const ACCESS_TTL_S = 60 * 60; // 1 hour
const REFRESH_TTL_S = 30 * 24 * 60 * 60; // 30 days
const CODE_TTL_S = 5 * 60;

export function origin(req: Request): string {
  const fixed = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const resourceUrl = (req: Request) => `${origin(req)}/api/mcp`;

export function protectedResourceMetadata(req: Request) {
  return {
    resource: resourceUrl(req),
    authorization_servers: [origin(req)],
    bearer_methods_supported: ["header"],
    resource_name: "Traders Insight MT5",
  };
}

export function authorizationServerMetadata(req: Request) {
  const o = origin(req);
  return {
    issuer: o,
    authorization_endpoint: `${o}/oauth/authorize`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mt5"],
  };
}

const now = () => Date.now();

export function validRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

/** Stateless client registration: the client id carries its own redirect URIs. */
export function registerClient(redirectUris: string[], name?: string) {
  return sign({ typ: "client", exp: now() + 10 * 365 * 86_400_000, ru: redirectUris, n: name?.slice(0, 60) }, signingKey());
}

export function readClient(clientId: string) {
  return verify<{ ru: string[]; n?: string }>(clientId, signingKey(), "client");
}

export const checkPassword = (given: string) => safeEqual(given, requirePassword());

export function issueCode(clientId: string, redirectUri: string, codeChallenge: string) {
  return sign({ typ: "code", exp: now() + CODE_TTL_S * 1000, cid: clientId, ru: redirectUri, cc: codeChallenge }, signingKey());
}

export const readCode = (code: string) => verify<{ cid: string; ru: string; cc: string }>(code, signingKey(), "code");

export function issueTokens(clientId: string) {
  const key = signingKey();
  return {
    access_token: sign({ typ: "access", exp: now() + ACCESS_TTL_S * 1000, cid: clientId.slice(-16) }, key),
    refresh_token: sign({ typ: "refresh", exp: now() + REFRESH_TTL_S * 1000, cid: clientId }, key),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    scope: "mt5",
  };
}

export const readRefresh = (token: string) => verify<{ cid: string }>(token, signingKey(), "refresh");

export function bearerOk(req: Request): boolean {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return !!m && verify(m[1].trim(), signingKey(), "access") !== null;
}
