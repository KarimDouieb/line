import { useEffect } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/layout/AppHeader";
import { BuyMeACoffeeWidget } from "@/components/layout/BuyMeACoffeeWidget";
import { initAuth } from "@/store/auth-store";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // Runs once after mount — by then main.tsx's Amplify.configure() has
  // definitely already run (see the comment on initAuth for why this can't
  // just be a module-level call in auth-store.ts).
  useEffect(() => {
    initAuth();
  }, []);

  return (
    <div className="paper-texture flex h-dvh flex-col overflow-hidden">
      <AppHeader />
      <div className="relative flex min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <Toaster position="bottom-center" />
      <BuyMeACoffeeWidget />
    </div>
  );
}
