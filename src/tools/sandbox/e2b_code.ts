import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandbox, formatError } from "../../utils/e2b_common";

// Type definitions for unified code execution
export interface CodeParams {
  code: string;
  language: "python" | "javascript";
}

// Unified tool definition
export const CODE_TOOL: Tool = {
  name: "e2b-code",
  description: "Executes Python or JavaScript code in a secure sandbox environment using E2B. " +
    "Provides an isolated runtime for running scripts safely. " +
    "Use this for executing code, testing algorithms, or performing data analysis.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Code to execute"
      },
      language: {
        type: "string",
        enum: ["python", "javascript"],
        description: "Programming language of the code"
      }
    },
    required: ["code", "language"]
  },
};

// Helper function to check arguments for unified tool
export function isCodeArgs(args: unknown): args is CodeParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("code" in args) ||
    !("language" in args)
  ) {
    return false;
  }

  const params = args as CodeParams;
  return (
    typeof params.code === "string" &&
    (params.language === "python" || params.language === "javascript")
  );
}

/**
 * Executes code in a secure sandbox environment using E2B
 * 
 * @param params - The code parameters including language
 * @param apiKey - E2B API key
 * @returns Output from the code execution
 */
export async function executeCode(
  params: CodeParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create a new sandbox instance
    sandbox = await createSandbox(apiKey);
    
    // Execute the code with the specified language
    const result = await sandbox.runCode(params.code, { language: params.language });
    
    return formatCodeResult(result, params.language);
  } catch (error) {
    return formatError(error);
  } finally {
    // Clean up resources - sandbox termination handled by E2B SDK
  }
}

/**
 * Formats the result of a code execution
 * 
 * @param result - The execution result
 * @param language - The programming language used
 * @returns Formatted string with the execution result
 */
function formatCodeResult(result: any, language: string): string {
  const output: string[] = [];
  
  output.push(`${language.charAt(0).toUpperCase() + language.slice(1)} Execution Results:`);
  
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
    
    // If logs is just a string array (old format) - only applies to JavaScript
    if (language === "javascript" && Array.isArray(result.logs)) {
      if (result.logs.length > 0) {
        output.push(`Output:\n${result.logs.join('\n')}`);
      }
    }
    
    // If no logs were found in any format
    const noStdout = !result.logs.stdout || result.logs.stdout.length === 0;
    const noStderr = !result.logs.stderr || result.logs.stderr.length === 0;
    const noArrayLogs = !Array.isArray(result.logs) || result.logs.length === 0;
    
    if (noStdout && noStderr && (language !== "javascript" || noArrayLogs)) {
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
