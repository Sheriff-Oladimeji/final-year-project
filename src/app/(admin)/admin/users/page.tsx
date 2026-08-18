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
    name: u.name,
    email: u.email,
    created_at: u.createdAt.toISOString(),
    banned: u.banned,
    ban_reason: u.banReason,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
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
                <TableHead>User</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.banned ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-red-700 border-red-200 bg-red-50"
                        title={user.ban_reason ?? undefined}
                      >
                        Banned
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
