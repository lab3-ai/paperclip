import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";

export function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <ShieldX className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Access Denied</h2>
      <p className="text-sm text-muted-foreground">
        You don't have permission to access this feature.
      </p>
      <Link to="/dashboard">
        <Button variant="outline">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
