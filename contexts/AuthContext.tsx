import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkAuth, getUser, logout as logoutService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      // First check local storage
      const localUser = await getUser();
      
      if (localUser) {
        // Verify with server
        const serverUser = await checkAuth();
        setUser(serverUser);
      } else {
        // Try server check anyway
        const serverUser = await checkAuth();
        setUser(serverUser);
      }
    } catch (error) {
      console.warn('Auth initialization error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      const { login: loginService } = await import('../services/authService');
      const result = await loginService(identifier, password);
      setUser(result.user);
    } catch (error: unknown) {
      throw error;
    }
  };

  const signInWithApple = async () => {
    const { signInWithApple: appleSignIn } = await import('../services/authService');
    const result = await appleSignIn();
    if (result?.user) setUser(result.user);
  };

  const signInWithGoogle = async () => {
    const { signInWithGoogle: googleSignIn } = await import('../services/authService');
    const result = await googleSignIn();
    if (result?.user) setUser(result.user);
  };

  const logout = async () => {
    try {
      await logoutService();
      setUser(null);
    } catch (error) {
      console.warn('Logout error:', error);
      setUser(null);
    }
  };

  const refreshAuth = async () => {
    try {
      const serverUser = await checkAuth();
      setUser(serverUser);
    } catch (error) {
      console.warn('Refresh auth error:', error);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signInWithApple,
        signInWithGoogle,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
