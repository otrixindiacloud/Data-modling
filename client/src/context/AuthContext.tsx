import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/authToken";
import {
  fetchProfile,
  login as loginRequest,
  logout as logoutRequest,
  registerAccount,
  type AuthProfileResponse,
  type AuthResponse,
  type LoginPayload,
  type RegisterPayload,
} from "@/services/authService";

interface AuthContextValue {
  token: string | null;
  user: AuthResponse["user"] | null;
  organization: AuthResponse["organization"] | null;
  roles: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface AuthState {
  token: string | null;
  user: AuthResponse["user"] | null;
  organization: AuthResponse["organization"] | null;
  roles: string[];
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  token: null,
  user: null,
  organization: null,
  roles: [],
  isLoading: true,
};

function mapProfile(response: AuthProfileResponse): Pick<AuthState, "user" | "organization" | "roles"> {
  return {
    user: response.user,
    organization: response.organization,
    roles: response.roles ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<AuthState>({ ...initialState });

  useEffect(() => {
    const initialize = async () => {
      const existingToken = getAuthToken();
      if (!existingToken) {
        setState((prev) => ({ ...prev, token: null, isLoading: false }));
        return;
      }

      try {
        const profile = await fetchProfile();
        setState({
          token: existingToken,
          isLoading: false,
          ...mapProfile(profile),
        });
      } catch (error) {
        clearAuthToken();
        setState({ ...initialState, isLoading: false });
      }
    };

    void initialize();
  }, []);

  const applyAuthResponse = (response: AuthResponse) => {
    setAuthToken(response.token);
    setState({
      token: response.token,
      user: response.user,
      organization: response.organization,
      roles: response.roles ?? [],
      isLoading: false,
    });
  };

  const login = async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    applyAuthResponse(response);
  };

  const register = async (payload: RegisterPayload) => {
    const response = await registerAccount(payload);
    applyAuthResponse(response);
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch (error) {
      // Best-effort logout; continue clearing client state
    }
    clearAuthToken();
    setState({
      token: null,
      user: null,
      organization: null,
      roles: [],
      isLoading: false,
    });
  };

  const refreshProfile = async () => {
    const existingToken = getAuthToken();
    if (!existingToken) {
      await logout();
      return;
    }
    const profile = await fetchProfile();
    setState((prev) => ({
      ...prev,
      token: existingToken,
      ...mapProfile(profile),
      isLoading: false,
    }));
  };

  const value = useMemo<AuthContextValue>(() => ({
    token: state.token,
    user: state.user,
    organization: state.organization,
    roles: state.roles,
    isAuthenticated: Boolean(state.token && state.user && state.organization),
    isLoading: state.isLoading,
    login,
    register,
    logout,
    refreshProfile,
  }), [state.token, state.user, state.organization, state.roles, state.isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
