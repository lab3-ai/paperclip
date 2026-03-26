import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi } from "@/api/users";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
  guest: "Guest",
};

export default function UserProfile() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const [name, setName] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Profile" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => usersApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me });
      pushToast({ title: "Profile updated", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: "Failed to update profile", body: err.message, tone: "error" });
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!user) return null;

  const isDirty = name !== user.name;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Profile</h1>

      <div className="space-y-4 rounded-md border border-border px-4 py-4">
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <input
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Role</label>
          <div className="mt-1 text-sm">{ROLE_LABELS[user.role] ?? user.role}</div>
        </div>
        {user.companies && user.companies.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground">Companies</label>
            <div className="mt-1 space-y-1">
              {user.companies.map((c) => (
                <div key={c.companyId} className="text-sm">
                  {c.companyId} ({c.membershipRole ?? "member"})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isDirty && (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => updateMutation.mutate({ name })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="ghost" onClick={() => setName(user.name)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
