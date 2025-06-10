import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { 
  CODE_TOOL,
  executeCode,
  isCodeArgs
} from "./sandbox";
import { 
  E2B_LIST_FILES_TOOL,
  E2B_READ_FILE_TOOL,
  E2B_WRITE_TO_FILE_TOOL,
  isE2BListFilesArgs,
  isE2BReadFileArgs,
  isE2BWriteFileArgs,
  listE2BFiles,
  readE2BFile,
  writeE2BFile
} from "./file";
import { WEB_SEARCH_TOOL as BRAVE_SEARCH_TOOL, performWebSearch, isBraveWebSearchArgs } from "./search/brave/brave_web_search";
import { SEARCH_TOOL as TAVILY_SEARCH_TOOL, performTavilySearch, isTavilySearchArgs } from "./search/tavily/tavily_search";
import { EXTRACT_TOOL, performTavilyExtract, isTavilyExtractArgs } from "./search/tavily/tavily_extract";
import { 
  SEARCH_TOOL as EXA_SEARCH_TOOL, 
  CONTENTS_TOOL as EXA_CONTENTS_TOOL,
  performExaSearch, 
  isExaSearchArgs,
  retrieveExaContents,
  isExaContentsArgs
} from "./search/exa";
import { SCRAPE_TOOL, performFirecrawlScrape, isFirecrawlScrapeArgs } from "./fetch/firecrawl/firecrawl_scrape";
import { CLOUDFLARE_FETCH_TOOL, performCloudfareFetch, isCloudfareFetchArgs } from "./fetch/cloudflare/cloudflare_fetch";
import { IMAGE_GENERATE_TOOL, performImageGeneration, isImageGenerateArgs } from "./image/image-router/image_router_generate";
import { READ_FILE_TOOL, isS3ReadFileArgs, readS3File } from "./file/s3/read_file";
import { WRITE_TO_FILE_TOOL, isS3WriteFileArgs, writeS3File } from "./file/s3/write_to_file";
import { REPLACE_IN_FILE_TOOL, isS3ReplaceInFileArgs, replaceInS3File } from "./editor/s3/edit_file";
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
    case "fetch": {
      if (!isCloudfareFetchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for fetch");
      }
      return performCloudfareFetch(args, env);
    }

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

    case "s3-edit-file": {
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

    case "exa-search": {
      if (!isExaSearchArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for exa-search");
      }
      const { query, type, numResults, includeDomains, excludeDomains } = args;
      return performExaSearch(query, {
        type,
        numResults,
        includeDomains,
        excludeDomains
      }, apiKey);
    }
    
    case "exa-contents": {
      if (!isExaContentsArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for exa-contents");
      }
      const { urls, text, highlights, summary, livecrawl, subpages, context } = args;
      return retrieveExaContents(urls, {
        text,
        highlights,
        summary,
        livecrawl,
        subpages,
        context
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

    case "firecrawl-scrape": {
      if (!isFirecrawlScrapeArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for firecrawl-scrape");
      }
      return performFirecrawlScrape(args, apiKey);
    }

    case "e2b-list-files": {
      if (!isE2BListFilesArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for e2b-list-files");
      }
      return listE2BFiles(args, apiKey);
    }

    case "e2b-read-file": {
      if (!isE2BReadFileArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for e2b-read-file");
      }
      return readE2BFile(args, apiKey);
    }

    case "e2b-write-to-file": {
      if (!isE2BWriteFileArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for e2b-write-to-file");
      }
      return writeE2BFile(args, apiKey);
    }

    case "e2b-code": {
      if (!isCodeArgs(args)) {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments for e2b-code");
      }
      return executeCode(args, apiKey);
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

/**
 * Get all available tools
 * 
 * @param integrations - Optional list of integration prefixes to filter tools by
 * @returns Array of tool definitions
 */
export function getTools(integrations?: string[]) {
  // Get all tools
  const allTools = [
    // Editor tools
    READ_FILE_TOOL,
    WRITE_TO_FILE_TOOL,
    REPLACE_IN_FILE_TOOL,
    
    // Search tools
    BRAVE_SEARCH_TOOL,
    TAVILY_SEARCH_TOOL,
    EXTRACT_TOOL,
    EXA_SEARCH_TOOL,
    EXA_CONTENTS_TOOL,
    
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
    
    // Fetch tools
    SCRAPE_TOOL,
    CLOUDFLARE_FETCH_TOOL,
    
    // Sandbox tools
    E2B_LIST_FILES_TOOL,
    E2B_READ_FILE_TOOL,
    E2B_WRITE_TO_FILE_TOOL,
    CODE_TOOL,
  ];

  // Get tools that don't require authentication (always available)
  const alwaysAvailableTools = [
    CLOUDFLARE_FETCH_TOOL
  ];

  // If no integrations specified, return always available tools
  if (!integrations || integrations.length === 0) {
    return alwaysAvailableTools;
  }
  
  // Filter other tools based on the integration prefixes
  const filteredTools = allTools.filter(tool => {
    // Skip tools that are always available
    if (alwaysAvailableTools.includes(tool)) {
      return false;
    }
    
    const name = tool.name;
    // Check if any of the allowed integrations match the tool name prefix
    return integrations.some(integration => 
      name.startsWith(integration + '-')
    );
  });
  
  // Return always available tools plus filtered tools
  return [...alwaysAvailableTools, ...filteredTools];
}
