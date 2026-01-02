
-- ============================================
-- PHASE 1: DROP OLD TABLES
-- ============================================

-- Drop old tables (order matters due to foreign keys)
DROP TABLE IF EXISTS public.line_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_role CASCADE;

-- Drop old types
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================
-- PHASE 2: CREATE ENUMS
-- ============================================

-- Status enum for various entities
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive', 'deleted');

-- File processing status
CREATE TYPE public.file_status AS ENUM ('pending', 'processing', 'completed', 'error');

-- Invoice status
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'processed');

-- Gender enum
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');

-- Notification type
CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'error', 'success');

-- ============================================
-- PHASE 3: CREATE CORE TABLES
-- ============================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_code TEXT UNIQUE,
    full_name TEXT,
    email TEXT,
    gender gender_type,
    date_of_birth DATE,
    address TEXT,
    phone TEXT,
    avatar_url TEXT,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Roles table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    status entity_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Permissions table
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    description TEXT,
    status entity_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(action, resource)
);

-- 4. Role-Permission junction table
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- 5. User-Role junction table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role_id)
);

-- 6. Folders table
CREATE TABLE public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.profiles(id),
    status entity_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_id, name, owner_id)
);

-- 7. Files table
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    status file_status NOT NULL DEFAULT 'pending',
    description TEXT,
    description_final TEXT,
    confidence_score DOUBLE PRECISION,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Invoices table (redesigned)
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT,
    invoice_serial TEXT,
    invoice_type TEXT,
    invoice_date DATE,
    
    -- Vendor info
    vendor_name TEXT,
    vendor_tax_id TEXT,
    vendor_address TEXT,
    vendor_phone TEXT,
    vendor_fax TEXT,
    vendor_account_no TEXT,
    
    -- Buyer info
    buyer_name TEXT,
    buyer_tax_id TEXT,
    buyer_address TEXT,
    buyer_account_no TEXT,
    
    -- Financial info
    currency TEXT DEFAULT 'VND',
    exchange_rate DECIMAL(15,4),
    subtotal DECIMAL(15,2),
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    amount_in_words TEXT,
    payment_method TEXT,
    
    -- Lookup info
    tax_authority_code TEXT,
    lookup_code TEXT,
    lookup_url TEXT,
    
    -- Processing info
    status invoice_status NOT NULL DEFAULT 'pending',
    confidence_score DOUBLE PRECISION,
    raw_json JSONB,
    extend JSONB DEFAULT '{}'::jsonb,
    
    -- Relations
    file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Invoice items table
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_code TEXT,
    description TEXT,
    unit TEXT,
    quantity DECIMAL(15,4),
    unit_price DECIMAL(15,2),
    amount DECIMAL(15,2),
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(15,2),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Access logs table
CREATE TABLE public.access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    username TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    api_endpoint TEXT,
    http_method TEXT,
    function_name TEXT,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. System configs table
CREATE TABLE public.system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. User settings table
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    default_currency TEXT NOT NULL DEFAULT 'VND',
    date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    language TEXT NOT NULL DEFAULT 'vi',
    timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    weekly_reports BOOLEAN NOT NULL DEFAULT false,
    error_alerts BOOLEAN NOT NULL DEFAULT true,
    theme TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PHASE 4: CREATE INDEXES
-- ============================================

CREATE INDEX idx_profiles_user_code ON public.profiles(user_code);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_files_folder_id ON public.files(folder_id);
CREATE INDEX idx_files_owner_id ON public.files(owner_id);
CREATE INDEX idx_files_status ON public.files(status);
CREATE INDEX idx_invoices_folder_id ON public.invoices(folder_id);
CREATE INDEX idx_invoices_owner_id ON public.invoices(owner_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX idx_invoices_vendor_name ON public.invoices(vendor_name);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX idx_folders_owner_id ON public.folders(owner_id);

-- ============================================
-- PHASE 5: CREATE FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = _user_id
        AND r.name = _role_name
        AND r.status = 'active'
    )
$$;

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _action TEXT, _resource TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = _user_id
        AND p.action = _action
        AND p.resource = _resource
        AND p.status = 'active'
    )
$$;

-- Function to get user's roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TABLE(role_id UUID, role_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.id, r.name
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND r.status = 'active'
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role_id UUID;
BEGIN
    -- Create profile for new user
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    
    -- Get default 'user' role
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'user' AND status = 'active';
    
    -- Assign default role if exists
    IF default_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (NEW.id, default_role_id);
    END IF;
    
    -- Create default settings
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$;

