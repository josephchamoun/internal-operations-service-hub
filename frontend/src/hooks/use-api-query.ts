import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth";

export function useApiQuery<T>(key: string[], path: string, enabled = true) {
  const { user } = useAuth(); //returns object with several fields (user, refresh, logout, ready) 
  return useQuery({
    queryKey: key,
    queryFn: () => api<T>(path),
    enabled: !!user && enabled, //only run the query if user is not null and enabled is true
  });
}
