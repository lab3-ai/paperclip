import { useCurrentUser } from "./useCurrentUser";
import { ROLE_PERMISSIONS, type UserRole } from "@paperclipai/shared";

export function usePermission(permission: string): boolean {
  const { data: user } = useCurrentUser();
  if (!user?.role) return false;
  const role = user.role as UserRole;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function useRole(): string | null {
  const { data: user } = useCurrentUser();
  return user?.role ?? null;
}
