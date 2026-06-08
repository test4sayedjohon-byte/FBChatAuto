-- Fix 1: Resolve RLS recursion on the users table by using a SECURITY DEFINER function.

-- Create a helper function to securely fetch the current user's role without triggering RLS.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Drop the old recursive policies
DROP POLICY IF EXISTS "users_admin_select" ON public.users;
DROP POLICY IF EXISTS "users_admin_update" ON public.users;
DROP POLICY IF EXISTS "users_super_admin_all" ON public.users;

-- Create new policies using the helper function
CREATE POLICY "users_admin_select" ON public.users
  FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'super_admin'));

CREATE POLICY "users_admin_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'super_admin'));

CREATE POLICY "users_super_admin_all" ON public.users
  FOR ALL
  TO authenticated
  USING (get_my_role() = 'super_admin');


-- Fix 2: Prevent Privilege Escalation via Profile Updates

-- Create a trigger function that resets sensitive columns back to their original values 
-- if a standard user tries to modify them.
CREATE OR REPLACE FUNCTION preserve_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- If this is an administrative override, bypass protection
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get the caller's role (before the update takes effect)
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();

  -- If the caller is a standard user, revert any changes to sensitive columns
  IF caller_role = 'user' THEN
    NEW.role = OLD.role;
    NEW.agent_monthly_limit = OLD.agent_monthly_limit;
    NEW.monthly_message_limit = OLD.monthly_message_limit;
    NEW.allowed_channels = OLD.allowed_channels;
    -- Note: agent_queries_used and agent_extra_queries are managed by the worker (service_role), 
    -- so standard users shouldn't change them either.
    NEW.agent_queries_used = OLD.agent_queries_used;
    NEW.agent_extra_queries = OLD.agent_extra_queries;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger to the users table
DROP TRIGGER IF EXISTS tr_preserve_user_columns ON public.users;
CREATE TRIGGER tr_preserve_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION preserve_user_columns();
