export type Role = "employee" | "team_member" | "admin";
export type RequestStatus = "New" | "In Progress" | "Resolved" | "Cancelled";

export interface CurrentUser {
  userId: string;
  name?: string;
  role: Role;
  teamIds: string[];
}
export interface RequestItem {
  id: string;
  requesterId: string;
  categoryId: string;
  owningTeamId: string;
  priorityId: string;
  status: RequestStatus;
  claimedBy: string | null;
  subject: string;
  description?: string;
  lastFullAccessAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}
export interface Team {
  id: string;
  name: string;
}
export interface Category {
  id: string;
  name: string;
  defaultTeamId: string | null;
}
export interface Priority {
  id: string;
  name: string;
  escalationWindowMinutes: number;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamIds: string[];
}
export interface RequestEvent {
  id: string;
  requestId: string;
  eventType: string;
  actorId: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}
export interface AccessLog {
  id: string;
  userId: string;
  requestId: string;
  accessedAt: string;
}
export interface AttachmentMeta {
  id: string;
  requestId: string;
  messageId: string | null;
  uploaderId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
export interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  attachments: AttachmentMeta[];
}
export interface IntakeSuggestion {
  summary: string;
  categoryId: string;
  requestType: string;
  priorityId: string;
  suggestedOwningTeamId: string | null;
  suggestedNextStep: string;
  selfServeHint: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  confidence: "high" | "medium" | "low";
}
