import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Type definitions
export interface ExaContentsResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  id: string;
  score?: number;
  image?: string;
  favicon?: string;
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
  subpages?: ExaContentsResult[];
  extras?: {
    links: any[];
  };
}

export interface ExaContentsStatus {
  id: string;
  status: string;
  error?: {
    tag: string;
    httpStatusCode: number;
  };
}

export interface ExaContentsResponse {
  requestId: string;
  results: ExaContentsResult[];
  context?: string;
  statuses: ExaContentsStatus[];
  costDollars?: {
    total: number;
    breakDown: any[];
    perRequestPrices: any;
    perPagePrices: any;
  };
}

// Tool definition
export const CONTENTS_TOOL: Tool = {
  name: "exa-contents",
  description:
    "Retrieve the actual content from web pages using Exa's content retrieval API. " +
    "This tool is used to get detailed information including full text, highlights, and summaries from URLs " +
    "previously found via the exa-search tool. Useful for extracting specific information from webpages " +
    "for analysis, research, and knowledge retrieval.",
  inputSchema: {
    type: "object",
    properties: {
      urls: { 
        type: "array",
        items: { type: "string" },
        description: "Array of URLs to crawl and extract content from" 
      },
      text: {
        type: "boolean",
        description: "If true, returns full page text with default settings. If false, disables text return.",
        default: true
      },
      highlights: {
        type: "boolean",
        description: "If true, returns text snippets identified as most relevant from each page.",
        default: false
      },
      summary: {
        type: "boolean",
        description: "If true, returns a summary of the webpage.",
        default: false
      },
      livecrawl: {
        type: "string",
        enum: ["never", "fallback", "always", "preferred"],
        description: "Options for livecrawling pages. 'never': Disable livecrawling. 'fallback': Livecrawl when cache is empty. 'always': Always livecrawl. 'preferred': Always try to livecrawl, but fall back to cache if crawling fails.",
        default: "fallback"
      },
      subpages: {
        type: "number",
        description: "The number of subpages to crawl. The actual number crawled may be limited by system constraints.",
        default: 0
      },
      context: {
        type: "boolean",
        description: "If true, formats the content results into a context string ready for LLMs.",
        default: true
      }
    },
    required: ["urls"]
  }
};

// Helper functions
export function isExaContentsArgs(args: unknown): args is { 
  urls: string[];
  text?: boolean;
  highlights?: boolean;
  summary?: boolean;
  livecrawl?: "never" | "fallback" | "always" | "preferred";
  subpages?: number;
  context?: boolean;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "urls" in args &&
    Array.isArray((args as { urls: string[] }).urls) &&
    (args as { urls: string[] }).urls.every(url => typeof url === "string")
  );
}

/**
 * Retrieves content from specified URLs using the Exa Contents API
 * 
 * @param urls - Array of URLs to crawl and extract content from
 * @param params - Additional content retrieval parameters
 * @param apiKey - Exa API key
 * @returns Original JSON response as a string
 */
export async function retrieveExaContents(
  urls: string[], 
  params: {
    text?: boolean;
    highlights?: boolean;
    summary?: boolean;
    livecrawl?: "never" | "fallback" | "always" | "preferred";
    subpages?: number;
    context?: boolean;
  } = {}, 
  apiKey: string
): Promise<string> {
  try {
    // Make a direct HTTP request to Exa API
    const url = 'https://api.exa.ai/contents';
    
    // Build request parameters
    const requestBody: any = {
      urls: urls
    };
    
    // Add optional parameters if provided
    if (params.text !== undefined) {
      requestBody.text = params.text;
    }
    
    if (params.highlights !== undefined) {
      requestBody.highlights = params.highlights;
    }
    
    if (params.summary !== undefined) {
      requestBody.summary = params.summary;
    }
    
    if (params.livecrawl !== undefined) {
      requestBody.livecrawl = params.livecrawl;
    }
    
    if (params.subpages !== undefined) {
      requestBody.subpages = params.subpages;
    }
    
    if (params.context !== undefined) {
      requestBody.context = params.context;
    }
    
    // Execute the content retrieval with fetch API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Exa API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json() as ExaContentsResponse;
    
    // If context was requested and is available, return it as a string
    if (params.context && data.context) {
      return data.context;
    }
    
    // Otherwise return the full response as JSON string
    return JSON.stringify(data);
  } catch (error) {
    // Handle API errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Exa API error: ${errorMessage}`);
  }
}
