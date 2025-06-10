import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { parseS3ApiKey, parseS3Path, createS3Client } from "../../../utils/s3_utils";
import { downloadFromUrl } from "../../../utils/file_utils";

// Type definitions
export interface S3WriteFileArgs {
  path: string;
  content?: string;
  url?: string;
}

// Tool definition
export const WRITE_TO_FILE_TOOL: Tool = {
  name: "s3-write-to-file",
  description: `Request to write content to a file at the specified path.
Content can be provided directly or downloaded from a URL (supporting both text and binary files).
If the file exists, it will be overwritten with the provided content.
If the file doesn't exist, it will be created.
This tool will automatically create any directories needed to write the file.

NOTE: For existing large files where you only need to make targeted changes,
use s3-edit-file instead as it's more efficient and only modifies the specific
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
        description: "The content to write to the file. Must provide the COMPLETE intended content of the file. Either content or url must be provided."
      },
      url: {
        type: "string",
        description: "URL to download content from. The content will be downloaded and saved to the specified path. Supports both text and binary files. Either content or url must be provided."
      }
    },
    required: ["path"]
  }
};

// Helper function for argument validation
export function isS3WriteFileArgs(args: unknown): args is S3WriteFileArgs {
  if (
    typeof args !== "object" ||
    args === null ||
    !("path" in args) ||
    (!("content" in args) && !("url" in args))
  ) {
    return false;
  }

  const params = args as S3WriteFileArgs;
  
  if (typeof params.path !== "string") {
    return false;
  }

  // Either content or url must be provided, but not both
  if (params.content !== undefined && params.url !== undefined) {
    return false;
  }

  if (params.content !== undefined && typeof params.content !== "string") {
    return false;
  }

  if (params.url !== undefined && typeof params.url !== "string") {
    return false;
  }

  return true;
}


/**
 * Writes content to a file in S3 storage
 * 
 * @param path - S3 file path
 * @param content - Content to write or undefined if using URL
 * @param apiKey - S3 API key
 * @param url - Optional URL to download content from
 * @returns Success message
 */
export async function writeS3File(
  path: string, 
  content: string | undefined, 
  apiKey: string,
  url?: string
): Promise<string> {
  try {
    // Parse API key and path
    const credentials = parseS3ApiKey(apiKey);
    const { bucket, key } = parseS3Path(path, credentials.bucket);
    
    // Create S3 client
    const s3Client = createS3Client(credentials);
    
    // Handle content from URL if provided
    let contentToUpload: string | ArrayBuffer;
    
    if (url) {
      // Download content from URL
      const downloadedContent = await downloadFromUrl(url);
      // Use ArrayBuffer directly
      contentToUpload = downloadedContent;
    } else if (content) {
      contentToUpload = content;
    } else {
      throw new Error("Either content or url must be provided");
    }
    
    // Debug: Log request details
    console.log(`[DEBUG] Sending S3 PUT request:
    - Bucket: ${bucket}
    - Key: ${key}
    - Content Length: ${typeof contentToUpload === 'string' ? contentToUpload.length : contentToUpload.byteLength} bytes
    `);
    
    // Create command
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: contentToUpload
    });
    
    // Execute the command
    const response = await s3Client.send(command);
    
    // Debug: Log response
    console.log(`[DEBUG] S3 response received:
    - ETag: ${response.ETag}
    - Version ID: ${response.VersionId || 'none'}
    `);
    
    console.log(`[DEBUG] Successfully wrote to S3: ${path}`);
    
    const contentLength = typeof contentToUpload === 'string' 
      ? contentToUpload.length 
      : contentToUpload.byteLength;
      
    return `Successfully wrote ${contentLength} bytes to ${path}`;
  } catch (error) {
    console.error(`[DEBUG] Error writing to S3: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to write file to S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}
