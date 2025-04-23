export * from './query_emails';
export * from './get_email';
export * from './bulk_get_emails';
export * from './create_draft';
export * from './delete_draft';
export * from './reply_email';

// Also export a combined array of all tools
import { QUERY_EMAILS_TOOL } from './query_emails';
import { GET_EMAIL_TOOL } from './get_email';
import { BULK_GET_EMAILS_TOOL } from './bulk_get_emails';
import { CREATE_DRAFT_TOOL } from './create_draft';
import { DELETE_DRAFT_TOOL } from './delete_draft';
import { REPLY_EMAIL_TOOL } from './reply_email';

export const GMAIL_TOOLS = [
  QUERY_EMAILS_TOOL,
  GET_EMAIL_TOOL,
  BULK_GET_EMAILS_TOOL,
  CREATE_DRAFT_TOOL,
  DELETE_DRAFT_TOOL,
  REPLY_EMAIL_TOOL
];
