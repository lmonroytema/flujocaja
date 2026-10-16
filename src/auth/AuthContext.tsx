import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AUTH_TOKEN_STORAGE_KEY, api } from "@/utils/api";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  profile: string;
  is_admin: boolean;
  two_factor_enabled: boolean;
};

type LoginPayload = {
  email: string;
  password: string;
};

type VerifyTwoFactorPayload = {
  email: string;
  code: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<LoginResponse | TwoFactorResponse>;
  verifyTwoFactor: (payload: VerifyTwoFactorPayload) => Promise<LoginResponse | TwoFactorResponse>;
  logout: () => Promise<void>;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type CurrentUserResponse = {
  user: AuthUser;
};

type TwoFactorResponse = {
  message: string;
  requires_two_factor?: boolean;
  email?: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistToken(token: string | null) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get<CurrentUserResponse>("/auth/me")
      .then((response) => {
        setUser(response.user);
      })
      .catch(() => {
        persistToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login: async ({ email, password }) => {
        const response = await api.post<LoginResponse | TwoFactorResponse>("/auth/login", {
          email,
          password,
        });

        if ("token" in response) {
          persistToken(response.token);
          setUser(response.user);
        }

        return response;
      },
      verifyTwoFactor: async ({ email, code }) => {
        const response = await api.post<LoginResponse | TwoFactorResponse>("/auth/verify-2fa", {
          email,
          code,
        });

        if ("token" in response) {
          persistToken(response.token);
          setUser(response.user);
        }

        return response;
      },
      logout: async () => {
        try {
          await api.post("/auth/logout", {});
        } finally {
          persistToken(null);
          setUser(null);
        }
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}
