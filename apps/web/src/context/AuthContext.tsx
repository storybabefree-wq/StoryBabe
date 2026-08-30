'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, SendOtpResponse } from '@storybabe/types';
import { api, setToken } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  sendRegisterOtp: (data: { email: string; username: string; displayName: string; password: string }) => Promise<SendOtpResponse>;
  verifyRegisterOtp: (data: { email: string; code: string }) => Promise<void>;
  sendForgotPasswordOtp: (email: string) => Promise<SendOtpResponse>;
  resetPassword: (data: { email: string; code: string; newPassword: string }) => Promise<void>;
  resendOtp: (data: { email: string; type: 'REGISTRATION' | 'PASSWORD_RESET' }) => Promise<SendOtpResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.getMe();
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('storybabe_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    refreshUser();
  }, [refreshUser]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('storybabe_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const login = async (emailOrUsername: string, password: string) => {
    const res = await api.auth.login({ emailOrUsername: emailOrUsername.trim(), password });
    if (res.success && res.data) {
      setToken(res.data.tokens.accessToken);
      setUser(res.data.user);
    }
  };

  const sendRegisterOtp = async (data: { email: string; username: string; displayName: string; password: string }): Promise<SendOtpResponse> => {
    const res = await api.auth.sendRegisterOtp({
      email: data.email.trim().toLowerCase(),
      username: data.username.trim().toLowerCase(),
      displayName: data.displayName.trim(),
      password: data.password
    });
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error?.message || 'Failed to send verification code');
  };

  const verifyRegisterOtp = async (data: { email: string; code: string }) => {
    const res = await api.auth.verifyRegisterOtp({
      email: data.email.trim().toLowerCase(),
      code: data.code.trim()
    });
    if (res.success && res.data) {
      setToken(res.data.tokens.accessToken);
      setUser(res.data.user);
    }
  };

  const sendForgotPasswordOtp = async (email: string): Promise<SendOtpResponse> => {
    const res = await api.auth.sendForgotPasswordOtp(email.trim().toLowerCase());
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error?.message || 'Failed to send password reset code');
  };

  const resetPassword = async (data: { email: string; code: string; newPassword: string }) => {
    const res = await api.auth.resetPassword({
      email: data.email.trim().toLowerCase(),
      code: data.code.trim(),
      newPassword: data.newPassword
    });
    if (!res.success) {
      throw new Error(res.error?.message || 'Failed to reset password');
    }
  };

  const resendOtp = async (data: { email: string; type: 'REGISTRATION' | 'PASSWORD_RESET' }): Promise<SendOtpResponse> => {
    const res = await api.auth.resendOtp({
      email: data.email.trim().toLowerCase(),
      type: data.type
    });
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error?.message || 'Failed to resend code');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        theme,
        toggleTheme,
        login,
        sendRegisterOtp,
        verifyRegisterOtp,
        sendForgotPasswordOtp,
        resetPassword,
        resendOtp,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
