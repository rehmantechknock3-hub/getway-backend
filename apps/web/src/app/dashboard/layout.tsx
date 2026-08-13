import { AdminShell } from "../../components/admin/admin-shell";
import { requireAdmin } from "../../lib/require-admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
