import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Upload,
  Settings,
  BarChart3,
  Receipt,
  LogOut,
  Users,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Admin navigation items
const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Hóa đơn', path: '/invoices' },
  { icon: Upload, label: 'Tải lên', path: '/upload' },
  { icon: BarChart3, label: 'Thống kê', path: '/analytics' },
  { icon: Users, label: 'Người dùng', path: '/users' },
  { icon: Settings, label: 'Cài đặt', path: '/settings' },
];

// User navigation items
const userNavItems = [
  { icon: Home, label: 'Trang chủ', path: '/' },
  { icon: FileText, label: 'Hóa đơn', path: '/invoices' },
  { icon: Upload, label: 'Tải lên', path: '/upload' },
  { icon: Settings, label: 'Cài đặt', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Receipt className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-lg font-semibold text-foreground">InvoiceAI</h1>
              <p className="text-xs text-muted-foreground">Smart Extraction</p>
            </div>
          </div>
        </div>

        {/* Role Badge */}
        {!roleLoading && (
          <div className="px-4 py-2">
            <Badge variant={isAdmin ? 'default' : 'secondary'} className="w-full justify-center">
              {isAdmin ? 'Quản trị viên' : 'Người dùng'}
            </Badge>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="ml-auto h-2 w-2 rounded-full bg-primary"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </Button>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Powered by
            </p>
            <p className="text-sm font-semibold text-foreground">
              Gemini 2.5 Flash
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
