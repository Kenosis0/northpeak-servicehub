import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function getRoleHomePath(role) {
  switch (role) {
    case 'Customer':
      return '/customer';
    case 'Service Staff':
      return '/staff';
    case 'Technician':
      return '/technician';
    case 'Inventory Staff':
      return '/inventory';
    case 'Administrator':
      return '/admin';
    default:
      return '/login';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('np_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('np_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const storedToken = localStorage.getItem('np_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data?.user) {
          setUser(res.data.user);
          localStorage.setItem('np_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        // If backend is unreachable during initial boot, keep cached user unless 401
        if (err.response?.status === 401) {
          localStorage.removeItem('np_token');
          localStorage.removeItem('np_user');
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }
    verifySession();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: loggedInUser } = res.data;
    localStorage.setItem('np_token', newToken);
    localStorage.setItem('np_user', JSON.stringify(loggedInUser));
    setToken(newToken);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    const { token: newToken, user: registeredUser } = res.data;
    localStorage.setItem('np_token', newToken);
    localStorage.setItem('np_user', JSON.stringify(registeredUser));
    setToken(newToken);
    setUser(registeredUser);
    return registeredUser;
  };

  const logout = () => {
    localStorage.removeItem('np_token');
    localStorage.removeItem('np_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        getRoleHomePath
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
