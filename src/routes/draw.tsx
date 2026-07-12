import { createFileRoute } from "@tanstack/react-router";
import { DrawPage } from "@/components/draw/DrawPage";

export const Route = createFileRoute("/draw")({
  component: DrawPage,
});
