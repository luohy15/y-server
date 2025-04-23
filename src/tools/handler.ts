import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { WEB_SEARCH_TOOL, performWebSearch, isBraveWebSearchArgs } from "./brave-web-search";
import { LOCAL_SEARCH_TOOL, performLocalSearch, isBraveLocalSearchArgs } from "./brave-local-search";
import { SEARCH_TOOL, performTavilySearch, isTavilySearchArgs } from "./tavily-search";
import { EXTRACT_TOOL, performTavilyExtract, isTavilyExtractArgs } from "./tavily-extract";
import { IMAGE_GENERATE_TOOL, performImageGeneration, isImageGenerateArgs } from "./image-generate";
import { Env } from "../types/index.js";

/**
 * Helper function to get the appropriate API key for a service from a composite token
 * Handles formats like "tavily:key1,brave:key2" and extracts the relevant key
 * 
 * @param token - The raw token string (may contain service-specific keys)
 * @param service - The service to get the key for (e.g., 'brave', 'tavily')
 * @returns The service-specific key if available, otherwise the original token
 */
function getApiKeyForService(token: string, service: string): string {
  // Check if token contains service-specific keys (format: "service1:key1,service2:key2")
  if (token.includes(':')) {
    const keyMap: Record<string, string> = {};
    const keyPairs = token.split(',');
    
    // Parse each key pair
    for (const pair of keyPairs) {
      const [prefix, key] = pair.split(':');
      if (prefix && key) {
        keyMap[prefix.trim()] = key.trim();
      }
    }
    
    // Return the service-specific key if available
    if (keyMap[service]) {
      return keyMap[service];
    }
  }
  
  // If no service prefixes are found or specific service key not found, return the entire token
  return token;
}


/**
 * Handle tool calls based on tool name
 * This central registry makes adding new tools easier by isolating
 * tool implementations from the transport layer
 * 
 * @param name - Tool name
 * @param args - Tool arguments
 * @param apiKey - API key for tool authentication
 * @param env - Cloudflare Worker environment
 * @returns Promise with tool execution result
 */
export async function handleToolCall(name: string, args: unknown, apiKey: string, env?: Env): Promise<string> {
  // Get the appropriate API key based on the tool name
  let serviceKey: string;
  
  if (name.startsWith('brave_')) {
    serviceKey = getApiKeyForService(apiKey, 'brave');
  } else if (name.startsWith('tavily_')) {
    serviceKey = getApiKeyForService(apiKey, 'tavily');
  } else if (name.startsWith('image_generate')) {
    serviceKey = getApiKeyForService(apiKey, 'image_router');
  } else {
    // For unknown tools, use the original token
    serviceKey = apiKey;
  }

  switch (name) {
    case "brave_web_search": {
      if (!isBraveWebSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave_web_search");
      }
      return performWebSearch(args.query, args.count, serviceKey);
    }

    case "brave_local_search": {
      if (!isBraveLocalSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave_local_search");
      }
      return performLocalSearch(args.query, args.count, serviceKey);
    }

    case "tavily_search": {
      if (!isTavilySearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for tavily_search");
      }
      const {
        query,
        search_depth,
        topic,
        days,
        time_range,
        max_results,
        include_images,
        include_image_descriptions,
        include_raw_content,
        include_domains,
        exclude_domains
      } = args;
      return performTavilySearch(query, {
        search_depth,
        topic,
        days,
        time_range,
        max_results,
        include_images,
        include_image_descriptions,
        include_raw_content,
        include_domains,
        exclude_domains
      }, serviceKey);
    }

    case "tavily_extract": {
      if (!isTavilyExtractArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for tavily_extract");
      }
      const { urls, extract_depth, include_images } = args;
      return performTavilyExtract(urls, { extract_depth, include_images }, serviceKey);
    }

    case "image_generate": {
      if (!isImageGenerateArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for image_generate");
      }
      const { prompt, model, size, n, response_format } = args;
      return performImageGeneration(prompt, { model, size, n, response_format }, serviceKey, env);
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
  // Export all tools for easy access
  return [
    WEB_SEARCH_TOOL,
    LOCAL_SEARCH_TOOL,
    SEARCH_TOOL,
    EXTRACT_TOOL,
    IMAGE_GENERATE_TOOL
  ];
}
