import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Type definitions
export interface FirecrawlScrapeParams {
  url: string;
  formats?: string[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  timeout?: number;
  actions?: Array<{
    type: 'wait' | 'click' | 'screenshot' | 'write' | 'press' | 'scroll' | 'scrape' | 'executeJavascript';
    selector?: string;
    milliseconds?: number;
    text?: string;
    key?: string;
    direction?: 'up' | 'down';
    script?: string;
    fullPage?: boolean;
  }>;
  extract?: {
    schema?: object;
    systemPrompt?: string;
    prompt?: string;
  };
  mobile?: boolean;
  skipTlsVerification?: boolean;
  removeBase64Images?: boolean;
  location?: {
    country?: string;
    languages?: string[];
  };
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    screenshot?: string;
    extract?: any;
    metadata?: {
      title?: string;
      description?: string;
      favicon?: string;
      scrapeId?: string;
      sourceURL?: string;
      url?: string;
      statusCode?: number;
      [key: string]: any;
    };
  };
  warning?: string;
  error?: string;
}

// Tool definition
export const SCRAPE_TOOL: Tool = {
  name: "firecrawl-scrape",
  description:
    "Scrape a single webpage with advanced options for content extraction. " +
    "Supports various formats including markdown, HTML, and screenshots. " +
    "Can execute custom actions like clicking or scrolling before scraping.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to scrape",
      },
      formats: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "markdown",
            "html",
            "rawHtml",
            "screenshot",
            "links",
            "screenshot@fullPage",
            "extract",
          ],
        },
        default: ["markdown"],
        description: "Content formats to extract (default: ['markdown'])",
      },
      onlyMainContent: {
        type: "boolean",
        description:
          "Extract only the main content, filtering out navigation, footers, etc.",
      },
      includeTags: {
        type: "array",
        items: { type: "string" },
        description: "HTML tags to specifically include in extraction",
      },
      excludeTags: {
        type: "array",
        items: { type: "string" },
        description: "HTML tags to exclude from extraction",
      },
      waitFor: {
        type: "number",
        description: "Time in milliseconds to wait for dynamic content to load",
      },
      timeout: {
        type: "number",
        description:
          "Maximum time in milliseconds to wait for the page to load",
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "wait",
                "click",
                "screenshot",
                "write",
                "press",
                "scroll",
                "scrape",
                "executeJavascript",
              ],
              description: "Type of action to perform",
            },
            selector: {
              type: "string",
              description: "CSS selector for the target element",
            },
            milliseconds: {
              type: "number",
              description: "Time to wait in milliseconds (for wait action)",
            },
            text: {
              type: "string",
              description: "Text to write (for write action)",
            },
            key: {
              type: "string",
              description: "Key to press (for press action)",
            },
            direction: {
              type: "string",
              enum: ["up", "down"],
              description: "Scroll direction",
            },
            script: {
              type: "string",
              description: "JavaScript code to execute",
            },
            fullPage: {
              type: "boolean",
              description: "Take full page screenshot",
            },
          },
          required: ["type"],
        },
        description: "List of actions to perform before scraping",
      },
      extract: {
        type: "object",
        properties: {
          schema: {
            type: "object",
            description: "Schema for structured data extraction",
          },
          systemPrompt: {
            type: "string",
            description: "System prompt for LLM extraction",
          },
          prompt: {
            type: "string",
            description: "User prompt for LLM extraction",
          },
        },
        description: "Configuration for structured data extraction",
      },
      mobile: {
        type: "boolean",
        description: "Use mobile viewport",
      },
      skipTlsVerification: {
        type: "boolean",
        description: "Skip TLS certificate verification",
      },
      removeBase64Images: {
        type: "boolean",
        description: "Remove base64 encoded images from output",
      },
      location: {
        type: "object",
        properties: {
          country: {
            type: "string",
            description: "Country code for geolocation",
          },
          languages: {
            type: "array",
            items: { type: "string" },
            description: "Language codes for content",
          },
        },
        description: "Location settings for scraping",
      },
    },
    required: ["url"],
  },
};

// Helper functions
export function isFirecrawlScrapeArgs(args: unknown): args is FirecrawlScrapeParams {
  return (
    typeof args === "object" &&
    args !== null &&
    "url" in args &&
    typeof (args as { url: unknown }).url === "string"
  );
}

/**
 * Performs a web scrape using the Firecrawl API
 * 
 * @param params - The scrape parameters
 * @param apiKey - Firecrawl API key
 * @returns Formatted string with scrape results
 */
export async function performFirecrawlScrape(
  params: FirecrawlScrapeParams,
  apiKey: string
): Promise<string> {
  const url = 'https://api.firecrawl.dev/v1/scrape';
  
  const requestBody = {
    ...params,
    // Default to markdown if formats not specified
    formats: params.formats || ['markdown'],
    // Add origin metadata
    origin: 'y-server'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json() as FirecrawlScrapeResponse;
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Scraping failed with no specific error message');
    }

    return formatScrapeResults(responseData, params.formats || ['markdown']);
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return `Unknown error occurred during scraping`;
  }
}

/**
 * Formats scrape results into a readable string
 * 
 * @param response - The Firecrawl API response
 * @param requestedFormats - The formats that were requested
 * @returns Formatted string with scrape results
 */
function formatScrapeResults(response: FirecrawlScrapeResponse, requestedFormats: string[]): string {
  const output: string[] = [];
  const data = response.data || {};

  // Add warning if present
  if (response.warning) {
    output.push(`Warning: ${response.warning}\n`);
  }

  // Format content based on requested formats
  if (requestedFormats.includes('markdown') && data.markdown) {
    output.push('## Markdown Content:');
    output.push(data.markdown);
    output.push('');
  }

  if (requestedFormats.includes('html') && data.html) {
    output.push('## HTML Content:');
    output.push('```html');
    output.push(data.html);
    output.push('```');
    output.push('');
  }

  if (requestedFormats.includes('rawHtml') && data.rawHtml) {
    output.push('## Raw HTML Content:');
    output.push('```html');
    output.push(data.rawHtml);
    output.push('```');
    output.push('');
  }

  if (requestedFormats.includes('links') && data.links && data.links.length > 0) {
    output.push('## Links:');
    data.links.forEach((link) => {
      output.push(`- ${link}`);
    });
    output.push('');
  }

  if ((requestedFormats.includes('screenshot') || requestedFormats.includes('screenshot@fullPage')) && data.screenshot) {
    output.push('## Screenshot:');
    output.push(data.screenshot);
    output.push('');
  }

  if (requestedFormats.includes('extract') && data.extract) {
    output.push('## Extracted Data:');
    output.push('```json');
    output.push(JSON.stringify(data.extract, null, 2));
    output.push('```');
  }

  // Add metadata if available
  if (data.metadata) {
    output.push('## Metadata:');
    output.push('```json');
    output.push(JSON.stringify(data.metadata, null, 2));
    output.push('```');
    output.push('');
  }

  // If no content was found for any of the requested formats
  if (output.length === (response.warning ? 1 : 0)) {
    output.push('No content was retrieved for the requested formats.');
  }

  return output.join('\n');
}
