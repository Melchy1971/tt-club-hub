
-- Trigger function: on new user signup, create members entry + mitglied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into members table
  INSERT INTO public.members (
    user_id,
    first_name,
    last_name,
    email,
    entry_date
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    CURRENT_DATE
  );

  -- Assign default 'mitglied' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'mitglied');

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
