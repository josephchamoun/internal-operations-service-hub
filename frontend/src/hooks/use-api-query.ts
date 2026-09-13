import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth";

export function useApiQuery<T>(key: string[], path: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: key,
    queryFn: () => api<T>(path, token),
    enabled: !!token,
  });
}
