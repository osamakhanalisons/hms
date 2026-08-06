import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HousingOS" },
      {
        name: "description",
        content: "Sign in to your society workspace or create a new account.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [societyName, setSocietyName] = useState("");
  const [role, setRole] = useState<AppRole>("resident");
  const navigate = useNavigate();
  const { session, loading: authLoading, signIn, signUp } = useAuth();

  useEffect(() => {
    if (!authLoading && session) navigate({ to: "/" });
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success("Signed in");
      } else {
        await signUp({ email, password, fullName, societyName, role });
        toast.success("Account created — signing you in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-h-screen flex-col px-6 py-10 sm:px-14 lg:py-14">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-foreground text-background">
            <Building2 className="size-4" />
          </div>
          <div className="font-serif text-lg leading-tight tracking-tight">HousingOS</div>
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {mode === "signin" ? "Welcome back" : "Get started"}
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            {mode === "signin" ? "Sign in to HousingOS." : "Create your account."}
          </h1>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="full">Full name</Label>
                  <Input
                    id="full"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">I am a</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resident">Resident (owner)</SelectItem>
                      <SelectItem value="tenant">Tenant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full gap-1.5" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to HousingOS?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-4"
                  onClick={() => setMode("signup")}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-4"
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <div className="text-[11px] text-muted-foreground">© 2026 HousingOS</div>
      </div>

      <div className="relative hidden overflow-hidden bg-foreground text-background lg:block">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-14">
          <div className="text-[11px] uppercase tracking-[0.22em] text-background/60">
            One platform · 31 modules
          </div>
          <div>
            <h2 className="font-serif text-4xl font-bold leading-tight tracking-tight">
              Run the entire society from one calm dashboard.
            </h2>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Ledger-perfect finance",
                "Gate + visitor + parking",
                "AI complaint triage",
                "Public transparency portal",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-background/85">
                  <span className="grid size-5 place-items-center rounded-full bg-background/10">
                    <Check className="size-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-[11px] text-background/50">
            Trusted by societies across Pakistan.
          </div>
        </div>
      </div>
    </div>
  );
}
