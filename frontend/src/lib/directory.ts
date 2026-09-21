export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

export function findDirectoryUser(
  users: DirectoryUser[] | undefined,
  userId: string | null | undefined,
): DirectoryUser | undefined {
  if (!userId || !users) return undefined;
  return users.find((user) => user.id === userId);
}
