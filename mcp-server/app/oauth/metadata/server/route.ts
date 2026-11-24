import { authorizationServerMetadata } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => Response.json(authorizationServerMetadata(req), { headers: { "access-control-allow-origin": "*" } });
