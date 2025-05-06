import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { BraveWeb, performWebSearch } from "./brave_web_search";

// Type definitions
export interface BraveLocation {
  id: string;
  name: string;
  address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  openingHours?: string[];
  priceRange?: string;
}

export interface BravePoiResponse {
  results: BraveLocation[];
}

export interface BraveDescription {
  descriptions: {[id: string]: string};
}

// Tool definition
export const LOCAL_SEARCH_TOOL: Tool = {
  name: "brave-local-search",
  description:
    "Searches for local businesses and places using Brave's Local Search API. " +
    "Best for queries related to physical locations, businesses, restaurants, services, etc. " +
    "Returns detailed information including:\n" +
    "- Business names and addresses\n" +
    "- Ratings and review counts\n" +
    "- Phone numbers and opening hours\n" +
    "Use this when the query implies 'near me' or mentions specific locations. " +
    "Automatically falls back to web search if no local results are found.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Local search query (e.g. 'pizza near Central Park')"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 5)",
        default: 5
      },
    },
    required: ["query"]
  }
};

// Helper functions
export function isBraveLocalSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

/**
 * Performs a local search for businesses and places using Brave's Local Search API
 * 
 * @param query - The search query for local businesses or places
 * @param count - Number of results to return (max 20)
 * @param apiKey - Brave API key
 * @returns Formatted string with search results
 */
export async function performLocalSearch(query: string, count: number = 5, apiKey: string): Promise<string> {
  const webUrl = new URL('https://api.search.brave.com/res/v1/web/search');
  webUrl.searchParams.set('q', query);
  webUrl.searchParams.set('search_lang', 'en');
  webUrl.searchParams.set('result_filter', 'locations');
  webUrl.searchParams.set('count', Math.min(count, 20).toString());

  const webResponse = await fetch(webUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!webResponse.ok) {
    throw new Error(`Brave API error: ${webResponse.status} ${webResponse.statusText}`);
  }

  const webData = await webResponse.json() as BraveWeb;
  const locationIds = webData.locations?.results?.filter((r): r is {id: string; title?: string} => r.id != null).map(r => r.id) || [];

  if (locationIds.length === 0) {
    return performWebSearch(query, count, apiKey);
  }

  const [poisData, descriptionsData] = await Promise.all([
    getPoisData(locationIds, apiKey),
    getDescriptionsData(locationIds, apiKey)
  ]);

  return formatLocalResults(poisData, descriptionsData);
}

/**
 * Fetches detailed POI (Points of Interest) data from Brave API
 * 
 * @param ids - Array of location IDs to fetch
 * @param apiKey - Brave API key
 * @returns POI response data
 */
async function getPoisData(ids: string[], apiKey: string): Promise<BravePoiResponse> {
  const url = new URL('https://api.search.brave.com/res/v1/local/pois');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as BravePoiResponse;
}

/**
 * Fetches descriptions for locations from Brave API
 * 
 * @param ids - Array of location IDs to fetch descriptions for
 * @param apiKey - Brave API key
 * @returns Description data
 */
async function getDescriptionsData(ids: string[], apiKey: string): Promise<BraveDescription> {
  const url = new URL('https://api.search.brave.com/res/v1/local/descriptions');
  ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  return await response.json() as BraveDescription;
}

/**
 * Formats local search results into a readable string
 * 
 * @param poisData - POI data from Brave API
 * @param descData - Description data from Brave API
 * @returns Formatted string with local search results
 */
function formatLocalResults(poisData: BravePoiResponse, descData: BraveDescription): string {
  return (poisData.results || []).map(poi => {
    const address = [
      poi.address?.streetAddress ?? '',
      poi.address?.addressLocality ?? '',
      poi.address?.addressRegion ?? '',
      poi.address?.postalCode ?? ''
    ].filter(part => part !== '').join(', ') || 'N/A';

    return `Name: ${poi.name}
Address: ${address}
Phone: ${poi.phone || 'N/A'}
Rating: ${poi.rating?.ratingValue ?? 'N/A'} (${poi.rating?.ratingCount ?? 0} reviews)
Price Range: ${poi.priceRange || 'N/A'}
Hours: ${(poi.openingHours || []).join(', ') || 'N/A'}
Description: ${descData.descriptions[poi.id] || 'No description available'}
`;
  }).join('\n---\n') || 'No local results found';
}
