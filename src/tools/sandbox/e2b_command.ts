import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandbox, formatError, formatResultWithSandboxInfo } from "../../utils/e2b_utils";

// Type definitions for command execution
export interface CommandParams {
  command: string;
  sandboxId?: string; // Optional sandbox ID to resume
}

// Tool definition for command execution
export const COMMAND_TOOL: Tool = {
  name: "e2b-command",
  description: "Executes shell commands in a secure sandbox environment using E2B. " +
    "Provides an isolated runtime for running terminal commands safely. " +
    "Use this for file operations, installing packages, or running CLI tools in a controlled environment. " +
    "Supports sandbox persistence - sandbox is automatically paused after each operation and can be resumed using its ID.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute"
      },
      sandboxId: {
        type: "string",
        description: "Optional ID of a paused sandbox to resume"
      }
    },
    required: ["command"]
  },
};

// Helper function to check arguments for command tool
export function isCommandArgs(args: unknown): args is CommandParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("command" in args)
  ) {
    return false;
  }

  const params = args as CommandParams;
  
  if (typeof params.command !== "string") {
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
 * Executes a shell command in a secure sandbox environment using E2B
 * 
 * @param params - The command parameters
 * @param apiKey - E2B API key
 * @returns Output from the command execution
 */
export async function executeCommand(
  params: CommandParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create or resume a sandbox
    sandbox = await createSandbox(apiKey, params.sandboxId);
    
    // Store initial sandbox ID
    const initialSandboxId = sandbox.sandboxId;
    
    // Execute the command in the sandbox
    const result = await sandbox.commands.run(params.command);
    
    // Format the command result
    const formattedResult = formatCommandResult(result);
    
    // Always pause the sandbox after operation
    const pausedSandboxId = await sandbox.pause();
    
    // Add sandbox ID information to the result
    return formatResultWithSandboxInfo(formattedResult, initialSandboxId, pausedSandboxId);
  } catch (error) {
    return formatError(error);
  }
}


/**
 * Formats the result of a command execution
 * 
 * @param result - The execution result
 * @returns Formatted string with the execution result
 */
function formatCommandResult(result: any): string {
  const output: string[] = [];
  
  output.push(`Command Execution Results:`);
  
  // Handle standard output
  if (result.stdout && result.stdout.length > 0) {
    output.push(`Standard Output:\n${result.stdout}`);
  }
  
  // Handle standard error
  if (result.stderr && result.stderr.length > 0) {
    output.push(`Standard Error:\n${result.stderr}`);
  }
  
  // If no output was captured
  if ((!result.stdout || result.stdout.length === 0) && 
      (!result.stderr || result.stderr.length === 0)) {
    output.push("Command executed successfully with no output");
  }
  
  // Handle exit code
  if (result.exitCode !== undefined) {
    output.push(`Exit Code: ${result.exitCode}`);
  }
  
  return output.join("\n\n");
}
