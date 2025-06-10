import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Env } from "../../../types/index.js";
import { uploadToR2 } from "../../../utils/r2_utils.js";

// Type definitions
export interface AlphavantageFXParams {
  function: string;
  from_symbol?: string;
  to_symbol?: string;
  from_currency?: string;
  to_currency?: string;
  interval?: string;
  outputsize?: string;
}

// Tool definition
export const ALPHAVANTAGE_FOREX_TOOL: Tool = {
  name: "alphavantage-forex-data",
  description: "Fetch forex (FX) data from Alpha Vantage API, including real-time and historical exchange rates.",
  inputSchema: {
    type: "object",
    properties: {
      function: {
        type: "string",
        description: "The Alpha Vantage API function to call (FX_INTRADAY, FX_DAILY, FX_WEEKLY, FX_MONTHLY, CURRENCY_EXCHANGE_RATE)",
        enum: ["FX_INTRADAY", "FX_DAILY", "FX_WEEKLY", "FX_MONTHLY", "CURRENCY_EXCHANGE_RATE"]
      },
      from_symbol: {
        type: "string",
        description: "The three-letter symbol for the source currency (required for FX_* functions)"
      },
      to_symbol: {
        type: "string", 
        description: "The three-letter symbol for the destination currency (required for FX_* functions)"
      },
      from_currency: {
        type: "string",
        description: "The source currency (required for CURRENCY_EXCHANGE_RATE function)"
      },
      to_currency: {
        type: "string",
        description: "The destination currency (required for CURRENCY_EXCHANGE_RATE function)"
      },
      interval: {
        type: "string",
        description: "Time interval between data points (1min, 5min, 15min, 30min, 60min) - required for FX_INTRADAY",
        enum: ["1min", "5min", "15min", "30min", "60min"]
      },
      outputsize: {
        type: "string",
        description: "Amount of data to return (compact = latest 100 points, full = all data points)",
        enum: ["compact", "full"]
      }
    },
    required: ["function"],
  }
};

// Helper function to check arguments
export function isAlphavantageForexArgs(args: unknown): args is AlphavantageFXParams {
  if (typeof args !== "object" || args === null) {
    return false;
  }

  const typedArgs = args as Partial<AlphavantageFXParams>;
  
  // Check required fields
  if (typeof typedArgs.function !== "string") {
    return false;
  }

  // Function-specific validations
  if (typedArgs.function === "CURRENCY_EXCHANGE_RATE") {
    return typeof typedArgs.from_currency === "string" && typeof typedArgs.to_currency === "string";
  } else if (["FX_INTRADAY", "FX_DAILY", "FX_WEEKLY", "FX_MONTHLY"].includes(typedArgs.function)) {
    if (typeof typedArgs.from_symbol !== "string" || typeof typedArgs.to_symbol !== "string") {
      return false;
    }
    
    // Check interval is provided for FX_INTRADAY
    if (typedArgs.function === "FX_INTRADAY" && typeof typedArgs.interval !== "string") {
      return false;
    }
  } else {
    return false; // Invalid function
  }

  // Optional fields validation
  if (typedArgs.outputsize !== undefined && 
      typeof typedArgs.outputsize === "string" && 
      !["compact", "full"].includes(typedArgs.outputsize)) {
    return false;
  }

  return true;
}

/**
 * Fetches forex data from Alpha Vantage API
 * For responses with up to 300 lines, returns the content directly
 * For larger responses, uploads to R2 storage and returns the URL
 * 
 * @param params - The Alpha Vantage API parameters
 * @param apiKey - Alpha Vantage API key
 * @param env - Cloudflare Worker environment for R2 storage
 * @returns Either the data content (if ≤300 lines) or a URL to the uploaded file
 */
export async function fetchAlphavantageFXData(
  params: AlphavantageFXParams,
  apiKey: string,
  env?: Env
): Promise<string> {
  try {
    // Construct the API URL
    const baseUrl = "https://www.alphavantage.co/query";
    const urlParams = new URLSearchParams();
    
    // Add required parameters
    urlParams.append("function", params.function);
    urlParams.append("apikey", apiKey);
    
    // Always set datatype to CSV
    urlParams.append("datatype", "csv");
    
    // Add function-specific parameters
    if (params.function === "CURRENCY_EXCHANGE_RATE") {
      urlParams.append("from_currency", params.from_currency!);
      urlParams.append("to_currency", params.to_currency!);
    } else {
      urlParams.append("from_symbol", params.from_symbol!);
      urlParams.append("to_symbol", params.to_symbol!);
      
      if (params.function === "FX_INTRADAY") {
        urlParams.append("interval", params.interval!);
      }
      
      if (params.outputsize) {
        urlParams.append("outputsize", params.outputsize);
      }
    }
    
    // Fetch CSV data
    const apiUrl = `${baseUrl}?${urlParams.toString()}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
    }
    
    // Get the CSV text
    const csvText = await response.text();
    
    // Check if there's an error message in the response
    // Alpha Vantage might return error messages in CSV format too
    if (csvText.includes("Error Message") || csvText.includes("Information:")) {
      return csvText; // Return the error message directly
    }
   
    // For larger datasets, upload to R2 and return URL
    if (!env || !env.CDN_BUCKET) {
      // If R2 storage is not available, return the CSV URL
      return apiUrl;
    }
    
    // Generate filename based on function and symbols
    let prefix = "alphavantage-";
    if (params.function === "CURRENCY_EXCHANGE_RATE") {
      prefix += `${params.from_currency}-${params.to_currency}`;
    } else {
      prefix += `${params.function}-${params.from_symbol}-${params.to_symbol}`;
    }
    
    // Upload to R2 and get URL
    const fileUrl = await uploadToR2(csvText, env, {
      prefix,
      extension: "csv"
    });
    
    return fileUrl;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
