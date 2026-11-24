import { protectedResourceMetadata } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => Response.json(protectedResourceMetadata(req), { headers: { "access-control-allow-origin": "*" } });
