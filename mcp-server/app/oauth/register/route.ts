import { registerClient, validRedirect } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// RFC 7591 dynamic client registration (public clients, PKCE only).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { redirect_uris?: unknown; client_name?: unknown };
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || !uris.every(validRedirect))
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris trebuie să fie https." }, { status: 400 });
  const name = typeof body.client_name === "string" ? body.client_name : undefined;
  return Response.json(
    {
      client_id: registerClient(uris, name),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: { "access-control-allow-origin": "*" } },
  );
}
