import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Type definitions
export interface UpdateEventArgs {
  eventId: string;
  summary?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  attendees?: string[];
  sendNotifications?: boolean;
  timezone?: string;
}

// Tool definition
export const UPDATE_CALENDAR_EVENT_TOOL: Tool = {
  name: "google-calendar-update-event",
  description: "Updates an existing event in a specified Google Calendar.",
  inputSchema: {
    type: "object",
    properties: {
      eventId: {
        type: "string",
        description: "ID of the event to update"
      },
      summary: {
        type: "string",
        description: "Updated title of the event (optional)"
      },
      startTime: {
        type: "string",
        description: "Updated start time in RFC3339 format (e.g. 2024-12-01T10:00:00Z) (optional)"
      },
      endTime: {
        type: "string",
        description: "Updated end time in RFC3339 format (e.g. 2024-12-01T11:00:00Z) (optional)"
      },
      location: {
        type: "string",
        description: "Updated location of the event (optional)"
      },
      description: {
        type: "string",
        description: "Updated description or notes for the event (optional)"
      },
      attendees: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Updated list of attendee email addresses (optional)"
      },
      sendNotifications: {
        type: "boolean",
        description: "Whether to send notifications about the update to attendees",
        default: true
      },
      timezone: {
        type: "string",
        description: "Updated timezone for the event (e.g. 'America/New_York'). Defaults to UTC if not specified."
      }
    },
    required: ["eventId"]
  }
};

// Helper functions for type checking
export function isUpdateEventArgs(args: unknown): args is UpdateEventArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as UpdateEventArgs).eventId === "string"
  );
}

/**
 * Updates an existing event in a specified Google Calendar
 * 
 * @param apiKey - Google Calendar API key
 * @param args - Arguments for updating the event
 * @returns Formatted string with the updated event data
 */
export async function updateCalendarEvent(apiKey: string, args: UpdateEventArgs): Promise<string> {
  try {
    // Validate required arguments
    if (!args.eventId) {
      return "Error: Missing required argument (eventId)";
    }
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Google Calendar API client with authenticated OAuth client
    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });
    
    // First, get the existing event to preserve unmodified fields
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: args.eventId
    });
    
    if (!existingEvent.data) {
      return "Error: Could not find event with the provided ID";
    }
    
    // Prepare updated event data
    const event: any = {
      ...existingEvent.data
    };
    
    // Update only the fields that are provided
    if (args.summary !== undefined) {
      event.summary = args.summary;
    }
    
    if (args.startTime !== undefined) {
      event.start = {
        ...event.start,
        dateTime: args.startTime,
        timeZone: args.timezone || event.start.timeZone || 'UTC',
      };
    } else if (args.timezone !== undefined) {
      event.start = {
        ...event.start,
        timeZone: args.timezone,
      };
    }
    
    if (args.endTime !== undefined) {
      event.end = {
        ...event.end,
        dateTime: args.endTime,
        timeZone: args.timezone || event.end.timeZone || 'UTC',
      };
    } else if (args.timezone !== undefined) {
      event.end = {
        ...event.end,
        timeZone: args.timezone,
      };
    }
    
    if (args.location !== undefined) {
      event.location = args.location;
    }
    
    if (args.description !== undefined) {
      event.description = args.description;
    }
    
    if (args.attendees !== undefined) {
      event.attendees = args.attendees.map(email => ({ email }));
    }
    
    // Update the event in primary calendar
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: args.eventId,
      requestBody: event,
      sendNotifications: args.sendNotifications !== false
    });
    
    if (!response.data) {
      return "Error: Failed to update event";
    }
    
    return JSON.stringify(response.data, null, 2);
  } catch (error) {
    console.error("Error updating calendar event:", error);
    return `Error updating calendar event: ${error instanceof Error ? error.message : String(error)}`;
  }
}
