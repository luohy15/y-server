import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { WEB_SEARCH_TOOL, performWebSearch, isBraveWebSearchArgs } from "./search/brave/brave_web_search";
import { LOCAL_SEARCH_TOOL, performLocalSearch, isBraveLocalSearchArgs } from "./search/brave/brave_local_search";
import { SEARCH_TOOL, performTavilySearch, isTavilySearchArgs } from "./search/tavily/tavily_search";
import { EXTRACT_TOOL, performTavilyExtract, isTavilyExtractArgs } from "./search/tavily/tavily_extract";
import { IMAGE_GENERATE_TOOL, performImageGeneration, isImageGenerateArgs } from "./image/image-router/image_router_generate";
import { READ_FILE_TOOL, isS3ReadFileArgs, readS3File } from "./editor/s3/read_file";
import { WRITE_TO_FILE_TOOL, isS3WriteFileArgs, writeS3File } from "./editor/s3/write_to_file";
import { REPLACE_IN_FILE_TOOL, isS3ReplaceInFileArgs, replaceInS3File } from "./editor/s3/replace_in_file";
import { 
  GET_CALENDAR_EVENTS_TOOL,
  CREATE_CALENDAR_EVENT_TOOL,
  DELETE_CALENDAR_EVENT_TOOL,
  UPDATE_CALENDAR_EVENT_TOOL,
  getCalendarEvents,
  isGetEventsArgs,
  createCalendarEvent,
  isCreateEventArgs,
  deleteCalendarEvent,
  isDeleteEventArgs,
  updateCalendarEvent,
  isUpdateEventArgs
} from "./calendar/google";
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
} from "./email/gmail";
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
  switch (name) {
    case "s3-read-file": {
      if (!isS3ReadFileArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for read-file");
      }
      return readS3File(args.path, apiKey);
    }

    case "s3-write-to-file": {
      if (!isS3WriteFileArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for write-to-file");
      }
      return writeS3File(args.path, args.content, apiKey);
    }

    case "s3-replace-in-file": {
      if (!isS3ReplaceInFileArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for replace-in-file");
      }
      return replaceInS3File(args.path, args.diff, apiKey);
    }

    case "brave-web-search": {
      if (!isBraveWebSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave-web-search");
      }
      return performWebSearch(args.query, args.count, apiKey);
    }

    case "brave-local-search": {
      if (!isBraveLocalSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for brave-local-search");
      }
      return performLocalSearch(args.query, args.count, apiKey);
    }

    case "tavily-search": {
      if (!isTavilySearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for tavily-search");
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
      }, apiKey);
    }

    case "tavily-extract": {
      if (!isTavilyExtractArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for tavily-extract");
      }
      const { urls, extract_depth, include_images } = args;
      return performTavilyExtract(urls, { extract_depth, include_images }, apiKey);
    }

    case "image-router-generate": {
      if (!isImageGenerateArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for image-router-generate");
      }
      const { prompt, model, size, n, response_format } = args;
      return performImageGeneration(prompt, { model, size, n, response_format }, apiKey, env);
    }

    case "google-calendar-get-events": {
      if (!isGetEventsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-get-events");
      }
      return getCalendarEvents(apiKey, args);
    }

    case "google-calendar-create-event": {
      if (!isCreateEventArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-create-event");
      }
      return createCalendarEvent(apiKey, args);
    }

    case "google-calendar-delete-event": {
      if (!isDeleteEventArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-delete-event");
      }
      return deleteCalendarEvent(apiKey, args);
    }

    case "google-calendar-update-event": {
      if (!isUpdateEventArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-calendar-update-event");
      }
      return updateCalendarEvent(apiKey, args);
    }

    case "google-gmail-query-emails": {
      if (!isQueryEmailsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-query-emails");
      }
      return queryEmails(apiKey, args);
    }

    case "google-gmail-get-email": {
      if (!isGetEmailArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-get-email");
      }
      return getEmail(apiKey, args);
    }

    case "google-gmail-bulk-get-emails": {
      if (!isBulkGetEmailsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-bulk-get-emails");
      }
      return bulkGetEmails(apiKey, args);
    }

    case "google-gmail-create-draft": {
      if (!isCreateDraftArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-create-draft");
      }
      return createDraft(apiKey, args);
    }

    case "google-gmail-delete-draft": {
      if (!isDeleteDraftArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-delete-draft");
      }
      return deleteDraft(apiKey, args);
    }

    case "google-gmail-reply-email": {
      if (!isReplyEmailArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for google-gmail-reply-email");
      }
      return replyEmail(apiKey, args);
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
    // Editor tools
    READ_FILE_TOOL,
    WRITE_TO_FILE_TOOL,
    REPLACE_IN_FILE_TOOL,
    
    // Search tools
    WEB_SEARCH_TOOL,
    LOCAL_SEARCH_TOOL,
    SEARCH_TOOL,
    EXTRACT_TOOL,
    
    // Calendar tools
    GET_CALENDAR_EVENTS_TOOL,
    CREATE_CALENDAR_EVENT_TOOL,
    DELETE_CALENDAR_EVENT_TOOL,
    UPDATE_CALENDAR_EVENT_TOOL,
    
    // Email tools
    QUERY_EMAILS_TOOL,
    GET_EMAIL_TOOL,
    BULK_GET_EMAILS_TOOL,
    CREATE_DRAFT_TOOL,
    DELETE_DRAFT_TOOL,
    REPLY_EMAIL_TOOL,

    // Image generation tools
    IMAGE_GENERATE_TOOL,
  ];
}
