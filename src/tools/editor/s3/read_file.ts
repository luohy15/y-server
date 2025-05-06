import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { parseS3ApiKey, parseS3Path, generateS3Headers } from "./s3_utils";

// Type definitions
export interface S3ReadFileArgs {
  path: string;
}

// Tool definition
export const READ_FILE_TOOL: Tool = {
  name: "s3-read-file",
  description:
    "Request to read the contents of a file at the specified path. " +
    "Use this when you need to examine the contents of an existing file you do not know the contents of, " +
    "for example to analyze code, review text files, or extract information from configuration files. " +
    "Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, " +
    "as it returns the raw content as a string.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the file to read"
      }
    },
    required: ["path"]
  }
};

// Helper function for argument validation
export function isS3ReadFileArgs(args: unknown): args is S3ReadFileArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "path" in args &&
    typeof (args as S3ReadFileArgs).path === "string"
  );
}

/**
 * Reads a file from S3 storage
 * 
 * @param path - S3 file path
 * @param apiKey - S3 API key
 * @returns Content of the file
 */
export async function readS3File(path: string, apiKey: string): Promise<string> {
  // Debug: Log input parameters (with API key redacted)
  const redactedApiKey = apiKey.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`[DEBUG] Reading S3 file: 
    - Path: ${path}
    - API Key: ${redactedApiKey}
  `);
  
  try {
    // Parse API key and path
    const { accessKeyId, secretAccessKey, endpoint, bucket: defaultBucket } = parseS3ApiKey(apiKey);
    const { bucket, key } = parseS3Path(path, defaultBucket);
    
    // Debug: Log parsed bucket and key
    console.log(`[DEBUG] Parsed S3 path: 
    - Bucket: ${bucket}
    - Key: ${key}
    - Using endpoint: ${endpoint}
    `);
    
    // Generate headers
    const headers = await generateS3Headers(
      'GET',
      endpoint,
      bucket,
      key,
      accessKeyId,
      secretAccessKey
    );
    
    // Get object from S3
    const url = `${endpoint}/${bucket}/${key}`;
    
    // Debug: Log request details
    console.log(`[DEBUG] Sending S3 request:
    - Method: GET
    - URL: ${url}
    - Headers count: ${Object.keys(headers).length}
    `);
    
    // More detailed debug logging for authentication troubleshooting
    console.log(`[DEBUG] S3 request headers: ${JSON.stringify({
      ...headers,
      // Show truncated auth header to avoid exposing full signature
      'Authorization': headers['Authorization'].substring(0, 50) + '...'
    }, null, 2)}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    // Debug: Log response status
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });
    
    console.log(`[DEBUG] S3 response received:
    - Status: ${response.status} ${response.statusText}
    - Headers: ${JSON.stringify(responseHeaders)}
    `);
    
    if (!response.ok) {
      console.error(`[DEBUG] S3 request failed with status ${response.status} ${response.statusText}`);
      throw new Error(`S3 error: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`[DEBUG] Successfully read ${content.length} bytes from S3`);
    
    return content;
  } catch (error) {
    // Debug: Log error
    console.error(`[DEBUG] Error reading S3 file: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to read file from S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}
