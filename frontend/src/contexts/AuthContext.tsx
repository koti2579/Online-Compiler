import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import axios from 'axios';

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'https://online-compiler-c5sv.onrender.com/api';

interface User {
  _id: string;
  username: string;
  email: string;
  isEmailVerified: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (username: string, email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Logout helper (stable reference)
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshTokenValue(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
  }, []);

  // Refresh token helpers (stable references)
  const refreshTokenWithValue = useCallback(async (rtValue: string): Promise<boolean> => {
    try {
      const response = await axios.post('/auth/refresh', {
        refreshToken: rtValue
      });

      const { token: newToken } = response.data;
      setToken(newToken);
      localStorage.setItem('token', newToken);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!refreshTokenValue) return false;
    return refreshTokenWithValue(refreshTokenValue);
  }, [refreshTokenValue, refreshTokenWithValue]);

  // Set up axios interceptor for authentication
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Try to refresh token
          const refreshSuccess = await refreshToken();
          if (refreshSuccess) {
            // Get the current token from localStorage since state might not be updated yet
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
              originalRequest.headers.Authorization = `Bearer ${currentToken}`;
              return axios(originalRequest);
            }
          } else {
            // Refresh failed, logout user
            logout();
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [token, refreshToken, logout]);

  // Load user data from localStorage on app start (only if remember me was used)
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const storedUser = localStorage.getItem('user');
        const rememberMe = localStorage.getItem('rememberMe') === 'true';

        // Only auto-login if user explicitly chose "remember me"
        if (storedToken && storedUser && rememberMe) {
          setToken(storedToken);
          setRefreshTokenValue(storedRefreshToken);
          setUser(JSON.parse(storedUser));

          // Verify token is still valid
          try {
            const response = await axios.get('/auth/me', {
              headers: { Authorization: `Bearer ${storedToken}` }
            });
            setUser(response.data.user);
          } catch (error) {
            // Token is invalid, try to refresh
            if (storedRefreshToken) {
              const refreshSuccess = await refreshTokenWithValue(storedRefreshToken);
              if (!refreshSuccess) {
                logout();
              }
            } else {
              logout();
            }
          }
        } else {
          // Clear any stored data if not remembering
          logout();
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [refreshTokenWithValue, logout]);

    // Helper to normalize API error messages and handle rate limits
    const getErrorMessage = (error: any, fallback = 'An unexpected error occurred.') => {
      if (!error) return fallback;
      // Axios response with status
      const status = error.response?.status;
      if (status === 429) {
        return 'Too many requests. Please wait a moment and try again.';
      }
      const respData = error.response?.data;
      return respData?.error || respData?.message || fallback;
    };

  const login = async (identifier: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const response = await axios.post('/auth/login', {
        identifier,
        password,
        rememberMe
      });

      const { user: userData, token: userToken, refreshToken: userRefreshToken } = response.data;

      setUser(userData);
      setToken(userToken);
      setRefreshTokenValue(userRefreshToken);

      // Store in localStorage
      localStorage.setItem('token', userToken);
      localStorage.setItem('refreshToken', userRefreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('rememberMe', rememberMe.toString());

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Login failed. Please try again.')
      };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, email: string, password: string, confirmPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const response = await axios.post('/auth/signup', {
        username,
        email,
        password,
        confirmPassword
      });

      const { user: userData, token: userToken, refreshToken: userRefreshToken } = response.data;

      setUser(userData);
      setToken(userToken);
      setRefreshTokenValue(userRefreshToken);

      // Store in localStorage
      localStorage.setItem('token', userToken);
      localStorage.setItem('refreshToken', userRefreshToken);
      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true };
    } catch (error: any) {
      console.error('Signup error:', error);
      const msg = getErrorMessage(error, 'Signup failed. Please try again.');
      // if server provided validation details, prefer them
      const details = error.response?.data?.details;
      return {
        success: false,
        error: Array.isArray(details) && details.length ? details.join(', ') : msg
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Above we provided stable versions of logout, refreshTokenWithValue, and refreshToken

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await axios.post('/auth/forgot-password', { email });
      return { success: true };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to send password reset email. Please try again.')
      };
    }
  };

  const resetPassword = async (token: string, password: string, confirmPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await axios.post('/auth/reset-password', {
        token,
        password,
        confirmPassword
      });
      return { success: true };
    } catch (error: any) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to reset password. Please try again.')
      };
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    signup,
    logout,
    refreshToken,
    forgotPassword,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
