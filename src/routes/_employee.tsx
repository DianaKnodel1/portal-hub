import { createFileRoute } from "@tanstack/react-router";
import EmployeeLayout from "@/components/EmployeeLayout";

export const Route = createFileRoute("/_employee")({
  component: EmployeeLayout,
});
