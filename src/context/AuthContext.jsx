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
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setLoading(false);

        // ۲. منطق کلیدی و جدید
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true); // وضعیت بازیابی را فعال می‌کنیم
          navigate("/reset-password");
        } else if (event === "SIGNED_IN") {
          setIsPasswordRecovery(false); // با ورود عادی، وضعیت بازیابی را غیرفعال می‌کنیم
        } else if (event === "SIGNED_OUT") {
          setIsPasswordRecovery(false);
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
    isAuthenticated: !!session && session.user.aud === 'authenticated' && !isPasswordRecovery,
    logout: () => supabase.auth.signOut(),
    loading,
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