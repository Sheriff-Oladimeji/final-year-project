export const dynamic = "force-dynamic";

import { listAllUsers } from "@/db/queries/users";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActions } from "@/components/admin/UserActions";
import type { UserAdmin } from "@/types";

export default async function AdminUsersPage() {
  const rawUsers = await listAllUsers();

  const users: UserAdmin[] = rawUsers.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role as UserAdmin["role"],
    created_at: u.createdAt.toISOString(),
    disabled_at: u.disabledAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {users.length} account{users.length !== 1 ? "s" : ""} registered
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No users yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.disabled_at ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-red-700 border-red-200 bg-red-50"
                      >
                        Disabled
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-green-700 border-green-200 bg-green-50"
                      >
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserActions user={user} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
