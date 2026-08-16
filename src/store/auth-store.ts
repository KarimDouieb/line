import { create } from "zustand";
import { getCurrentUser, fetchUserAttributes, signOut as amplifySignOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthStore = {
  status: AuthStatus;
  email: string | null;
  /** Re-checks the current Cognito session — call after any sign-in/sign-up completes. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: "loading",
  email: null,

  refresh: async () => {
    // Authentication status is decided by getCurrentUser() alone. Fetching
    // the email is a separate, best-effort call — if it fails for any
    // reason, that's not the same thing as being signed out, and treating
    // it that way is exactly what caused the header to show "sign in"
    // while authenticated calls (like loading the gallery) kept working.
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      set({ status: "unauthenticated", email: null });
      return;
    }

    let email: string | null = null;
    try {
      email = (await fetchUserAttributes()).email ?? null;
    } catch (e) {
      console.warn("Signed in, but fetchUserAttributes failed:", e);
    }
    set({ status: "authenticated", email: email ?? user.signInDetails?.loginId ?? user.username });
  },

  signOut: async () => {
    await amplifySignOut();
    set({ status: "unauthenticated", email: null });
  },
}));

// `signInWithRedirect` (Google) navigates away and back — the Hub event is
// how we learn the session is ready again once the page reloads.
Hub.listen("auth", ({ payload }) => {
  if (payload.event === "signedIn") useAuthStore.getState().refresh();
  else if (payload.event === "signedOut") useAuthStore.setState({ status: "unauthenticated", email: null });
});

// The initial check is NOT done here at module scope: ES module imports
// evaluate in dependency order before the importing module's own top-level
// code runs, and main.tsx's `Amplify.configure(outputs)` is exactly that —
// its own top-level code, executed only after everything it imports
// (including this module, transitively via the router/AppHeader) has
// already finished evaluating. A `refresh()` call here would run against
// an unconfigured Amplify instance and silently fail every time, permanently
// stuck on "unauthenticated" until some later action (like signing in)
// happened to call refresh() again. Call `initAuth()` once from a React
// effect after the app has mounted instead, by which point configuration
// has definitely already happened.
export function initAuth() {
  useAuthStore.getState().refresh();
}
