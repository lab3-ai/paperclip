import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi, type User, type CreateUserInput } from "@/api/users";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermission } from "@/hooks/usePermission";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Shield, Plus } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
  guest: "Guest",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  user: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  guest: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

/** Check if actor can change the target user's role */
function canActorChangeTarget(actorRole?: string, targetRole?: string): boolean {
  if (!actorRole || !targetRole) return false;
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return ["user", "guest"].includes(targetRole);
  return false;
}

export default function UserManagement() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canCreate = usePermission("users:create");
  const canDelete = usePermission("users:delete");
  const canAssignRole = usePermission("users:assign_role");

  const [createOpen, setCreateOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<User | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("guest");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings", href: "/company/settings" },
      { label: "Users" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const usersQuery = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setCreateOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("guest");
      pushToast({ title: "User created", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: "Failed to create user", body: err.message, tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      pushToast({ title: "User deleted", tone: "success" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setRoleUser(null);
      pushToast({ title: "Role updated", tone: "success" });
    },
  });

  const allowedRoles =
    currentUser?.role === "superadmin"
      ? ["superadmin", "admin", "user", "guest"]
      : ["user", "guest"];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">User Management</h1>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Create User
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Actions</span>
        </div>
        {usersQuery.data?.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center border-b border-border px-4 py-3 last:border-b-0 text-sm"
          >
            <span className="truncate">{user.name}</span>
            <span className="truncate text-muted-foreground">{user.email}</span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <div className="flex items-center gap-1">
              {canAssignRole && user.id !== currentUser?.id && canActorChangeTarget(currentUser?.role, user.role) && (
                <button
                  onClick={() => setRoleUser(user)}
                  className="rounded p-1 hover:bg-muted"
                  title="Change role"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}
              {canDelete && user.id !== currentUser?.id && canActorChangeTarget(currentUser?.role, user.role) && (
                <button
                  onClick={() => {
                    if (confirm(`Delete user "${user.name}"?`)) {
                      deleteMutation.mutate(user.id);
                    }
                  }}
                  className="rounded p-1 hover:bg-muted text-destructive"
                  title="Delete user"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {usersQuery.data?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No users found
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: newName,
                  email: newEmail,
                  password: newPassword,
                  role: newRole,
                  companyIds: selectedCompany ? [selectedCompany.id] : [],
                })
              }
              disabled={createMutation.isPending || !newName || !newEmail || !newPassword}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <ChangeRoleDialog
        user={roleUser}
        allowedRoles={allowedRoles}
        isPending={roleMutation.isPending}
        onSave={(id, role) => roleMutation.mutate({ id, role })}
        onClose={() => setRoleUser(null)}
      />
    </div>
  );
}

function ChangeRoleDialog({
  user,
  allowedRoles,
  isPending,
  onSave,
  onClose,
}: {
  user: User | null;
  allowedRoles: string[];
  isPending: boolean;
  onSave: (id: string, role: string) => void;
  onClose: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState(user?.role ?? "guest");

  useEffect(() => {
    if (user) setSelectedRole(user.role);
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role — {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {allowedRoles.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                value={r}
                checked={selectedRole === r}
                onChange={() => setSelectedRole(r)}
                className="accent-primary"
              />
              <span className="text-sm">{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (user) onSave(user.id, selectedRole);
            }}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
