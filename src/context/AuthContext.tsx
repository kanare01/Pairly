import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, CreditWallet } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';

interface AuthContextType {
  user: User | null;
  wallet: CreditWallet | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    display_name: string;
    date_of_birth: string;
    gender: string;
    location: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshWallet = async () => {
    try {
      if (api.getToken()) {
        const res = await api.getWallet();
        setWallet(res.wallet);
      }
    } catch (err) {
      console.error('Failed to refresh wallet:', err);
    }
  };

  const refreshUser = async () => {
    try {
      if (api.getToken()) {
        const res = await api.getMe();
        setUser(res.user);
        setWallet(res.wallet);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
      api.setToken(null);
      setUser(null);
      setWallet(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          setWallet(res.wallet);
          wsClient.connect(token);
        } catch {
          api.setToken(null);
          setUser(null);
          setWallet(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Listen to WebSocket events for real-time wallet & presence
  useEffect(() => {
    const unsubscribeWallet = wsClient.on('WALLET_UPDATE', (newWallet: CreditWallet) => {
      setWallet(newWallet);
    });

    return () => {
      unsubscribeWallet();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    setWallet(res.wallet);
    wsClient.connect(res.token);
  };

  const register = async (data: any) => {
    const res = await api.register(data);
    setUser(res.user);
    setWallet(res.wallet);
    wsClient.connect(res.token);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      setUser(null);
      setWallet(null);
      wsClient.disconnect();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        loading,
        login,
        register,
        logout,
        refreshWallet,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
