import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi, type User } from "@/api/users";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.users.me,
    queryFn: () => usersApi.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
