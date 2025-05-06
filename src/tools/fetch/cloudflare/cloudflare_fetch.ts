import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Env } from "../../../types/index.js";

// Type definitions
export interface CloudflareFetchParams {
  url: string;
}

// Tool definition
export const CLOUDFLARE_FETCH_TOOL: Tool = {
  name: "fetch",
  description: "Fetch text content from a webpage using Cloudflare Browser Rendering API.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch content from",
      }
    },
    required: ["url"],
  },
};

// Helper function to check arguments
export function isCloudfareFetchArgs(args: unknown): args is CloudflareFetchParams {
  return (
    typeof args === "object" &&
    args !== null &&
    "url" in args &&
    typeof (args as { url: unknown }).url === "string"
  );
}

/**
 * Fetches text content from a webpage using Cloudflare Browser Rendering API
 * 
 * @param params - The fetch parameters (just URL)
 * @param env - Cloudflare Worker environment
 * @returns Text content from the webpage including the source URL
 */
export async function performCloudfareFetch(
  params: CloudflareFetchParams,
  env?: Env
): Promise<string> {
  if (!env?.CLOUDFLARE_BROWSER_RENDER_API_TOKEN) {
    return "Error: Cloudflare API token not available";
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.CLOUDFLARE_BROWSER_RENDER_API_TOKEN}`,
        },
        body: JSON.stringify({
          url: params.url,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; result: string; errors?: Array<{ message: string }> };
    
    if (!data.success) {
      throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || "Unknown error"}`);
    }

    // Format the response with the URL included
    return formatCloudflareResponse(data.result, params.url);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

/**
 * Formats the Cloudflare Browser Rendering API response
 * 
 * @param result - The API response result
 * @param url - The original URL that was fetched
 * @returns Formatted string including the URL and content
 */
function formatCloudflareResponse(result: any, url: string): string {
  const output: string[] = [];

  // Add the source URL
  output.push(`Source URL: ${url}\n`);

  // Add the content
  if (result && typeof result === "string") {
    output.push(result);
  } else {
    output.push("No content retrieved from the webpage.");
  }

  return output.join("\n");
}
