import { useApiQuery } from "../hooks/use-api-query";
import type { DirectoryUser } from "../lib/directory";

export function useUserDirectory() {
  return useApiQuery<DirectoryUser[]>(["users-directory"], "/people");
}
