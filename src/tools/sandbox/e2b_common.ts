import { Sandbox } from "@e2b/code-interpreter";

/**
 * Creates and initializes an E2B sandbox
 * 
 * @param apiKey - E2B API key
 * @returns Initialized sandbox instance
 */
export async function createSandbox(apiKey: string): Promise<Sandbox> {
  if (!apiKey) {
    throw new Error("API key is required for E2B sandbox");
  }

  // Create a new sandbox instance with the API key
  return await Sandbox.create({ apiKey });
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
