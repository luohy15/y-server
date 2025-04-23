import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { WEB_SEARCH_TOOL, performWebSearch, isBraveWebSearchArgs } from "./brave-web-search";
import { LOCAL_SEARCH_TOOL, performLocalSearch, isBraveLocalSearchArgs } from "./brave-local-search";
import { SEARCH_TOOL, performTavilySearch, isTavilySearchArgs } from "./tavily-search";
import { EXTRACT_TOOL, performTavilyExtract, isTavilyExtractArgs } from "./tavily-extract";
import { IMAGE_GENERATE_TOOL, performImageGeneration, isImageGenerateArgs } from "./image-router-generate";
import { 
  LIST_CALENDARS_TOOL, 
  GET_CALENDAR_EVENTS_TOOL,
  CREATE_CALENDAR_EVENT_TOOL,
  DELETE_CALENDAR_EVENT_TOOL,
  listCalendars, 
  isListCalendarsArgs,
  getCalendarEvents,
  isGetEventsArgs,
  createCalendarEvent,
  isCreateEventArgs,
  deleteCalendarEvent,
  isDeleteEventArgs
} from "./google/calendar";
import {
  QUERY_EMAILS_TOOL,
  GET_EMAIL_TOOL,
  BULK_GET_EMAILS_TOOL,
  CREATE_DRAFT_TOOL,
  DELETE_DRAFT_TOOL,
  REPLY_EMAIL_TOOL,
  queryEmails,
  isQueryEmailsArgs,
  getEmail,
  isGetEmailArgs,
  bulkGetEmails,
  isBulkGetEmailsArgs,
  createDraft,
  isCreateDraftArgs,
  deleteDraft,
  isDeleteDraftArgs,
  replyEmail,
  isReplyEmailArgs
} from "./google/gmail";
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
  } else if (name.startsWith('image_router_')) {
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

    case "image_router_generate": {
      if (!isImageGenerateArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for image_router_generate");
      }
      const { prompt, model, size, n, response_format } = args;
      return performImageGeneration(prompt, { model, size, n, response_format }, serviceKey, env);
    }

    case "google-calendar-list-calendars": {
      if (!isListCalendarsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-list-calendars");
      }
      return listCalendars(serviceKey);
    }

    case "google-calendar-get-events": {
      if (!isGetEventsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-get-events");
      }
      return getCalendarEvents(serviceKey, args);
    }

    case "google-calendar-create-event": {
      if (!isCreateEventArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-create-event");
      }
      return createCalendarEvent(serviceKey, args);
    }

    case "google-calendar-delete-event": {
      if (!isDeleteEventArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-delete-event");
      }
      return deleteCalendarEvent(serviceKey, args);
    }

    case "google-gmail-query-emails": {
      if (!isQueryEmailsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-query-emails");
      }
      return queryEmails(serviceKey, args);
    }

    case "google-gmail-get-email": {
      if (!isGetEmailArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-get-email");
      }
      return getEmail(serviceKey, args);
    }

    case "google-gmail-bulk-get-emails": {
      if (!isBulkGetEmailsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-bulk-get-emails");
      }
      return bulkGetEmails(serviceKey, args);
    }

    case "google-gmail-create-draft": {
      if (!isCreateDraftArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-create-draft");
      }
      return createDraft(serviceKey, args);
    }

    case "google-gmail-delete-draft": {
      if (!isDeleteDraftArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-delete-draft");
      }
      return deleteDraft(serviceKey, args);
    }

    case "google-gmail-reply-email": {
      if (!isReplyEmailArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-reply-email");
      }
      return replyEmail(serviceKey, args);
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
    IMAGE_GENERATE_TOOL,
    LIST_CALENDARS_TOOL,
    GET_CALENDAR_EVENTS_TOOL,
    CREATE_CALENDAR_EVENT_TOOL,
    DELETE_CALENDAR_EVENT_TOOL,
    QUERY_EMAILS_TOOL,
    GET_EMAIL_TOOL,
    BULK_GET_EMAILS_TOOL,
    CREATE_DRAFT_TOOL,
    DELETE_DRAFT_TOOL,
    REPLY_EMAIL_TOOL
  ];
}
