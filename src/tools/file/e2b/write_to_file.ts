import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { downloadFromUrl } from "../../../utils/file_utils";
import { createSandbox, formatError, formatResultWithSandboxInfo } from "../../../utils/e2b_utils";

// Type definitions
export interface WriteFileParams {
  path: string;
  content?: string;
  url?: string;
  sandboxId?: string; // Optional sandbox ID to resume
}

// Tool definition
export const WRITE_TO_FILE_TOOL: Tool = {
  name: "e2b-write-to-file",
  description: 
    "Request to write content to a file in a secure sandbox environment using E2B. " +
    "Content can be provided directly or downloaded from a URL (supporting both text and binary files). " +
    "If the file exists, it will be overwritten with the provided content. " +
    "If the file doesn't exist, it will be created. " +
    "All file operations are contained within the sandbox and will not affect the host system. " +
    "Supports sandbox persistence - sandbox is automatically paused after each operation and can be resumed using its ID.",
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
      },
      sandboxId: {
        type: "string",
        description: "Optional ID of a paused sandbox to resume"
      }
    },
    required: ["path"]
  }
};

// Helper function for argument validation
export function isWriteFileArgs(args: unknown): args is WriteFileParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("path" in args) ||
    (!("content" in args) && !("url" in args))
  ) {
    return false;
  }

  const params = args as WriteFileParams;
  
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

  // Validate sandboxId if provided
  if (
    params.sandboxId !== undefined && 
    typeof params.sandboxId !== "string"
  ) {
    return false;
  }

  return true;
}



/**
 * Writes content to a file in a secure sandbox environment using E2B
 * 
 * @param params - The write file operation parameters
 * @param apiKey - E2B API key
 * @returns Output from the write operation
 */
export async function writeFile(
  params: WriteFileParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create or resume a sandbox
    sandbox = await createSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    // Execute write operation based on source (direct content or URL)
    if (params.url) {
      // Download content from URL as ArrayBuffer
      const downloadedContent = await downloadFromUrl(params.url);
      
      // Write the downloaded content to the file
      // The files.write method accepts ArrayBuffer directly
      await sandbox.files.write(params.path, downloadedContent);
    } else if (params.content) {
      // Write direct string content
      await sandbox.files.write(params.path, params.content);
    } else {
      // This should never happen due to validation, but added as a safeguard
      throw new Error("Either content or url must be provided");
    }
    
    const result = formatWriteResult(params.path);
    
    // Always pause the sandbox after operation
    const pausedSandboxId = await sandbox.pause();
    
    // Add sandbox ID information to the result
    return formatResultWithSandboxInfo(result, initialSandboxId, pausedSandboxId);
  } catch (error) {
    return formatError(error);
  }
}


/**
 * Formats the result of a write operation
 * 
 * @param path - File path
 * @returns Formatted string with the write result
 */
function formatWriteResult(path: string): string {
  return `Successfully wrote to file: ${path}`;
}
