export type Role = "employee" | "team_member" | "admin";
export type RequestStatus = "New" | "In Progress" | "Resolved" | "Cancelled";

export interface CurrentUser {
  userId: string;
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
