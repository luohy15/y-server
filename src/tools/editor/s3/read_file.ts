import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { parseS3ApiKey, parseS3Path, createS3Client } from "./s3_utils";

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
    const credentials = parseS3ApiKey(apiKey);
    const { bucket, key } = parseS3Path(path, credentials.bucket);
    
    // Debug: Log parsed bucket and key
    console.log(`[DEBUG] Parsed S3 path: 
    - Bucket: ${bucket}
    - Key: ${key}
    - Using endpoint: ${credentials.endpoint}
    `);
    
    // Create S3 client
    const s3Client = createS3Client(credentials);
    
    // Create GetObject command
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    // Debug: Log request details
    console.log(`[DEBUG] Sending S3 GetObject request:
    - Bucket: ${bucket}
    - Key: ${key}
    `);
    
    // Execute the command
    const response = await s3Client.send(command);
    
    // Log response details
    console.log(`[DEBUG] S3 response received:
    - Content Type: ${response.ContentType}
    - Content Length: ${response.ContentLength}
    - ETag: ${response.ETag}
    `);
    
    // Convert stream to string
    if (!response.Body) {
      throw new Error('Response body is empty');
    }
    
    const streamReader = response.Body.transformToWebStream();
    const reader = streamReader.getReader();
    const chunks: Uint8Array[] = [];
    
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        chunks.push(value);
      }
    }
    
    const allChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let position = 0;
    
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }
    
    const content = new TextDecoder().decode(allChunks);
    console.log(`[DEBUG] Successfully read ${content.length} bytes from S3`);
    
    return content;
  } catch (error) {
    // Debug: Log error
    console.error(`[DEBUG] Error reading S3 file: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to read file from S3: ${error instanceof Error ? error.message : String(error)}`);
  }
}
