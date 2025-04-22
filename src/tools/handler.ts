import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { WEB_SEARCH_TOOL, performWebSearch, isBraveWebSearchArgs } from "./brave-web-search";
import { LOCAL_SEARCH_TOOL, performLocalSearch, isBraveLocalSearchArgs } from "./brave-local-search";

// Export all tools for easy access
export const TOOLS = [WEB_SEARCH_TOOL, LOCAL_SEARCH_TOOL];

/**
 * Handle tool calls based on tool name
 * This central registry makes adding new tools easier by isolating
 * tool implementations from the transport layer
 * 
 * @param name - Tool name
 * @param args - Tool arguments
 * @param apiKey - API key for tool authentication
 * @returns Promise with tool execution result
 */
export async function handleToolCall(name: string, args: unknown, apiKey: string): Promise<string> {
  switch (name) {
    case "brave_web_search": {
      if (!isBraveWebSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave_web_search");
      }
      return performWebSearch(args.query, args.count, apiKey);
    }

    case "brave_local_search": {
      if (!isBraveLocalSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave_local_search");
      }
      return performLocalSearch(args.query, args.count, apiKey);
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

/**
 * Get all available tools
 * 
 * @returns Array of tool definitions
 */
export function getTools() {
  return TOOLS;
}
