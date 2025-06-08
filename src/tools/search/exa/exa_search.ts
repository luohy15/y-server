import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Type definitions
export interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  highlights?: string[];
  summary?: string;
}

export interface ExaSearchResponse {
  results: ExaSearchResult[];
  context: string;
}

// Tool definition
export const SEARCH_TOOL: Tool = {
  name: "exa-search",
  description:
    "A powerful web search tool that provides comprehensive search results using Exa's semantic search engine. " +
    "Returns a formatted context string ready for LLMs with relevant information from the web. " +
    "Ideal for research tasks, information gathering, and staying up-to-date with current information. " +
    "This tool always sets context=true to get formatted results for LLMs.",
  inputSchema: {
    type: "object",
    properties: {
      query: { 
        type: "string", 
        description: "Search query" 
      },
      type: {
        type: "string",
        enum: ["keyword", "neural", "auto"],
        description: "The type of search. Neural uses an embeddings-based model, keyword is google-like SERP. Default is auto.",
        default: "auto"
      },
      numResults: {
        type: "number",
        description: "Number of results to return (max 100)",
        default: 10
      },
      includeDomains: {
        type: "array",
        items: { type: "string" },
        description: "List of domains to include in the search. If specified, results will only come from these domains.",
        default: []
      },
      excludeDomains: {
        type: "array",
        items: { type: "string" },
        description: "List of domains to exclude from search results. If specified, no results will be returned from these domains.",
        default: []
      }
    },
    required: ["query"]
  }
};

// Helper functions
export function isExaSearchArgs(args: unknown): args is { 
  query: string;
  type?: "keyword" | "neural" | "auto";
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

/**
 * Performs a web search using the Exa Search API
 * 
 * @param query - The search query
 * @param params - Additional search parameters
 * @param apiKey - Exa API key
 * @returns Original JSON response as a string
 */
export async function performExaSearch(
  query: string, 
  params: {
    type?: "keyword" | "neural" | "auto";
    numResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}, 
  apiKey: string
): Promise<string> {
  try {
    // Make a direct HTTP request to Exa API
    const url = 'https://api.exa.ai/search';
    
    // Build search parameters
    const requestBody: any = {
      query: query,
      numResults: params.numResults || 10,
      context: true  // Always explicitly request the context string
    };
    
    // Add optional parameters if provided
    if (params.type) {
      requestBody.type = params.type;
    }
    
    if (params.includeDomains && params.includeDomains.length > 0) {
      requestBody.includeDomains = params.includeDomains;
    }
    
    if (params.excludeDomains && params.excludeDomains.length > 0) {
      requestBody.excludeDomains = params.excludeDomains;
    }
    
    // Execute the search with fetch API
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
    
    const data = await response.json() as ExaSearchResponse;
    
    // If the data already contains a context string, return it directly
    if (data.context) {
      return data.context;
    }
    
    // Otherwise return the full response as a JSON string
    return JSON.stringify(data);
  } catch (error) {
    // Handle API errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Exa API error: ${errorMessage}`);
  }
}
