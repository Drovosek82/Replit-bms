import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Get from .env or constants
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export interface AuthUser {
  id: string;
  email: string;
  device_id: string;
  created_at: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Check if user is already logged in
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem("bms_user");
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Failed to restore session:", err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const generateDeviceId = () => {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const deviceId = generateDeviceId();

      // Hash password on client (simple approach - ideally use server)
      const passwordHash = await hashPassword(password);

      // Create user in Supabase
      const { data, error: signUpError } = await supabase
        .from("users")
        .insert({
          email,
          password_hash: passwordHash,
          device_id: deviceId,
        })
        .select()
        .single();

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      const newUser: AuthUser = {
        id: data.id,
        email: data.email,
        device_id: data.device_id,
        created_at: data.created_at,
      };

      // Save to local storage
      await AsyncStorage.setItem("bms_user", JSON.stringify(newUser));
      await AsyncStorage.setItem("bms_auth_token", password); // Store for later login

      setUser(newUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const passwordHash = await hashPassword(password);

      // Verify user credentials
      const { data, error: signInError } = await supabase
        .from("users")
        .select()
        .eq("email", email)
        .single();

      if (signInError || !data) {
        throw new Error("Invalid email or password");
      }

      // In production, use proper password verification on server
      if (data.password_hash !== passwordHash) {
        throw new Error("Invalid email or password");
      }

      const authenticatedUser: AuthUser = {
        id: data.id,
        email: data.email,
        device_id: data.device_id,
        created_at: data.created_at,
      };

      await AsyncStorage.setItem("bms_user", JSON.stringify(authenticatedUser));
      await AsyncStorage.setItem("bms_auth_token", password);

      setUser(authenticatedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem("bms_user");
      await AsyncStorage.removeItem("bms_auth_token");
      setUser(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        signUp,
        signIn,
        signOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Simple hash function (use bcrypt in production!)
async function hashPassword(password: string): Promise<string> {
  // This is a placeholder. In production, use a proper hashing library
  // or send to server for hashing
  return Buffer.from(password).toString("base64");
}
