import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandbox, formatError, formatResultWithSandboxInfo } from "../../../utils/e2b_utils";

// Type definitions
export interface ListFilesParams {
  path: string;
  sandboxId?: string; // Optional sandbox ID to resume
}

// Tool definition
export const LIST_FILES_TOOL: Tool = {
  name: "e2b-list-files",
  description: "Lists files and directories in a secure sandbox environment using E2B. " +
    "All file operations are contained within the sandbox and will not affect the host system. " +
    "Supports sandbox persistence - sandbox is automatically paused after each operation and can be resumed using its ID.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the directory to list"
      },
      sandboxId: {
        type: "string",
        description: "Optional ID of a paused sandbox to resume"
      }
    },
    required: ["path"]
  },
};

// Helper function to check arguments
export function isListFilesArgs(args: unknown): args is ListFilesParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("path" in args)
  ) {
    return false;
  }

  const params = args as ListFilesParams;
  
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

  return true;
}


/**
 * Lists files in a directory in a secure sandbox environment using E2B
 * 
 * @param params - The list files operation parameters
 * @param apiKey - E2B API key
 * @returns Output from the list operation
 */
export async function listFiles(
  params: ListFilesParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create or resume a sandbox
    sandbox = await createSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    // Execute list operation
    const files = await sandbox.files.list(params.path);
    const result = formatListResult(params.path, files);
    
    // Always pause the sandbox after operation
    const pausedSandboxId = await sandbox.pause();
    
    // Add sandbox ID information to the result
    return formatResultWithSandboxInfo(result, initialSandboxId, pausedSandboxId);
  } catch (error) {
    return formatError(error);
  }
}


/**
 * Formats the result of a list operation
 * 
 * @param path - Directory path
 * @param files - Array of files/directories
 * @returns Formatted string with the list result
 */
function formatListResult(path: string, files: any[]): string {
  const output: string[] = [];
  
  output.push(`Files in ${path}:`);
  
  if (files.length === 0) {
    output.push("No files found");
  } else {
    const formattedList = files.map(file => {
      const type = file.type === "directory" ? "[DIR]" : "[FILE]";
      return `${type} ${file.name}`;
    }).join("\n");
    
    output.push(formattedList);
  }
  
  return output.join("\n\n");
}
