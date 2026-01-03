-- Add updated_by column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN updated_by uuid REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX idx_profiles_updated_by ON public.profiles(updated_by);