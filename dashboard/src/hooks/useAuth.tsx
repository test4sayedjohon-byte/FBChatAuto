import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from './useToast';

type UserRole = 'user' | 'admin' | 'super_admin';

interface UserProfile {
  role: UserRole;
  is_super_admin: boolean; // computed alias: role === 'super_admin'
  plan?: string;
  is_suspended?: boolean;
  monthly_token_limit?: number;
  strict_token_enforcement?: boolean;
  allowed_channels?: number;
  monthly_credits_limit?: number;
  extra_credits_balance?: number;
  credits_used_this_month?: number;
  daily_credit_spend_cap?: number;
  allow_comment_analysis?: boolean;
  assigned_comment_analysis_provider_id?: string | null;
  billing_cycle_anchor?: string;
  sentiment_analysis_scope?: 'global' | 'specific_posts';
  sentiment_watched_post_ids?: string[] | null;
  allow_chat?: boolean;
  allow_image_gen?: boolean;
  allow_embeddings?: boolean;
  allow_agent?: boolean;
  allow_summarization?: boolean;
  allow_vision?: boolean;
  allow_content?: boolean;
  settings?: any;
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
  refreshCreditBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const processedPurchasesRef = useRef<Set<string>>(new Set());

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  const fetchProfile = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('users').select('role, plan, is_suspended, monthly_token_limit, strict_token_enforcement, allowed_channels, monthly_credits_limit, extra_credits_balance, credits_used_this_month, daily_credit_spend_cap, allow_comment_analysis, assigned_comment_analysis_provider_id, billing_cycle_anchor, sentiment_analysis_scope, sentiment_watched_post_ids, allow_chat, allow_image_gen, allow_embeddings, allow_agent, allow_summarization, allow_vision, allow_content, settings').eq('id', userId).single();
    if (data) {
      setProfile({
        ...data,
        role: (data.role as UserRole) ?? 'user',
        is_super_admin: data.role === 'super_admin',
      });
    }
  };

  // Lightweight credit-only refresh — only re-reads balance fields so the sidebar stays live
  const refreshCreditBalance = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('users')
      .select('credits_used_this_month, extra_credits_balance, monthly_credits_limit')
      .eq('id', user.id)
      .single();
    if (data) {
      setProfile(prev =>
        prev
          ? {
              ...prev,
              credits_used_this_month: data.credits_used_this_month,
              extra_credits_balance: data.extra_credits_balance,
              monthly_credits_limit: data.monthly_credits_limit,
            }
          : null
      );
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

  // Real-time listener for user profile/credit updates so credits update live everywhere
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            const newData = payload.new as Record<string, any>;
            setProfile((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...newData,
                role: (newData.role as UserRole) ?? prev.role,
                is_super_admin: newData.role === 'super_admin' || prev.role === 'super_admin',
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Real-time listener for user purchases so the user gets notified of approvals/denials/credits additions
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-purchases-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const playSound = () => {
            const audio = new Audio('/Notification.mp3');
            audio.play().catch(err => console.error('[Audio] Failed to play notification sound:', err));
          };

          if (payload.eventType === 'INSERT') {
            const purchase = payload.new;
            const eventKey = `${purchase.id}-${purchase.status}`;
            if (processedPurchasesRef.current.has(eventKey)) return;
            processedPurchasesRef.current.add(eventKey);

            if (purchase.status === 'approved') {
              if (purchase.payment_method === 'admin_adjustment') {
                toast.success(`Credits balance adjusted by administrator: ${purchase.message_addon || 'Credits updated'}`);
              } else {
                toast.success(`Purchase approved: ${purchase.message_addon || 'Credits added'}`);
              }
              playSound();
            } else if (purchase.status === 'pending') {
              toast.info(`Purchase request submitted: ${purchase.message_addon}`);
              playSound();
            }
          } else if (payload.eventType === 'UPDATE') {
            const newPurchase = payload.new;
            const eventKey = `${newPurchase.id}-${newPurchase.status}`;
            if (processedPurchasesRef.current.has(eventKey)) return;
            processedPurchasesRef.current.add(eventKey);

            if (newPurchase.status === 'approved') {
              toast.success(`Your purchase request of ${newPurchase.message_addon} has been approved!`);
              playSound();
            } else if (newPurchase.status === 'rejected') {
              toast.error(`Your purchase request of ${newPurchase.message_addon} was not approved.`);
              playSound();
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Backup poll credit balance every 60 s so the sidebar reflects live deductions even if socket drops
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(refreshCreditBalance, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

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
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isSuperAdmin, loading, signIn, signUp, signOut, refreshCreditBalance }}>
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
