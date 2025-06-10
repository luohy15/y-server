import { Sandbox } from "@e2b/code-interpreter";

/**
 * Creates and initializes an E2B sandbox or resumes an existing one
 * 
 * @param apiKey - E2B API key
 * @param sandboxId - Optional sandbox ID to resume
 * @returns Initialized sandbox instance
 */
export async function createSandbox(apiKey: string, sandboxId?: string): Promise<Sandbox> {
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
 * Formats an error message
 * 
 * @param error - Error object or message
 * @returns Formatted error message
 */
export function formatError(error: unknown): string {
  return `Error in E2B sandbox: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Formats the result with sandbox ID information
 * 
 * @param result - The operation result
 * @param initialSandboxId - The initial sandbox ID
 * @param pausedSandboxId - The sandbox ID after pausing
 * @returns Formatted result with sandbox information
 */
export function formatResultWithSandboxInfo(
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
