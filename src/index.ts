import { StreamableHTTPServerTransport } from "./transport/http-transport";
import { Env } from "./types/index";

/**
 * Main entry point for Cloudflare Worker
 * Sets up the HTTP transport and handles requests
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const transport = new StreamableHTTPServerTransport();
    return transport.handleRequest(request, env);
  }
};
