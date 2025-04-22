import {
  CallToolRequestSchema,
  ErrorCode,
  InitializeRequestSchema,
  isInitializeRequest,
  isJSONRPCRequest,
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { Env } from "../types/index";
import { handleToolCall, getTools } from "../tools/handler";

/**
 * Streamable HTTP transport for Cloudflare Workers
 * Truly stateless implementation without session management
 * No class-level state is maintained between requests
 */
export class StreamableHTTPServerTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  async handleRequest(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Extract Bearer token from Authorization header or use default API key
    let token = env.DEFAULT_API_KEY;
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    switch (request.method) {
      case "POST":
        return this.handlePostRequest(request, env, token);
      case "DELETE":
        return this.handleDeleteRequest();
      default:
        return this.errorResponse(405, {
          code: -32000,
          message: "Method not allowed",
        }, {
          "Allow": "POST, DELETE, OPTIONS"
        });
    }
  }

  private async handlePostRequest(request: Request, env: Env, token: string): Promise<Response> {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return this.errorResponse(415, {
        code: -32000,
        message: "Unsupported Media Type: Content-Type must be application/json",
      });
    }

    try {
      const rawMessage = await request.json();
      const messages = Array.isArray(rawMessage) ? rawMessage : [rawMessage];

      // Handle initialization
      const isInitializationRequest = messages.some(isInitializeRequest);
      
      // In serverless environments, we accept initialization with each request
      // We still enforce that initialization requests can't be batched with other requests
      if (isInitializationRequest && messages.length > 1) {
        return this.errorResponse(400, {
          code: -32600,
          message: "Invalid Request: Initialization request cannot be batched with other requests",
        });
      }

      // Process messages
      const hasRequests = messages.some(isJSONRPCRequest);
      if (!hasRequests) {
        return new Response(null, { status: 202 });
      }

      // Handle requests
      const responses: JSONRPCMessage[] = [];
      for (const message of messages) {
        if (isJSONRPCRequest(message)) {
          const response = await this.handleJsonRpcRequest(message, env, token);
          responses.push(response);
          if (this.onmessage) {
            this.onmessage(message);
          }
        }
      }

      // Return responses
      const headers = new Headers({
        "Content-Type": "application/json",
      });

      return new Response(
        JSON.stringify(responses.length === 1 ? responses[0] : responses),
        { headers }
      );

    } catch (error) {
      return this.errorResponse(400, {
        code: -32700,
        message: "Parse error",
        data: String(error),
      });
    }
  }

  private async handleDeleteRequest(): Promise<Response> {
    // Simple cleanup - no state to clear in serverless environment
    if (this.onclose) {
      this.onclose();
    }
    return new Response(null, { status: 200 });
  }

  private async handleJsonRpcRequest(request: JSONRPCRequest, env: Env, token: string): Promise<JSONRPCResponse | JSONRPCError> {
    try {
      switch (request.method) {
        case "initialize": {
          InitializeRequestSchema.parse(request);
          
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                experimental: {},
                tools: {
                  listChanged: false
                }
              },
              serverInfo: {
                name: "y-server",
                version: "0.1.0"
              }
            }
          };
        }

        case "tools/list": {
          ListToolsRequestSchema.parse(request);
          return {
            jsonrpc: "2.0",
            result: {
              tools: getTools(),
            },
            id: request.id,
          };
        }

        case "resources/list": {
          return {
            jsonrpc: "2.0",
            result: {
              resources: [],
            },
            id: request.id,
          };
        }

        case "resourceTemplates/list": {
          return {
            jsonrpc: "2.0",
            result: {
              resourceTemplates: [],
            },
            id: request.id,
          };
        }

        case "tools/call": {
          CallToolRequestSchema.parse(request);
          const params = request.params as { name: string; arguments: unknown };
          const { name, arguments: args } = params;
          
          if (!args) {
            throw new McpError(ErrorCode.InvalidParams, "No arguments provided");
          }

          const results = await handleToolCall(name, args, token);
          return {
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: results }],
              isError: false
            },
            id: request.id,
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown method: ${request.method}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        return {
          jsonrpc: "2.0",
          error: {
            code: error.code,
            message: error.message,
          },
          id: request.id,
        };
      }
      return {
        jsonrpc: "2.0",
        error: {
          code: ErrorCode.InternalError,
          message: String(error),
        },
        id: request.id,
      };
    }
  }

  private errorResponse(status: number, error: { code: number; message: string; data?: unknown }, headers: Record<string, string> = {}): Response {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error,
        id: null,
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      }
    );
  }

  async close(): Promise<void> {
    // No state to clear in serverless environment
    if (this.onclose) {
      this.onclose();
    }
  }
}
