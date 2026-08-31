import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentUserFn, signInFn, signUpFn, signOutFn } from "@/lib/api/db-functions";

export type AppRole =
  | "super_admin"
  | "society_admin"
  | "finance_head"
  | "maintenance_head"
  | "security_head"
  | "resident"
  | "tenant"
  | "guard"
  | "technician";

interface Profile {
  id: string;
  full_name: string | null;
  society_name: string | null;
  phone: string | null;
  avatar_url?: string | null;
}

interface AuthState {
  loading: boolean;
  session: { user: { id: string; email: string } } | null;
  user: { id: string; email: string } | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    societyName?: string;
    societyCode?: string;
    role: AppRole;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: { id: string; email: string } } | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const rolesRef = useRef<string>("");

  const loadUserData = async () => {
    try {
      const data = await getCurrentUserFn();
      if (data.user) {
        setSession(data.session);
        setUser(data.user);
        setProfile(data.profile);
        // Only update roles if the content actually changed — avoids new array
        // reference every render which would cascade into infinite re-renders.
        const newRolesKey = (data.roles as AppRole[]).slice().sort().join(",");
        if (newRolesKey !== rolesRef.current) {
          rolesRef.current = newRolesKey;
          setRoles(data.roles as AppRole[]);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
      }
    } catch (e) {
      console.error("Error loading user data:", e);
      setSession(null);
      setUser(null);
      setProfile(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const value: AuthState = {
    loading,
    session,
    user,
    profile,
    roles,
    primaryRole: roles[0] ?? null,
    signOut: async () => {
      await signOutFn();
      setSession(null);
      setUser(null);
      setProfile(null);
      setRoles([]);
    },
    refresh: async () => {
      await loadUserData();
    },
    signIn: async (email, password) => {
      await signInFn({ data: { email, password } });
      await loadUserData();
    },
    signUp: async ({ email, password, fullName, societyName, societyCode, role }) => {
      await signUpFn({ data: { email, password, fullName, societyName, societyCode, role: role as "resident" | "tenant" } });
      await loadUserData();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
