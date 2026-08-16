import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SignInModal } from "@/components/auth/SignInModal";
import { useAuthStore } from "@/store/auth-store";

/** Sign-in is opt-in, never forced at app start — this is a plain "sign in" button until then, and a name + sign-out menu once authenticated. */
export function UserMenu() {
  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);
  const [modalOpen, setModalOpen] = useState(false);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-xs font-medium"
          onClick={() => setModalOpen(true)}
        >
          sign in
        </Button>
        <SignInModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="max-w-40 truncate rounded-full text-xs font-medium">
            {email}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => signOut()}>sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
