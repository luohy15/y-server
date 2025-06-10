import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { formatError } from "./e2b_common";

// Type definitions
export interface FilesParams {
  operation: "list" | "read" | "write";
  path: string;
  content?: string; // Required for write operation
  sandboxId?: string; // Optional sandbox ID to resume
}

// Tool definition
export const FILES_TOOL: Tool = {
  name: "e2b-files",
  description: "Manages files in a secure sandbox environment using E2B. " +
    "Supports listing directories, reading file contents, and writing to files in an isolated environment. " +
    "All file operations are contained within the sandbox and will not affect the host system. " +
    "Supports sandbox persistence - sandbox is automatically paused after each operation and can be resumed using its ID.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "read", "write"],
        description: "File operation to perform"
      },
      path: {
        type: "string",
        description: "Path to the file or directory"
      },
      content: {
        type: "string",
        description: "Content to write (required for write operation)"
      },
      sandboxId: {
        type: "string",
        description: "Optional ID of a paused sandbox to resume"
      }
    },
    required: ["operation", "path"]
  },
};

// Helper function to check arguments
export function isFilesArgs(args: unknown): args is FilesParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("operation" in args) ||
    !("path" in args)
  ) {
    return false;
  }

  const params = args as FilesParams;
  
  if (
    typeof params.operation !== "string" ||
    !["list", "read", "write"].includes(params.operation) ||
    typeof params.path !== "string"
  ) {
    return false;
  }

  // Check if content is provided when operation is write
  if (
    params.operation === "write" &&
    (!params.content || typeof params.content !== "string")
  ) {
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
 * Creates and initializes an E2B sandbox or resumes an existing one
 * 
 * @param apiKey - E2B API key
 * @param sandboxId - Optional sandbox ID to resume
 * @returns Initialized sandbox instance
 */
async function getSandbox(apiKey: string, sandboxId?: string): Promise<Sandbox> {
  if (!apiKey) {
    throw new Error("API key is required for E2B sandbox");
  }

  // Create a new sandbox instance or resume an existing one
  if (sandboxId) {
    return await Sandbox.resume(sandboxId, {apiKey});
  } else {
    return await Sandbox.create({ apiKey });
  }
}

/**
 * Executes file operations in a secure sandbox environment using E2B
 * 
 * @param params - The file operation parameters
 * @param apiKey - E2B API key
 * @returns Output from the file operation
 */
export async function executeFileOperation(
  params: FilesParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create or resume a sandbox
    sandbox = await getSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    // Execute file operation and get result
    let result: string;
    
    switch (params.operation) {
      case "list": {
        const files = await sandbox.files.list(params.path);
        result = formatListResult(params.path, files);
        break;
      }
      
      case "read": {
        const content = await sandbox.files.read(params.path);
        result = formatReadResult(params.path, content);
        break;
      }
      
      case "write": {
        if (!params.content) {
          throw new Error("Content is required for write operation");
        }
        await sandbox.files.write(params.path, params.content);
        result = formatWriteResult(params.path);
        break;
      }
      
      default:
        throw new Error(`Unsupported file operation: ${params.operation}`);
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
 * Formats the result with sandbox ID information
 * 
 * @param result - The operation result
 * @param initialSandboxId - The initial sandbox ID
 * @param pausedSandboxId - The sandbox ID after pausing
 * @returns Formatted result with sandbox information
 */
function formatResultWithSandboxInfo(
  result: string,
  initialSandboxId: string,
  pausedSandboxId: string
): string {
  const sandboxInfo = [
    `Initial Sandbox ID: ${initialSandboxId}`,
    `Sandbox paused with ID: ${pausedSandboxId}`,
    "This ID can be used to resume the sandbox later."
  ];
  
  return `${result}\n\n${sandboxInfo.join("\n")}`;
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

/**
 * Formats the result of a write operation
 * 
 * @param path - File path
 * @returns Formatted string with the write result
 */
function formatWriteResult(path: string): string {
  return `Successfully wrote to file: ${path}`;
}
