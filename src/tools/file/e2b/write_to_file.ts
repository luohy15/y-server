import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";

// Type definitions
export interface WriteFileParams {
  path: string;
  content: string;
  sandboxId?: string; // Optional sandbox ID to resume
}

// Tool definition
export const WRITE_TO_FILE_TOOL: Tool = {
  name: "e2b-write-to-file",
  description: 
    "Request to write content to a file in a secure sandbox environment using E2B. " +
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
        description: "The content to write to the file. Must provide the COMPLETE intended content of the file."
      },
      sandboxId: {
        type: "string",
        description: "Optional ID of a paused sandbox to resume"
      }
    },
    required: ["path", "content"]
  }
};

// Helper function for argument validation
export function isWriteFileArgs(args: unknown): args is WriteFileParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("path" in args) ||
    !("content" in args)
  ) {
    return false;
  }

  const params = args as WriteFileParams;
  
  if (
    typeof params.path !== "string" ||
    typeof params.content !== "string"
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
    sandbox = await getSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    // Execute write operation
    await sandbox.files.write(params.path, params.content);
    const result = formatWriteResult(params.path);
    
    // Always pause the sandbox after operation
    const pausedSandboxId = await sandbox.pause();
    
    // Add sandbox ID information to the result
    return formatResultWithSandboxInfo(result, initialSandboxId, pausedSandboxId);
  } catch (error) {
    return `Error in E2B sandbox: ${error instanceof Error ? error.message : String(error)}`;
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
 * Formats the result of a write operation
 * 
 * @param path - File path
 * @returns Formatted string with the write result
 */
function formatWriteResult(path: string): string {
  return `Successfully wrote to file: ${path}`;
}
