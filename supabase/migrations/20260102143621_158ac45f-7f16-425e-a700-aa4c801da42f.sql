-- Drop existing update policy on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new policy allowing users to update own profile OR admin can update any profile
CREATE POLICY "Users can update own profile or admin can update any" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id OR is_admin(auth.uid()));