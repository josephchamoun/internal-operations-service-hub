import { findDirectoryUser, type DirectoryUser } from "../lib/directory";

export function PersonLabel({
  userId,
  users,
  currentUserId,
  unclaimed = "Unclaimed",
}: {
  userId: string | null | undefined;
  users?: DirectoryUser[];
  currentUserId?: string;
  unclaimed?: string;
}) {
  if (!userId) return <span>{unclaimed}</span>;
  const person = findDirectoryUser(users, userId);
  if (currentUserId && userId === currentUserId) {
    return (
      <span className="person-name" title={person?.email}>
        You
      </span>
    );
  }
  if (!person) return <span>{userId}</span>;
  return (
    <span className="person-name" title={person.email}>
      {person.name}
    </span>
  );
}
