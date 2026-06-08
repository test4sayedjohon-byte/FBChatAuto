import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'user' | 'admin' | 'super_admin';

interface UserProfile {
  role: UserRole;
  is_super_admin: boolean; // computed alias: role === 'super_admin'
  plan?: string;
  is_suspended?: boolean;
  monthly_token_limit?: number;
  strict_token_enforcement?: boolean;
  allowed_channels?: number;
  monthly_message_limit?: number;
  extra_message_limit?: number;
  agent_monthly_limit?: number;
  agent_queries_used?: number;
  agent_extra_queries?: number;
  agent_usage_month?: string;
  allow_vision?: boolean;
  vision_monthly_limit?: number;
  vision_queries_used?: number;
  vision_extra_queries?: number;
  vision_usage_month?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;       // role === 'admin' || role === 'super_admin'
  isSuperAdmin: boolean;  // role === 'super_admin'
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  const fetchProfile = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('users').select('role, plan, is_suspended, monthly_token_limit, strict_token_enforcement, allowed_channels, monthly_message_limit, extra_message_limit, agent_monthly_limit, agent_queries_used, agent_extra_queries, agent_usage_month, allow_vision, vision_monthly_limit, vision_queries_used, vision_extra_queries, vision_usage_month').eq('id', userId).single();
    if (data) {
      setProfile({
        ...data,
        role: (data.role as UserRole) ?? 'user',
        is_super_admin: data.role === 'super_admin',
      });
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      await fetchProfile(session?.user?.id);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        await fetchProfile(session?.user?.id);
        setLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isSuperAdmin, loading, signIn, signUp, signOut }}>
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
