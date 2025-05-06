// Export all calendar tools from a single file
export * from "./get_events";
export * from "./create_event";
export * from "./delete_event";
export * from "./update_event";

// Export a collection of all calendar tools
import { GET_CALENDAR_EVENTS_TOOL } from "./get_events";
import { CREATE_CALENDAR_EVENT_TOOL } from "./create_event";
import { DELETE_CALENDAR_EVENT_TOOL } from "./delete_event";
import { UPDATE_CALENDAR_EVENT_TOOL } from "./update_event";

export const CALENDAR_TOOLS = [
  GET_CALENDAR_EVENTS_TOOL,
  CREATE_CALENDAR_EVENT_TOOL,
  DELETE_CALENDAR_EVENT_TOOL,
  UPDATE_CALENDAR_EVENT_TOOL
];
