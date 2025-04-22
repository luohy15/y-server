import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Type definitions
export interface TavilyExtractResponse {
  results: Array<{
    title?: string;
    url: string;
    content: string;
    images?: Array<string>;
  }>;
}

// Tool definition
export const EXTRACT_TOOL: Tool = {
  name: "tavily_extract",
  description:
    "A powerful web content extraction tool that retrieves and processes raw content from specified URLs, " +
    "ideal for data collection, content analysis, and research tasks.",
  inputSchema: {
    type: "object",
    properties: {
      urls: { 
        type: "array",
        items: { type: "string" },
        description: "List of URLs to extract content from"
      },
      extract_depth: { 
        type: "string",
        enum: ["basic","advanced"],
        description: "Depth of extraction - 'basic' or 'advanced', if URLs are LinkedIn use 'advanced' or if explicitly told to use advanced",
        default: "basic"
      },
      include_images: { 
        type: "boolean", 
        description: "Include a list of images extracted from the URLs in the response",
        default: false,
      }
    },
    required: ["urls"]
  }
};

// Helper functions
export function isTavilyExtractArgs(args: unknown): args is { 
  urls: string[]; 
  extract_depth?: string;
  include_images?: boolean;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "urls" in args &&
    Array.isArray((args as { urls: string[] }).urls) &&
    (args as { urls: string[] }).urls.length > 0 &&
    (args as { urls: string[] }).urls.every(url => typeof url === "string")
  );
}

/**
 * Extracts content from URLs using the Tavily Extract API
 * 
 * @param urls - Array of URLs to extract content from
 * @param params - Additional extract parameters
 * @param apiKey - Tavily API key
 * @returns Formatted string with extraction results
 */
export async function performTavilyExtract(
  urls: string[], 
  params: {
    extract_depth?: string;
    include_images?: boolean;
  } = {}, 
  apiKey: string
): Promise<string> {
  const url = 'https://api.tavily.com/extract';
  
  // Determine if any URL is LinkedIn to suggest advanced depth
  const containsLinkedIn = urls.some(u => u.includes('linkedin.com'));
  const defaultDepth = containsLinkedIn ? 'advanced' : 'basic';
  
  const extractParams = {
    api_key: apiKey,
    urls,
    extract_depth: params.extract_depth || defaultDepth,
    include_images: params.include_images || false
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(extractParams)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as TavilyExtractResponse;
  return formatExtractResults(data);
}

/**
 * Formats extraction results into a readable string
 * 
 * @param response - The Tavily API response
 * @returns Formatted string with extraction results
 */
function formatExtractResults(response: TavilyExtractResponse): string {
  const output: string[] = [];

  output.push(`Extracted Content from ${response.results.length} URL(s):\n`);
  
  response.results.forEach((result, index) => {
    output.push(`\n[Document ${index + 1}]`);
    if (result.title) {
      output.push(`Title: ${result.title}`);
    }
    output.push(`URL: ${result.url}`);
    output.push(`\nContent:\n${result.content}\n`);
    
    // Include images if available
    if (result.images && result.images.length > 0) {
      output.push('\nImages:');
      result.images.forEach((image, i) => {
        output.push(`- ${image}`);
      });
    }
    
    // Add separator between results
    if (index < response.results.length - 1) {
      output.push('\n-------------------------------------------\n');
    }
  });

  return output.join('\n');
}
