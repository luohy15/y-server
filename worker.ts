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
  RequestId,
  Tool
} from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
const WEB_SEARCH_TOOL: Tool = {
  name: "brave_web_search",
  description:
    "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
    "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
    "Supports pagination, content filtering, and freshness controls. " +
    "Maximum 20 results per request, with offset for pagination. ",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (max 400 chars, 50 words)"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 10)",
        default: 10
      },
      offset: {
        type: "number",
        description: "Pagination offset (max 9, default 0)",
        default: 0
      },
    },
    required: ["query"],
  },
};

const LOCAL_SEARCH_TOOL: Tool = {
  name: "brave_local_search",
  description:
    "Searches for local businesses and places using Brave's Local Search API. " +
    "Best for queries related to physical locations, businesses, restaurants, services, etc. " +
    "Returns detailed information including:\n" +
    "- Business names and addresses\n" +
    "- Ratings and review counts\n" +
    "- Phone numbers and opening hours\n" +
    "Use this when the query implies 'near me' or mentions specific locations. " +
    "Automatically falls back to web search if no local results are found.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Local search query (e.g. 'pizza near Central Park')"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 5)",
        default: 5
      },
    },
    required: ["query"]
  }
};

// Rate limiting configuration
const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

// Type definitions
interface BraveWeb {
  web?: {
    results?: Array<{
      title: string;
      description: string;
      url: string;
      language?: string;
      published?: string;
      rank?: number;
    }>;
  };
  locations?: {
    results?: Array<{
      id: string;
      title?: string;
    }>;
  };
}

interface BraveLocation {
  id: string;
  name: string;
  address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  openingHours?: string[];
  priceRange?: string;
}

interface BravePoiResponse {
  results: BraveLocation[];
}

interface BraveDescription {
  descriptions: {[id: string]: string};
}

// Cloudflare Worker specific types
interface Env {
  // No environment variables needed as we use Bearer token
}

// Helper functions
function isBraveWebSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

function isBraveLocalSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

/**
 * Streamable HTTP transport for Cloudflare Workers
 * Truly stateless implementation without session management
 * No class-level state is maintained between requests
 */
class StreamableHTTPServerTransport {
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

    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return this.errorResponse(401, {
        code: -32001,
        message: "Unauthorized: Bearer token required",
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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
                name: "y-server-search",
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
              tools: [WEB_SEARCH_TOOL, LOCAL_SEARCH_TOOL],
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

          switch (name) {
            case "brave_web_search": {
              if (!isBraveWebSearchArgs(args)) {
                throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave_web_search");
              }
              const results = await performWebSearch(args.query, args.count, token);
              return {
                jsonrpc: "2.0",
                result: {
                  content: [{ type: "text", text: results }],
                  isError: false
                },
                id: request.id,
              };
            }

            case "brave_local_search": {
              if (!isBraveLocalSearchArgs(args)) {
                throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave_local_search");
              }
              const results = await performLocalSearch(args.query, args.count, token);
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
              throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
          }
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

// Brave API implementation
async function performWebSearch(query: string, count: number = 10, apiKey: string): Promise<string> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', Math.min(count, 20).toString());

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as BraveWeb;
  const results = (data.web?.results || []).map(result => ({
    title: result.title || '',
    description: result.description || '',
    url: result.url || ''
  }));

  return results.map(r =>
    `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`
  ).join('\n\n');
}

async function performLocalSearch(query: string, count: number = 5, apiKey: string): Promise<string> {
  const webUrl = new URL('https://api.search.brave.com/res/v1/web/search');
  webUrl.searchParams.set('q', query);
  webUrl.searchParams.set('search_lang', 'en');
  webUrl.searchParams.set('result_filter', 'locations');
  webUrl.searchParams.set('count', Math.min(count, 20).toString());

  const webResponse = await fetch(webUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!webResponse.ok) {
    throw new Error(`Brave API error: ${webResponse.status} ${webResponse.statusText}`);
  }

  const webData = await webResponse.json() as BraveWeb;
  const locationIds = webData.locations?.results?.filter((r): r is {id: string; title?: string} => r.id != null).map(r => r.id) || [];

  if (locationIds.length === 0) {
    return performWebSearch(query, count, apiKey);
  }

  const [poisData, descriptionsData] = await Promise.all([
    getPoisData(locationIds, apiKey),
    getDescriptionsData(locationIds, apiKey)
  ]);

  return formatLocalResults(poisData, descriptionsData);
}

async function getPoisData(ids: string[], apiKey: string): Promise<BravePoiResponse> {
  const url = new URL('https://api.search.brave.com/res/v1/local/pois');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as BravePoiResponse;
}

async function getDescriptionsData(ids: string[], apiKey: string): Promise<BraveDescription> {
  const url = new URL('https://api.search.brave.com/res/v1/local/descriptions');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as BraveDescription;
}

function formatLocalResults(poisData: BravePoiResponse, descData: BraveDescription): string {
  return (poisData.results || []).map(poi => {
    const address = [
      poi.address?.streetAddress ?? '',
      poi.address?.addressLocality ?? '',
      poi.address?.addressRegion ?? '',
      poi.address?.postalCode ?? ''
    ].filter(part => part !== '').join(', ') || 'N/A';

    return `Name: ${poi.name}
Address: ${address}
Phone: ${poi.phone || 'N/A'}
Rating: ${poi.rating?.ratingValue ?? 'N/A'} (${poi.rating?.ratingCount ?? 0} reviews)
Price Range: ${poi.priceRange || 'N/A'}
Hours: ${(poi.openingHours || []).join(', ') || 'N/A'}
Description: ${descData.descriptions[poi.id] || 'No description available'}
`;
  }).join('\n---\n') || 'No local results found';
}

// Cloudflare Worker entry point
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const transport = new StreamableHTTPServerTransport();
    return transport.handleRequest(request, env);
  }
};
