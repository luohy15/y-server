import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandbox, formatError } from "./e2b_common";

// Type definitions
export interface JavaScriptParams {
  code: string;
}

// Tool definition
export const JAVASCRIPT_TOOL: Tool = {
  name: "e2b-javascript",
  description: "Executes JavaScript code in a secure sandbox environment using E2B. " +
    "Provides an isolated JavaScript runtime for running scripts safely. " +
    "Use this for executing JavaScript code, testing algorithms, or performing web-related operations.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript code to execute"
      }
    },
    required: ["code"]
  },
};

// Helper function to check arguments
export function isJavaScriptArgs(args: unknown): args is JavaScriptParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("code" in args)
  ) {
    return false;
  }

  const params = args as JavaScriptParams;
  return typeof params.code === "string";
}

/**
 * Executes JavaScript code in a secure sandbox environment using E2B
 * 
 * @param params - The JavaScript code parameters
 * @param apiKey - E2B API key
 * @returns Output from the JavaScript code execution
 */
export async function executeJavaScript(
  params: JavaScriptParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create a new sandbox instance
    sandbox = await createSandbox(apiKey);
    
    // Execute the JavaScript code
    const result = await sandbox.runCode(params.code, { language: "javascript" });
    
    return formatJavaScriptResult(result);
  } catch (error) {
    return formatError(error);
  } finally {
    // Clean up resources - sandbox termination handled by E2B SDK
  }
}

/**
 * Formats the result of a JavaScript code execution
 * 
 * @param result - The execution result
 * @returns Formatted string with the execution result
 */
function formatJavaScriptResult(result: any): string {
  const output: string[] = [];
  
  output.push("JavaScript Execution Results:");
  
  // Handle new format where logs is an object with stdout and stderr arrays
  if (result.logs) {
    // Process stdout logs
    if (result.logs.stdout && result.logs.stdout.length > 0) {
      output.push(`Standard Output:\n${result.logs.stdout.join('')}`);
    }
    
    // Process stderr logs
    if (result.logs.stderr && result.logs.stderr.length > 0) {
      output.push(`Standard Error:\n${result.logs.stderr.join('')}`);
    }
    
    // If logs is just a string array (old format)
    if (Array.isArray(result.logs)) {
      if (result.logs.length > 0) {
        output.push(`Output:\n${result.logs.join('\n')}`);
      }
    }
    
    // If no logs were found in any format
    if ((!result.logs.stdout || result.logs.stdout.length === 0) && 
        (!result.logs.stderr || result.logs.stderr.length === 0) &&
        !(Array.isArray(result.logs) && result.logs.length > 0)) {
      output.push("Code executed successfully with no output");
    }
  } else {
    output.push("Code executed successfully with no output");
  }
  
  // Handle results if present
  if (result.results && result.results.length > 0) {
    output.push(`Results:\n${JSON.stringify(result.results, null, 2)}`);
  }
  
  // Handle error if present
  if (result.error) {
    output.push(`Error:\n${result.error}`);
  }
  
  return output.join("\n\n");
}
