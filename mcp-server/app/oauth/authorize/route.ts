import { ConfigError } from "@/lib/config";
import { checkPassword, issueCode, readClient } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface AuthParams {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  response_type: string;
}

const FIELDS: (keyof AuthParams)[] = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "response_type"];

function read(src: URLSearchParams): AuthParams {
  return Object.fromEntries(FIELDS.map((k) => [k, src.get(k) ?? ""])) as unknown as AuthParams;
}

function problem(p: AuthParams): string | null {
  if (p.response_type !== "code") return "response_type trebuie să fie code.";
  if (p.code_challenge_method !== "S256" || !p.code_challenge) return "Lipsește PKCE (S256).";
  const client = readClient(p.client_id);
  if (!client) return "Aplicație necunoscută (client_id invalid).";
  if (!client.ru.includes(p.redirect_uri)) return "redirect_uri nu e înregistrat pentru această aplicație.";
  return null;
}

function page(p: AuthParams, error?: string, status = 200) {
  const client = readClient(p.client_id);
  const host = (() => {
    try {
      return new URL(p.redirect_uri).host;
    } catch {
      return "?";
    }
  })();
  const hidden = FIELDS.map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`).join("");
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectare MT5</title><style>
:root{color-scheme:light dark;--bg:#f6f7f9;--card:#fff;--fg:#111;--muted:#666;--accent:#0a7cff;--err:#c62828}
@media (prefers-color-scheme:dark){:root{--bg:#0e1014;--card:#181b21;--fg:#eee;--muted:#9aa;--accent:#4c9dff;--err:#ff6b6b}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 -apple-system,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.c{background:var(--card);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 2px 16px #0002}
h1{font-size:20px;margin:0 0 8px}p{color:var(--muted);margin:0 0 16px}
input[type=password]{width:100%;box-sizing:border-box;font-size:17px;padding:12px;border-radius:10px;border:1px solid #8886;background:transparent;color:inherit}
button{margin-top:12px;width:100%;font-size:17px;padding:12px;border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:600}
.e{color:var(--err);margin-bottom:12px}</style></head><body><form class="c" method="post">
<h1>Conectează contul MT5</h1>
<p><b>${esc(client?.n || "O aplicație")}</b> (${esc(host)}) cere acces la conturile tale MT5: citire și tranzacții cu confirmare.</p>
${error ? `<div class="e">${esc(error)}</div>` : ""}
${hidden}<input type="password" name="password" placeholder="Parola (MCP_PASSWORD)" autocomplete="current-password" required autofocus>
<button type="submit">Permite accesul</button></form></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } });
}

export async function GET(req: Request) {
  const p = read(new URL(req.url).searchParams);
  try {
    const bad = problem(p);
    return bad ? page(p, bad, 400) : page(p);
  } catch (e) {
    if (e instanceof ConfigError) return new Response(e.message, { status: 503 });
    throw e;
  }
}

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const p = read(form);
  try {
    const bad = problem(p);
    if (bad) return page(p, bad, 400);
    if (!checkPassword(form.get("password") ?? "")) {
      await new Promise((r) => setTimeout(r, 1500)); // slows down guessing
      return page(p, "Parolă greșită.", 401);
    }
  } catch (e) {
    if (e instanceof ConfigError) return new Response(e.message, { status: 503 });
    throw e;
  }
  const target = new URL(p.redirect_uri);
  target.searchParams.set("code", issueCode(p.client_id, p.redirect_uri, p.code_challenge));
  if (p.state) target.searchParams.set("state", p.state);
  return Response.redirect(target.toString(), 302);
}
