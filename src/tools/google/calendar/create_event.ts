import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Type definitions
export interface CreateEventArgs {
  summary: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  attendees?: string[];
  sendNotifications?: boolean;
  timezone?: string;
  calendarId?: string;
}

// Tool definition
export const CREATE_CALENDAR_EVENT_TOOL: Tool = {
  name: "google-calendar-create-event",
  description: "Creates a new event in a specified Google Calendar.",
  inputSchema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Title of the event"
      },
      startTime: {
        type: "string",
        description: "Start time in RFC3339 format (e.g. 2024-12-01T10:00:00Z)"
      },
      endTime: {
        type: "string",
        description: "End time in RFC3339 format (e.g. 2024-12-01T11:00:00Z)"
      },
      location: {
        type: "string",
        description: "Location of the event (optional)"
      },
      description: {
        type: "string",
        description: "Description or notes for the event (optional)"
      },
      attendees: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of attendee email addresses (optional)"
      },
      sendNotifications: {
        type: "boolean",
        description: "Whether to send notifications to attendees",
        default: true
      },
      timezone: {
        type: "string",
        description: "Timezone for the event (e.g. 'America/New_York'). Defaults to UTC if not specified."
      },
      calendarId: {
        type: "string",
        description: "Optional ID of the specific calendar. If not provided, the primary calendar is used.",
        default: "primary"
      }
    },
    required: ["summary", "startTime", "endTime"]
  }
};

// Helper functions for type checking
export function isCreateEventArgs(args: unknown): args is CreateEventArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as CreateEventArgs).summary === "string" &&
    typeof (args as CreateEventArgs).startTime === "string" &&
    typeof (args as CreateEventArgs).endTime === "string"
  );
}

/**
 * Creates a new event in a specified Google Calendar
 * 
 * @param apiKey - Google Calendar API key
 * @param args - Arguments for creating the event
 * @returns Formatted string with the created event data
 */
export async function createCalendarEvent(apiKey: string, args: CreateEventArgs): Promise<string> {
  try {
    // Validate required arguments
    if (!args.summary || !args.startTime || !args.endTime) {
      return "Error: Missing required arguments (summary, startTime, endTime)";
    }
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Google Calendar API client with authenticated OAuth client
    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Prepare event data
    const event: any = {
      summary: args.summary,
      start: {
        dateTime: args.startTime,
        timeZone: args.timezone || 'UTC',
      },
      end: {
        dateTime: args.endTime,
        timeZone: args.timezone || 'UTC',
      }
    };
    
    // Add optional fields if provided
    if (args.location) {
      event.location = args.location;
    }
    if (args.description) {
      event.description = args.description;
    }
    if (args.attendees && args.attendees.length > 0) {
      event.attendees = args.attendees.map(email => ({ email }));
    }
    
    // Create the event
    const response = await calendar.events.insert({
      calendarId: args.calendarId || 'primary',
      requestBody: event,
      sendNotifications: args.sendNotifications !== false
    });
    
    if (!response.data) {
      return "Error: Failed to create event";
    }
    
    return JSON.stringify(response.data, null, 2);
  } catch (error) {
    console.error("Error creating calendar event:", error);
    return `Error creating calendar event: ${error instanceof Error ? error.message : String(error)}`;
  }
}