-- ============================================
-- PHASE 6: CREATE TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON public.permissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON public.system_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PHASE 7: ENABLE RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PHASE 8: CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Roles policies (admin only for write, all can read active)
CREATE POLICY "Anyone can view active roles" ON public.roles FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage roles" ON public.roles FOR ALL USING (public.is_admin(auth.uid()));

-- Permissions policies (admin only)
CREATE POLICY "Admins can view permissions" ON public.permissions FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage permissions" ON public.permissions FOR ALL USING (public.is_admin(auth.uid()));

-- Role permissions policies (admin only)
CREATE POLICY "Admins can view role_permissions" ON public.role_permissions FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL USING (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all user_roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid()));

-- Folders policies
CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can create folders" ON public.folders FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- Files policies
CREATE POLICY "Users can view own files" ON public.files FOR SELECT USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can create files" ON public.files FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own files" ON public.files FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can delete own files" ON public.files FOR DELETE USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- Invoices policies
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can create invoices" ON public.invoices FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can delete own invoices" ON public.invoices FOR DELETE USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- Invoice items policies
CREATE POLICY "Users can view invoice items" ON public.invoice_items FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND (owner_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "Users can create invoice items" ON public.invoice_items FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND owner_id = auth.uid()));
CREATE POLICY "Users can update invoice items" ON public.invoice_items FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND (owner_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "Users can delete invoice items" ON public.invoice_items FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_items.invoice_id AND (owner_id = auth.uid() OR public.is_admin(auth.uid()))));

-- Access logs policies (admin only, users can see own)
CREATE POLICY "Users can view own access logs" ON public.access_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all access logs" ON public.access_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "System can insert access logs" ON public.access_logs FOR INSERT WITH CHECK (true);

-- System configs policies
CREATE POLICY "Anyone can view public configs" ON public.system_configs FOR SELECT USING (is_public = true);
CREATE POLICY "Admins can view all configs" ON public.system_configs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage configs" ON public.system_configs FOR ALL USING (public.is_admin(auth.uid()));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- User settings policies
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can create own settings" ON public.user_settings FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- PHASE 9: INSERT DEFAULT DATA
-- ============================================

-- Insert default roles
INSERT INTO public.roles (name, description, is_system) VALUES
    ('admin', 'Quản trị viên hệ thống với toàn quyền', true),
    ('user', 'Người dùng thông thường', true);

-- Insert default permissions
INSERT INTO public.permissions (action, resource, description) VALUES
    ('create', 'invoices', 'Tạo hóa đơn mới'),
    ('read', 'invoices', 'Xem hóa đơn'),
    ('update', 'invoices', 'Cập nhật hóa đơn'),
    ('delete', 'invoices', 'Xóa hóa đơn'),
    ('create', 'files', 'Upload file'),
    ('read', 'files', 'Xem file'),
    ('update', 'files', 'Cập nhật file'),
    ('delete', 'files', 'Xóa file'),
    ('create', 'folders', 'Tạo thư mục'),
    ('read', 'folders', 'Xem thư mục'),
    ('update', 'folders', 'Cập nhật thư mục'),
    ('delete', 'folders', 'Xóa thư mục'),
    ('manage', 'users', 'Quản lý người dùng'),
    ('manage', 'roles', 'Quản lý vai trò'),
    ('manage', 'settings', 'Quản lý cấu hình hệ thống'),
    ('view', 'analytics', 'Xem thống kê'),
    ('view', 'logs', 'Xem nhật ký truy cập');

-- Assign all permissions to admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'admin';

-- Assign basic permissions to user role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'user' AND p.resource IN ('invoices', 'files', 'folders') AND p.action IN ('create', 'read', 'update', 'delete');

-- Insert default system configs
INSERT INTO public.system_configs (key, value, description, is_public) VALUES
    ('app_name', '"Hệ thống Quản lý Hóa đơn"', 'Tên ứng dụng', true),
    ('app_version', '"1.0.0"', 'Phiên bản ứng dụng', true),
    ('default_currency', '"VND"', 'Đơn vị tiền tệ mặc định', true),
    ('max_file_size', '10485760', 'Kích thước file tối đa (bytes)', true),
    ('allowed_file_types', '["image/jpeg", "image/png", "image/gif", "application/pdf"]', 'Các loại file được phép upload', true);
