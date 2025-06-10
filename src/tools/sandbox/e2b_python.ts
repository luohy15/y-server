import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandbox, formatError } from "./e2b_common";

// Type definitions
export interface PythonParams {
  code: string;
}

// Tool definition
export const PYTHON_TOOL: Tool = {
  name: "e2b-python",
  description: "Executes Python code in a secure sandbox environment using E2B. " +
    "Provides an isolated Python interpreter for running scripts safely. " +
    "Use this for executing Python code, testing algorithms, or performing data analysis.",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute"
      }
    },
    required: ["code"]
  },
};

// Helper function to check arguments
export function isPythonArgs(args: unknown): args is PythonParams {
  if (
    typeof args !== "object" ||
    args === null ||
    !("code" in args)
  ) {
    return false;
  }

  const params = args as PythonParams;
  return typeof params.code === "string";
}

/**
 * Executes Python code in a secure sandbox environment using E2B
 * 
 * @param params - The Python code parameters
 * @param apiKey - E2B API key
 * @returns Output from the Python code execution
 */
export async function executePython(
  params: PythonParams,
  apiKey: string
): Promise<string> {
  let sandbox: Sandbox | null = null;
  
  try {
    // Create a new sandbox instance
    sandbox = await createSandbox(apiKey);
    
    // Execute the Python code
    const result = await sandbox.runCode(params.code, { language: "python" });

    return formatPythonResult(result);
  } catch (error) {
    return formatError(error);
  } finally {
    // Clean up resources - sandbox termination handled by E2B SDK
  }
}

/**
 * Formats the result of a Python code execution
 * 
 * @param result - The execution result
 * @returns Formatted string with the execution result
 */
function formatPythonResult(result: any): string {
  const output: string[] = [];
  
  output.push("Python Execution Results:");
  
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
    
    // If no logs were found in either stdout or stderr
    if ((!result.logs.stdout || result.logs.stdout.length === 0) && 
        (!result.logs.stderr || result.logs.stderr.length === 0)) {
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
