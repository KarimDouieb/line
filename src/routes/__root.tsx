import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="paper-texture flex h-dvh flex-col overflow-hidden">
      <AppHeader />
      <div className="relative flex min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
