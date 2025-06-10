import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";

// Type definitions
export interface ReadFileParams {
  path: string;
  sandboxId?: string; // Optional sandbox ID to resume
}

// Tool definition
export const READ_FILE_TOOL: Tool = {
  name: "e2b-read-file",
  description:
    "Request to read the contents of a file in a secure sandbox environment using E2B. " +
    "Use this when you need to examine the contents of an existing file in the sandbox. " +
    "All file operations are contained within the sandbox and will not affect the host system. " +
    "Supports sandbox persistence - sandbox is automatically paused after each operation and can be resumed using its ID.",
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
 * Reads file content in a secure sandbox environment using E2B
 * 
 * @param params - The read file operation parameters
 * @param apiKey - E2B API key
 * @returns Output from the read operation
 */
export async function readFile(
  params: ReadFileParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create or resume a sandbox
    sandbox = await getSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    // Execute read operation
    const content = await sandbox.files.read(params.path);
    const result = formatReadResult(params.path, content);
    
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
