import { createFileRoute } from "@tanstack/react-router";
import { ExportPage } from "@/components/export/ExportPage";

export const Route = createFileRoute("/export")({
  component: ExportPage,
});
