import { useState } from "react";
import {
  signIn,
  signUp,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  signInWithRedirect,
} from "aws-amplify/auth";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

type Mode = "sign-in" | "sign-up" | "confirm" | "forgot" | "reset";

/**
 * A single modal covering the whole account flow (sign in, sign up + email
 * confirmation, forgot/reset password, Google) as internal view switches
 * rather than separate routes — sign-in here is always something a user
 * opts into mid-task (saving to the gallery), never a gate at app start.
 */
export function SignInModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useAuthStore((s) => s.refresh);

  const resetFields = () => {
    setMode("sign-in");
    setEmail("");
    setPassword("");
    setCode("");
    setNewPassword("");
    setError(null);
  };

  const close = () => {
    onOpenChange(false);
    resetFields();
  };

  const goTo = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const run = (fn: () => Promise<void>) => async () => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const succeed = async () => {
    await refresh();
    onSuccess?.();
    close();
  };

  // A stale-but-still-valid session already sitting in browser storage makes
  // signIn() throw rather than just succeed — that's not actually an error
  // from the user's point of view, so treat it the same as a fresh sign-in.
  const signInSafely = async (username: string, pwd: string) => {
    try {
      await signIn({ username, password: pwd });
    } catch (e) {
      if (!(e instanceof Error && e.name === "UserAlreadyAuthenticatedException")) throw e;
    }
  };

  const doSignIn = run(async () => {
    try {
      await signInSafely(email, password);
      await succeed();
    } catch (e) {
      if (e instanceof Error && e.name === "UserNotConfirmedException") {
        setMode("confirm");
        return;
      }
      throw e;
    }
  });

  const doSignUp = run(async () => {
    await signUp({ username: email, password, options: { userAttributes: { email } } });
    setMode("confirm");
  });

  const doConfirm = run(async () => {
    await confirmSignUp({ username: email, confirmationCode: code });
    await signInSafely(email, password);
    await succeed();
  });

  const doForgot = run(async () => {
    await resetPassword({ username: email });
    setMode("reset");
  });

  const doReset = run(async () => {
    await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
    await signInSafely(email, newPassword);
    await succeed();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(next);
      }}
    >
      <DialogContent>
        {mode === "sign-in" && (
          <>
            <DialogTitle>sign in</DialogTitle>
            <DialogDescription>to save designs to your gallery</DialogDescription>
            <div className="mt-4 flex flex-col gap-2">
              <Input
                autoFocus
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSignIn()}
              />
            </div>
            {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
            <Button className="mt-4 w-full" size="sm" onClick={doSignIn} disabled={loading}>
              {loading ? "signing in…" : "sign in"}
            </Button>
            <Button
              variant="outline"
              className="mt-2 w-full"
              size="sm"
              onClick={() => signInWithRedirect({ provider: "Google" })}
            >
              continue with Google
            </Button>
            <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
              <button className="hover:text-accent" onClick={() => goTo("forgot")}>
                forgot password?
              </button>
              <button className="hover:text-accent" onClick={() => goTo("sign-up")}>
                create an account
              </button>
            </div>
          </>
        )}

        {mode === "sign-up" && (
          <>
            <DialogTitle>create an account</DialogTitle>
            <DialogDescription>free — just to keep your saved designs</DialogDescription>
            <div className="mt-4 flex flex-col gap-2">
              <Input
                autoFocus
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSignUp()}
              />
            </div>
            {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
            <Button className="mt-4 w-full" size="sm" onClick={doSignUp} disabled={loading}>
              {loading ? "creating…" : "create account"}
            </Button>
            <div className="mt-4 text-center text-[11px] text-muted-foreground">
              <button className="hover:text-accent" onClick={() => goTo("sign-in")}>
                already have an account? sign in
              </button>
            </div>
          </>
        )}

        {mode === "confirm" && (
          <>
            <DialogTitle>check your email</DialogTitle>
            <DialogDescription>enter the code we sent to {email}</DialogDescription>
            <Input
              autoFocus
              className="mt-4"
              placeholder="confirmation code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doConfirm()}
            />
            {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
            <Button className="mt-4 w-full" size="sm" onClick={doConfirm} disabled={loading}>
              {loading ? "confirming…" : "confirm"}
            </Button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <DialogTitle>reset password</DialogTitle>
            <DialogDescription>we'll email you a code</DialogDescription>
            <Input
              autoFocus
              className="mt-4"
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doForgot()}
            />
            {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
            <Button className="mt-4 w-full" size="sm" onClick={doForgot} disabled={loading}>
              {loading ? "sending…" : "send code"}
            </Button>
          </>
        )}

        {mode === "reset" && (
          <>
            <DialogTitle>new password</DialogTitle>
            <DialogDescription>enter the code sent to {email} and a new password</DialogDescription>
            <div className="mt-4 flex flex-col gap-2">
              <Input
                autoFocus
                placeholder="confirmation code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Input
                type="password"
                placeholder="new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doReset()}
              />
            </div>
            {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
            <Button className="mt-4 w-full" size="sm" onClick={doReset} disabled={loading}>
              {loading ? "resetting…" : "reset password"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
