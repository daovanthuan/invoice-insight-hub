-- Drop unused tables (in correct order to respect foreign key dependencies)

-- 1. Drop access_logs (no dependencies)
DROP TABLE IF EXISTS public.access_logs CASCADE;

-- 2. Drop files (no dependencies pointing to it from used tables)
DROP TABLE IF EXISTS public.files CASCADE;

-- 3. Drop folders (no dependencies from used tables)
DROP TABLE IF EXISTS public.folders CASCADE;

-- 4. Drop role_permissions (junction table - depends on roles and permissions)
DROP TABLE IF EXISTS public.role_permissions CASCADE;

-- 5. Drop permissions (no other dependencies after role_permissions dropped)
DROP TABLE IF EXISTS public.permissions CASCADE;

-- 6. Drop system_configs (no dependencies)
DROP TABLE IF EXISTS public.system_configs CASCADE;

-- Clean up foreign key constraints on invoices table that reference dropped tables
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_file_id_fkey;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_folder_id_fkey;

-- Drop unused columns from invoices table
ALTER TABLE public.invoices DROP COLUMN IF EXISTS file_id;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS folder_id;

-- Clean up foreign key constraints on files table references in other places
-- (These were already dropped with CASCADE but just to be safe)