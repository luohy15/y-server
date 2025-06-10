import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandbox, formatError, formatResultWithSandboxInfo } from "../../../utils/e2b_utils";
import { uploadToR2 } from "../../../utils/r2_utils";
import { Env } from "../../../types/index.js";

// Type definitions
export interface ReadFileParams {
  path: string;
  sandboxId?: string; // Optional sandbox ID to resume
  upload?: boolean;
}

// Tool definition
export const READ_FILE_TOOL: Tool = {
  name: "e2b-read-file",
  description:
    "Request to read the contents of a file in a secure sandbox environment using E2B. " +
    "Use this when you need to examine the contents of an existing file in the sandbox. " +
    "All file operations are contained within the sandbox and will not affect the host system. " +
    "Supports sandbox persistence - sandbox is automatically paused after each operation and can be resumed using its ID. " +
    "Optional upload parameter allows uploading the file content to R2 storage.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the file to read"
      },
      sandboxId: {
        type: "string",
        description: "Optional ID of a paused sandbox to resume"
      },
      upload: {
        type: "boolean",
        description: "Optional settings to upload the file to R2 storage",
      }
    },
    required: ["path"]
  }
};

// Helper function for argument validation
export function isReadFileArgs(args: unknown): args is ReadFileParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("path" in args)
  ) {
    return false;
  }

  const params = args as ReadFileParams;
  
  if (typeof params.path !== "string") {
    return false;
  }

  // Validate sandboxId if provided
  if (
    params.sandboxId !== undefined && 
    typeof params.sandboxId !== "string"
  ) {
    return false;
  }

  // Validate sandboxId if provided
  if (
    params.upload !== undefined && 
    typeof params.upload !== "boolean"
  ) {
    return false;
  }

  return true;
}


/**
 * Reads file content in a secure sandbox environment using E2B
 * 
 * @param params - The read file operation parameters
 * @param apiKey - E2B API key
 * @param env - Cloudflare Worker environment, required if upload is specified
 * @returns Output from the read operation
 */
export async function readFile(
  params: ReadFileParams,
  apiKey: string,
  env?: Env
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create or resume a sandbox
    sandbox = await createSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    let result = `Reading file: ${params.path}\nSandbox ID: ${initialSandboxId}`;
    const extension = params.path.split('.').pop()?.toLowerCase() || '';
    // Upload to R2 if requested
    if (params.upload && env) {
      // Execute read operation
      const content = await sandbox.files.read(params.path, {format: "stream"});
      
      // Upload the file
      const cdnUrl = await uploadToR2(content, env, {
        prefix: 'sandbox-file',
        extension: extension,
      });
      
      // Add the CDN URL to the result
      result += `\n\nFile uploaded to CDN: ${cdnUrl}`;
    } else {
      const content: string = await sandbox.files.read(params.path, {format: "text"});
      result += formatReadResult(params.path, content);
    }
    
    // Always pause the sandbox after operation
    const pausedSandboxId = await sandbox.pause();
    
    // Add sandbox ID information to the result
    return formatResultWithSandboxInfo(result, initialSandboxId, pausedSandboxId);
  } catch (error) {
    return formatError(error);
  }
}


/**
 * Formats the result of a read operation
 * 
 * @param path - File path
 * @param content - File content
 * @returns Formatted string with the read result
 */
function formatReadResult(path: string, content: string): string {
  const output: string[] = [];
  
  output.push(`Content of ${path}:`);
  output.push(content || "(empty file)");
  
  return output.join("\n\n");
 
}
