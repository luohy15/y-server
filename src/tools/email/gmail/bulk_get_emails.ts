import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { EmailDetail, EmailAttachment } from "./get_email.js";

// Tool definition
export const BULK_GET_EMAILS_TOOL: Tool = {
  name: "google-gmail-bulk-get-emails",
  description: "Retrieves multiple Gmail email messages by their IDs in a single request, including the full message bodies and attachment IDs.",
  inputSchema: {
    type: "object",
    properties: {
      emailIds: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of Gmail message IDs to retrieve"
      }
    },
    required: ["emailIds"]
  }
};

// Helper functions for type checking
export function isBulkGetEmailsArgs(args: unknown): args is {
  emailIds: string[];
} {
  return (
    typeof args === "object" &&
    args !== null &&
    Array.isArray((args as any).emailIds) &&
    (args as any).emailIds.every((id: unknown) => typeof id === "string")
  );
}

/**
 * Retrieve multiple Gmail email messages by their IDs
 * 
 * @param apiKey - Google Gmail API key
 * @param args - Parameters containing the email IDs
 * @returns Formatted string with the email details
 */
export async function bulkGetEmails(apiKey: string, args: {
  emailIds: string[];
}): Promise<string> {
  try {
    const { emailIds } = args;
    
    if (!emailIds.length) {
      return "No email IDs provided.";
    }
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Gmail API client
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
    
    const results: EmailDetail[] = [];
    
    // Process each email ID
    for (const emailId of emailIds) {
      try {
        // Make API call to get the message
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: emailId
        });
        
        if (!response.data) {
          console.error(`Failed to retrieve email with ID: ${emailId}`);
          continue;
        }
        
        // Parse the message
        const email = parseMessageWithBody(response.data);
        
        // Extract attachments
        const attachments: Record<string, EmailAttachment> = {};
        
        if (response.data.payload?.parts) {
          for (const part of response.data.payload.parts) {
            if (part.body?.attachmentId) {
              const attachment: EmailAttachment = {
                filename: part.filename || 'unknown',
                mimeType: part.mimeType || 'application/octet-stream',
                attachmentId: part.body.attachmentId,
                partId: part.partId || '0'
              };
              attachments[part.partId || '0'] = attachment;
            }
          }
        }
        
        email.attachments = attachments;
        results.push(email);
      } catch (error) {
        console.error(`Error retrieving email ${emailId}:`, error);
        // Continue with the next email ID
      }
    }
    
    if (results.length === 0) {
      return "Failed to retrieve any emails from the provided IDs.";
    }
    
    return JSON.stringify(results, null, 2);
  } catch (error) {
    console.error("Error retrieving emails:", error);
    return `Error retrieving emails: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Helper function to decode base64 data
 */
function decodeBase64(data: string): string {
  // Convert URL-safe base64 to standard base64
  const standardBase64 = data.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddedBase64 = standardBase64.padEnd(
    standardBase64.length + (4 - (standardBase64.length % 4 || 4)) % 4, 
    '='
  );
  // Decode
  try {
    return decodeURIComponent(
      Array.prototype.map.call(
        atob(paddedBase64),
        (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
  } catch (e) {
    // Fallback for non-UTF-8 content
    return atob(paddedBase64);
  }
}

/**
 * Extract the email body from the payload
 */
function extractBody(payload: any): string | undefined {
  if (!payload) {
    return undefined;
  }
  
  // For single part text/plain messages
  if (payload.mimeType === 'text/plain') {
    const data = payload.body?.data;
    if (data) {
      return decodeBase64(data);
    }
  }
  
  // For multipart messages (both alternative and related)
  if (payload.mimeType?.startsWith('multipart/')) {
    const parts = payload.parts || [];
    
    // First try to find a direct text/plain part
    for (const part of parts) {
      if (part.mimeType === 'text/plain') {
        const data = part.body?.data;
        if (data) {
          return decodeBase64(data);
        }
      }
    }
    
    // If no direct text/plain, recursively check nested multipart structures
    for (const part of parts) {
      if (part.mimeType?.startsWith('multipart/')) {
        const nestedBody = extractBody(part);
        if (nestedBody) {
          return nestedBody;
        }
      }
    }
    
    // If still no body found, try the first part as fallback
    if (parts.length > 0 && parts[0].body?.data) {
      return decodeBase64(parts[0].body.data);
    }
  }
  
  return undefined;
}

/**
 * Parse a Gmail message into a structured format including the body
 */
function parseMessageWithBody(message: any): EmailDetail {
  const headers = message.payload?.headers || [];
  
  const email: EmailDetail = {
    id: message.id,
    threadId: message.threadId,
    historyId: message.historyId,
    internalDate: message.internalDate,
    sizeEstimate: message.sizeEstimate,
    labelIds: message.labelIds || [],
    snippet: message.snippet,
    mimeType: message.payload?.mimeType
  };
  
  // Extract headers
  for (const header of headers) {
    const name = header.name.toLowerCase();
    const value = header.value;
    
    if (name === 'subject') {
      email.subject = value;
    } else if (name === 'from') {
      email.from = value;
    } else if (name === 'to') {
      email.to = value;
    } else if (name === 'date') {
      email.date = value;
    } else if (name === 'cc') {
      email.cc = value;
    } else if (name === 'bcc') {
      email.bcc = value;
    } else if (name === 'message-id') {
      email.message_id = value;
    } else if (name === 'in-reply-to') {
      email.in_reply_to = value;
    } else if (name === 'references') {
      email.references = value;
    } else if (name === 'delivered-to') {
      email.delivered_to = value;
    }
  }
  
  // Extract body
  email.body = extractBody(message.payload);
  
  return email;
}
