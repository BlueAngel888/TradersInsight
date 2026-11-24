import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ConfigError } from "@/lib/config";
import { bearerOk, origin } from "@/lib/oauth";
import { buildServer } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(req: Request, message = "Autentificare necesară.") {
  return Response.json(
    { error: "unauthorized", error_description: message },
    { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${origin(req)}/.well-known/oauth-protected-resource"` } },
  );
}

async function handle(req: Request) {
  try {
    if (!bearerOk(req)) return unauthorized(req);
  } catch (e) {
    if (e instanceof ConfigError) return Response.json({ error: "server_misconfigured", error_description: e.message }, { status: 503 });
    throw e;
  }
  // Stateless: a fresh server per request, so it runs fine on serverless.
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // JSON mode has already produced the full response at this point.
    void transport.close();
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
