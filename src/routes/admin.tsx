import { createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/components/AdminLayout";
import { AdminDataProvider } from "@/contexts/AdminDataContext";

function AdminLayoutWithProvider() {
  return (
    <AdminDataProvider>
      <AdminLayout />
    </AdminDataProvider>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminLayoutWithProvider,
});
