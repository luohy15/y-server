import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { parseS3ApiKey, parseS3Path, createS3Client } from "./s3_utils";

// Type definitions
export interface S3WriteFileArgs {
  path: string;
  content: string;
}

// Tool definition
export const WRITE_TO_FILE_TOOL: Tool = {
  name: "s3-write-to-file",
  description: `Request to write content to a file at the specified path.
If the file exists, it will be overwritten with the provided content.
If the file doesn't exist, it will be created.
This tool will automatically create any directories needed to write the file.

NOTE: For existing large files where you only need to make targeted changes,
use s3-replace-in-file instead as it's more efficient and only modifies the specific
sections needed rather than rewriting the entire file content.`,
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the file to write to"
      },
      content: {
        type: "string",
        description: "The content to write to the file. Must provide the COMPLETE intended content of the file."
      }
    },
    required: ["path", "content"]
  }
};

// Helper function for argument validation
export function isS3WriteFileArgs(args: unknown): args is S3WriteFileArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "path" in args &&
    typeof (args as S3WriteFileArgs).path === "string" &&
    "content" in args &&
    typeof (args as S3WriteFileArgs).content === "string"
  );
}

/**
 * Writes content to a file in S3 storage
 * 
 * @param path - S3 file path
 * @param content - Content to write
 * @param apiKey - S3 API key
 * @returns Success message
 */
export async function writeS3File(path: string, content: string, apiKey: string): Promise<string> {
  try {
    // Parse API key and path
    const credentials = parseS3ApiKey(apiKey);
    const { bucket, key } = parseS3Path(path, credentials.bucket);
    
    // Detect content type (simplified)
    let contentType = 'text/plain';
    if (path.endsWith('.json')) contentType = 'application/json';
    else if (path.endsWith('.html')) contentType = 'text/html';
    else if (path.endsWith('.js')) contentType = 'application/javascript';
    else if (path.endsWith('.css')) contentType = 'text/css';
    
    // Create S3 client
    const s3Client = createS3Client(credentials);
    
    // Debug: Log request details
    console.log(`[DEBUG] Sending S3 PUT request:
    - Bucket: ${bucket}
    - Key: ${key}
    - Content Length: ${content.length} bytes
    - Content Type: ${contentType}
    `);
    
    // Create command
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType
    });
    
    // Execute the command
    const response = await s3Client.send(command);
    
    // Debug: Log response
    console.log(`[DEBUG] S3 response received:
    - ETag: ${response.ETag}
    - Version ID: ${response.VersionId || 'none'}
    `);
    
    console.log(`[DEBUG] Successfully wrote to S3: ${path}`);
    
    return `Successfully wrote ${content.length} bytes to ${path}`;
  } catch (error) {
    console.error(`[DEBUG] Error writing to S3: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to write file to S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}
