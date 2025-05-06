import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { EmailDetail } from "./get_email.js";
import { encodeBase64Url } from "./utils.js";

// Tool definition
export const REPLY_EMAIL_TOOL: Tool = {
  name: "google-gmail-reply-email",
  description: "Creates a reply to an existing Gmail email message and either sends it or saves as draft.",
  inputSchema: {
    type: "object",
    properties: {
      originalMessageId: {
        type: "string",
        description: "The ID of the Gmail message to reply to"
      },
      replyBody: {
        type: "string",
        description: "The body content of your reply message"
      },
      send: {
        type: "boolean",
        description: "If true, sends the reply immediately. If false, saves as draft.",
        default: false
      },
      cc: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional list of email addresses to CC on the reply"
      }
    },
    required: ["originalMessageId", "replyBody"]
  }
};

// Helper functions for type checking
export function isReplyEmailArgs(args: unknown): args is {
  originalMessageId: string;
  replyBody: string;
  send?: boolean;
  cc?: string[];
} {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as any).originalMessageId === "string" &&
    typeof (args as any).replyBody === "string" &&
    ((args as any).send === undefined || typeof (args as any).send === "boolean") &&
    ((args as any).cc === undefined || 
      (Array.isArray((args as any).cc) && 
       (args as any).cc.every((email: unknown) => typeof email === "string")))
  );
}

/**
 * Create a reply to an existing Gmail email message
 * 
 * @param apiKey - Google Gmail API key
 * @param args - Parameters for the reply
 * @returns Formatted string with the result
 */
export async function replyEmail(apiKey: string, args: {
  originalMessageId: string;
  replyBody: string;
  send?: boolean;
  cc?: string[];
}): Promise<string> {
  try {
    const { originalMessageId, replyBody, send = false, cc } = args;
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Gmail API client
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
    
    // Get the original message
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: originalMessageId
    });
    
    if (!response.data) {
      return `Failed to retrieve original message with ID: ${originalMessageId}`;
    }
    
    // Parse the original message
    const originalMessage = parseMessageWithHeaders(response.data);
    
    // Create reply message
    const replyMime = createReplyMime(originalMessage, replyBody, cc);
    
    // Encode the message
    const encodedMessage = encodeBase64Url(replyMime);
    
    let result;
    
    if (send) {
      // Send the reply immediately
      result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: originalMessage.threadId
        }
      });
      return JSON.stringify(result.data, null, 2);
    } else {
      // Save as draft
      result = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage,
            threadId: originalMessage.threadId
          }
        }
      });
      return JSON.stringify(result.data, null, 2);
    }
  } catch (error) {
    console.error("Error creating reply:", error);
    const action = args.send ? "sending" : "drafting";
    return `Error ${action} reply: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Parse a Gmail message to extract needed headers
 */
function parseMessageWithHeaders(message: any): EmailDetail {
  const headers = message.payload?.headers || [];
  
  const email: EmailDetail = {
    id: message.id,
    threadId: message.threadId,
    date: '',
    from: '',
    subject: ''
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
    } else if (name === 'message-id') {
      email.message_id = value;
    }
  }
  
  return email;
}

/**
 * Extract email address from a formatted email string
 * Example: "Name <email@example.com>" -> "email@example.com"
 */
function extractEmailAddress(formattedEmail: string): string {
  if (formattedEmail.includes('<') && formattedEmail.includes('>')) {
    const match = formattedEmail.match(/<([^>]+)>/);
    return match ? match[1] : formattedEmail;
  }
  return formattedEmail;
}

/**
 * Create a MIME message for the reply
 */
function createReplyMime(
  originalMessage: EmailDetail,
  replyBody: string,
  cc?: string[]
): string {
  // Determine recipient (the original sender)
  const to = originalMessage.from ? extractEmailAddress(originalMessage.from) : '';
  
  // Format subject (add Re: if needed)
  let subject = originalMessage.subject || '';
  if (!subject.toLowerCase().startsWith('re:')) {
    subject = `Re: ${subject}`;
  }

  // Format original information for quoting
  const originalDate = originalMessage.date || '';
  const originalFrom = originalMessage.from || '';
  
  // Create message with quoted original
  const ccHeader = cc && cc.length > 0 ? `Cc: ${cc.join(', ')}\r\n` : '';
  const inReplyTo = originalMessage.message_id ? `In-Reply-To: ${originalMessage.message_id}\r\n` : '';
  const references = originalMessage.message_id ? `References: ${originalMessage.message_id}\r\n` : '';
  
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    ccHeader,
    inReplyTo,
    references,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    replyBody,
    '',
    `On ${originalDate}, ${originalFrom} wrote:`,
    `> ${originalMessage.body ? originalMessage.body.replace(/\n/g, '\n> ') : '[No message body]'}`
  ].join('\r\n');
  
  return message;
}
