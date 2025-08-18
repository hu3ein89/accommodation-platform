import React, { useContext, useState, createContext, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate();

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setLoading(false);
        const currentUser = session?.user ?? null;

        if (event === "PASSWORD_RECOVERY") {
          setSession(session);
          setUser(currentUser);
          navigate("/reset-password");
        } else if (session) {
          setSession(session);
          setUser(currentUser);
        } else {
          setSession(null);
          setUser(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (requiredRole) => {
    return user?.user_metadata?.role === requiredRole;
  };

  const hasAnyRole = (requiredRoles = []) => {
    return requiredRoles.includes(user?.user_metadata?.role);
  };
  

  const userProfile = user ? {
    id: user.id,
    email: user.email,
    ...user.user_metadata
  } : null;

  const value = {
    session,
    user: userProfile,
    isAuthenticated: !!user,
    logout,
    hasRole,
    hasAnyRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};