import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { encodeBase64Url } from "./utils";

// Type definitions
export interface DraftResult {
  id: string;
  message: {
    id: string;
    threadId: string;
    labelIds: string[];
  };
}

// Tool definition
export const CREATE_DRAFT_TOOL: Tool = {
  name: "google-gmail-create-draft",
  description: "Creates a draft email message in Gmail with specified recipient, subject, body, and optional CC recipients. You can also choose to send the email immediately instead of saving it as a draft.",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Email address of the recipient"
      },
      subject: {
        type: "string",
        description: "Subject line of the email"
      },
      body: {
        type: "string",
        description: "Body content of the email"
      },
      cc: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional list of email addresses to CC"
      },
      send: {
        type: "boolean",
        description: "If true, sends the email immediately. If false, saves as draft.",
        default: false
      }
    },
    required: ["to", "subject", "body"]
  }
};

// Helper functions for type checking
export function isCreateDraftArgs(args: unknown): args is {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  send?: boolean;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as any).to === "string" &&
    typeof (args as any).subject === "string" &&
    typeof (args as any).body === "string" &&
    ((args as any).cc === undefined || 
      (Array.isArray((args as any).cc) && 
       (args as any).cc.every((email: unknown) => typeof email === "string"))) &&
    ((args as any).send === undefined || typeof (args as any).send === "boolean")
  );
}


/**
 * Create a draft email or send it immediately
 * 
 * @param apiKey - Google Gmail API key
 * @param args - Email creation parameters
 * @returns Formatted string with the result
 */
export async function createDraft(apiKey: string, args: {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  send?: boolean;
}): Promise<string> {
  try {
    const { to, subject, body, cc, send = false } = args;
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Gmail API client
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
    
    // Create MIME message
    const message = createEmailMime(to, subject, body, cc);
    
    // Encode the message
    const encodedMessage = encodeBase64Url(message);
    
    let result;
    
    if (send) {
      // Send the email immediately
      result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });
      return JSON.stringify(result.data, null, 2);
    } else {
      // Save as draft
      result = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage
          }
        }
      });
      return JSON.stringify(result.data, null, 2);
    }
  } catch (error) {
    console.error("Error creating draft:", error);
    const action = args.send ? "send" : "create draft";
    return `Error trying to ${action} email: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Encode a string as per RFC 2047 for email headers containing non-ASCII characters
 * This is necessary for proper display of characters like Chinese in email headers
 */
function encodeRFC2047Header(text: string): string {
  // Check if the text contains any non-ASCII characters
  if (!/[^\x00-\x7F]/.test(text)) {
    return text; // Return unchanged if ASCII-only
  }
  
  // Convert string to UTF-8 and then to base64
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const base64 = btoa(String.fromCharCode(...bytes));
  
  // Format according to RFC 2047 using base64 encoding and UTF-8 charset
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * Create a MIME message for the email
 * 
 * This implementation follows the RFC 5322 standard for Internet Message Format
 * and properly handles headers to prevent them from appearing in the email body.
 */
function createEmailMime(
  to: string,
  subject: string,
  body: string,
  cc?: string[]
): string {
  // Encode the subject line to handle non-ASCII characters like Chinese
  const encodedSubject = encodeRFC2047Header(subject);
  
  // Construct the MIME message following Gmail API requirements
  // Headers must be separated from body with a blank line
  const headers = [];
  
  // Add required email headers
  headers.push(`From: me`);
  headers.push(`To: ${to}`);
  headers.push(`Subject: ${encodedSubject}`);
  
  // Add CC if applicable
  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.join(', ')}`);
  }
  
  // Add MIME headers - these control how the message is interpreted but should not appear in content
  headers.push(`MIME-Version: 1.0`);
  headers.push(`Content-Type: text/plain; charset=UTF-8`);
  
  // Join all headers with CRLF, add a blank line to separate headers from body
  // This blank line is CRITICAL for proper MIME parsing
  return headers.join('\r\n') + '\r\n\r\n' + body;
}
