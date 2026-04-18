'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  firebaseReady: boolean; // kept for component API compatibility
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseReady: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);

  const loading = status === 'loading';

  useEffect(() => {
    if (session?.user) {
      const u = session.user as any;
      setUser({
        uid: u.id || u.email || '',
        email: u.email ?? null,
        displayName: u.name ?? null,
        photoURL: u.image ?? null,
      });
    } else {
      setUser(null);
    }
  }, [session]);

  const signInWithGoogle = async () => {
    await signIn('google');
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, firebaseReady: true, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
