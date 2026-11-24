import type { NextConfig } from "next";

const config: NextConfig = {
  async rewrites() {
    return [
      // OAuth discovery for MCP clients (RFC 9728 / RFC 8414), with and without the resource path suffix.
      { source: "/.well-known/oauth-protected-resource", destination: "/oauth/metadata/resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/oauth/metadata/resource" },
      { source: "/.well-known/oauth-authorization-server", destination: "/oauth/metadata/server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/oauth/metadata/server" },
      { source: "/.well-known/openid-configuration", destination: "/oauth/metadata/server" },
      // Some clients use the bare origin as the MCP URL.
      { source: "/mcp", destination: "/api/mcp" },
    ];
  },
};

export default config;
