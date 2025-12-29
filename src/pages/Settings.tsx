import { useState } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  User,
  Bell,
  Globe,
  Save,
  LogOut,
  Lock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, loading, saving, updateSettings } = useUserSettings();
  
  const [dateFormat, setDateFormat] = useState<string>('');
  const [defaultCurrency, setDefaultCurrency] = useState<string>('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [errorAlerts, setErrorAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Initialize form when settings load
  if (settings && !hasChanges) {
    if (dateFormat === '') setDateFormat(settings.date_format);
    if (defaultCurrency === '') setDefaultCurrency(settings.default_currency);
    if (emailNotifications !== settings.email_notifications) setEmailNotifications(settings.email_notifications);
    if (errorAlerts !== settings.error_alerts) setErrorAlerts(settings.error_alerts);
    if (weeklyReports !== settings.weekly_reports) setWeeklyReports(settings.weekly_reports);
  }

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateSettings({
      date_format: dateFormat,
      default_currency: defaultCurrency,
      email_notifications: emailNotifications,
      error_alerts: errorAlerts,
      weekly_reports: weeklyReports,
    });
    setHasChanges(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Đã đổi mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Không thể đổi mật khẩu');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Không thể đăng xuất');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Cài đặt" subtitle="Tùy chỉnh cài đặt ứng dụng" />
        <div className="p-6 max-w-4xl space-y-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Cài đặt" subtitle="Tùy chỉnh cài đặt ứng dụng" />

      <div className="p-6 max-w-4xl">
        <div className="space-y-8">
          {/* Account Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Tài khoản</h3>
                <p className="text-sm text-muted-foreground">Thông tin tài khoản của bạn</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-muted/50" 
                />
              </div>

              <Separator />

              {/* Change Password */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Đổi mật khẩu</Label>
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Mật khẩu mới</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-muted/50"
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-muted/50"
                      placeholder="••••••"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={handleChangePassword}
                      disabled={changingPassword || !newPassword || !confirmPassword}
                      className="w-full"
                    >
                      {changingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Đổi mật khẩu'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Logout */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận đăng xuất</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout}>
                      Đăng xuất
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Thông báo</h3>
                <p className="text-sm text-muted-foreground">Cấu hình nhận thông báo</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Thông báo email</p>
                  <p className="text-sm text-muted-foreground">
                    Nhận email khi hoàn thành trích xuất
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={(checked) => {
                    setEmailNotifications(checked);
                    handleChange();
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Cảnh báo lỗi</p>
                  <p className="text-sm text-muted-foreground">
                    Nhận thông báo khi có lỗi xảy ra
                  </p>
                </div>
                <Switch
                  checked={errorAlerts}
                  onCheckedChange={(checked) => {
                    setErrorAlerts(checked);
                    handleChange();
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Báo cáo hàng tuần</p>
                  <p className="text-sm text-muted-foreground">
                    Nhận tổng hợp hóa đơn đã xử lý hàng tuần
                  </p>
                </div>
                <Switch
                  checked={weeklyReports}
                  onCheckedChange={(checked) => {
                    setWeeklyReports(checked);
                    handleChange();
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* Localization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Khu vực</h3>
                <p className="text-sm text-muted-foreground">Cài đặt ngày tháng và tiền tệ</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Định dạng ngày</Label>
                <Select
                  value={dateFormat}
                  onValueChange={(value) => {
                    setDateFormat(value);
                    handleChange();
                  }}
                >
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tiền tệ mặc định</Label>
                <Select
                  value={defaultCurrency}
                  onValueChange={(value) => {
                    setDefaultCurrency(value);
                    handleChange();
                  }}
                >
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VND">VND (₫)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {/* Save Button */}
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu thay đổi
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
