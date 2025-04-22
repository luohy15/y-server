import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Type definitions
export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  raw_content?: string;
}

export interface TavilySearchResponse {
  query: string;
  follow_up_questions?: Array<string>;
  answer?: string;
  images?: Array<string | {
    url: string;
    description?: string;
  }>;
  results: Array<TavilySearchResult>;
}

// Tool definition
export const SEARCH_TOOL: Tool = {
  name: "tavily_search",
  description:
    "A powerful web search tool that provides comprehensive, real-time results using Tavily's AI search engine. " +
    "Returns relevant web content with customizable parameters for result count, content type, and domain filtering. " +
    "Ideal for gathering current information, news, and detailed web content analysis.",
  inputSchema: {
    type: "object",
    properties: {
      query: { 
        type: "string", 
        description: "Search query" 
      },
      search_depth: {
        type: "string",
        enum: ["basic","advanced"],
        description: "The depth of the search. It can be 'basic' or 'advanced'",
        default: "basic"
      },
      topic : {
        type: "string",
        enum: ["general","news"],
        description: "The category of the search. This will determine which of our agents will be used for the search",
        default: "general"
      },
      days: {
        type: "number",
        description: "The number of days back from the current date to include in the search results. This specifies the time frame of data to be retrieved. Please note that this feature is only available when using the 'news' search topic",
        default: 3
      },
      time_range: {
        type: "string",
        description: "The time range back from the current date to include in the search results. This feature is available for both 'general' and 'news' search topics",
        enum: ["day", "week", "month", "year", "d", "w", "m", "y"],
      },
      max_results: { 
        type: "number", 
        description: "The maximum number of search results to return",
        default: 10,
        minimum: 5,
        maximum: 20
      },
      include_images: { 
        type: "boolean", 
        description: "Include a list of query-related images in the response",
        default: false,
      },
      include_image_descriptions: { 
        type: "boolean", 
        description: "Include a list of query-related images and their descriptions in the response",
        default: false,
      },
      include_raw_content: { 
        type: "boolean", 
        description: "Include the cleaned and parsed HTML content of each search result",
        default: false,
      },
      include_domains: {
        type: "array",
        items: { type: "string" },
        description: "A list of domains to specifically include in the search results, if the user asks to search on specific sites set this to the domain of the site",
        default: []
      },
      exclude_domains: {
        type: "array",
        items: { type: "string" },
        description: "List of domains to specifically exclude, if the user asks to exclude a domain set this to the domain of the site",
        default: []
      }
    },
    required: ["query"]
  }
};

// Helper functions
export function isTavilySearchArgs(args: unknown): args is { 
  query: string; 
  search_depth?: string;
  topic?: string;
  days?: number;
  time_range?: string;
  max_results?: number;
  include_images?: boolean;
  include_image_descriptions?: boolean;
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

/**
 * Performs a web search using the Tavily Search API
 * 
 * @param query - The search query
 * @param params - Additional search parameters
 * @param apiKey - Tavily API key
 * @returns Formatted string with search results
 */
export async function performTavilySearch(
  query: string, 
  params: {
    search_depth?: string;
    topic?: string;
    days?: number;
    time_range?: string;
    max_results?: number;
    include_images?: boolean;
    include_image_descriptions?: boolean;
    include_raw_content?: boolean;
    include_domains?: string[];
    exclude_domains?: string[];
  } = {}, 
  apiKey: string
): Promise<string> {
  const url = 'https://api.tavily.com/search';
  
  // Choose topic based on query if not specified
  const topic = params.topic || (query.toLowerCase().includes('news') ? 'news' : 'general');
  
  const searchParams = {
    api_key: apiKey,
    query,
    search_depth: params.search_depth || 'basic',
    topic,
    max_results: Math.min(params.max_results || 10, 20),
    include_images: params.include_images || false,
    include_image_descriptions: params.include_image_descriptions || false,
    include_raw_content: params.include_raw_content || false,
    include_domains: params.include_domains || [],
    exclude_domains: params.exclude_domains || []
  };
  
  // Add days parameter only for news topic
  if (topic === 'news' && params.days) {
    Object.assign(searchParams, { days: params.days });
  }
  
  // Add time_range if specified
  if (params.time_range) {
    Object.assign(searchParams, { time_range: params.time_range });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(searchParams)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as TavilySearchResponse;
  return formatSearchResults(data);
}

/**
 * Formats search results into a readable string
 * 
 * @param response - The Tavily API response
 * @returns Formatted string with search results
 */
function formatSearchResults(response: TavilySearchResponse): string {
  const output: string[] = [];

  // Include answer if available
  if (response.answer) {
    output.push(`Answer: ${response.answer}`);
    output.push('\nSources:');
    response.results.forEach(result => {
      output.push(`- ${result.title}: ${result.url}`);
    });
    output.push('');
  }

  // Format detailed search results
  output.push('Detailed Results:');
  response.results.forEach((result, index) => {
    output.push(`\n[${index + 1}] Title: ${result.title}`);
    output.push(`URL: ${result.url}`);
    output.push(`Content: ${result.content}`);
    if (result.raw_content) {
      output.push(`Raw Content: ${result.raw_content.substring(0, 300)}...`);
    }
    if (result.published_date) {
      output.push(`Published: ${result.published_date}`);
    }
    output.push(`Relevance Score: ${result.score}`);
  });

  // Include follow-up questions if available
  if (response.follow_up_questions && response.follow_up_questions.length > 0) {
    output.push('\nFollow-up Questions:');
    response.follow_up_questions.forEach((question, index) => {
      output.push(`- ${question}`);
    });
  }

  // Include images if available
  if (response.images && response.images.length > 0) {
    output.push('\nRelated Images:');
    response.images.forEach((image, index) => {
      if (typeof image === 'string') {
        output.push(`- ${image}`);
      } else {
        output.push(`- ${image.url}${image.description ? ` (${image.description})` : ''}`);
      }
    });
  }

  return output.join('\n');
}
