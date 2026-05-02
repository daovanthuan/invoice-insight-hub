import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
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
  Camera,
  Phone,
  MapPin,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, loading: settingsLoading, saving, updateSettings } = useUserSettings();
  const { profile, loading: profileLoading, saving: profileSaving, updateProfile } = useProfile();
  const { theme, setTheme } = useTheme();
  
  const loading = settingsLoading || profileLoading;
  
  // Profile states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileInitialized, setProfileInitialized] = useState(false);
  
  // Settings states
  const [dateFormat, setDateFormat] = useState<string>('');
  const [defaultCurrency, setDefaultCurrency] = useState<string>('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [errorAlerts, setErrorAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasProfileChanges, setHasProfileChanges] = useState(false);

  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Initialize profile form
  useEffect(() => {
    if (profile && !profileInitialized) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setProfileInitialized(true);
    }
  }, [profile, profileInitialized]);

  // Initialize settings form when settings load
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

  const handleSaveProfile = async () => {
    await updateProfile({
      full_name: fullName,
      phone,
      address,
    });
    setHasProfileChanges(false);
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
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password');
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
      toast.error('Failed to sign out');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Settings" subtitle="Customize application settings" />
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
      <Header title="Settings" subtitle="Customize application settings" />

      <div className="p-6 max-w-4xl">
        <div className="space-y-8">
          {/* Profile Section */}
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
                <h3 className="text-lg font-semibold text-foreground">Profile</h3>
                <p className="text-sm text-muted-foreground">Your displayed information</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {fullName ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Avatar is derived from your email
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setHasProfileChanges(true);
                    }}
                    className="bg-muted/50"
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    value={user?.email || ''} 
                    disabled 
                    className="bg-muted/50" 
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setHasProfileChanges(true);
                    }}
                    className="bg-muted/50"
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setHasProfileChanges(true);
                    }}
                    className="bg-muted/50"
                    placeholder="Enter address"
                  />
                </div>
              </div>

              {hasProfileChanges && (
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={profileSaving}
                  className="gap-2"
                >
                  {profileSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save profile
                </Button>
              )}
            </div>
          </motion.div>

          {/* Security Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Security</h3>
                <p className="text-sm text-muted-foreground">Password and sign out</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Change Password */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Change password</Label>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
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
                    <Label htmlFor="confirmPassword">Confirm password</Label>
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
                        'Change password'
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
                    Sign out
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm sign out</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to sign out?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout}>
                      Sign out
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
                <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
                <p className="text-sm text-muted-foreground">Configure notification preferences</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get an email when extraction completes
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
                  <p className="font-medium text-foreground">Error alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when errors occur
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
                  <p className="font-medium text-foreground">Weekly reports</p>
                  <p className="text-sm text-muted-foreground">
                    Get a weekly summary of processed invoices
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
                <h3 className="text-lg font-semibold text-foreground">Region</h3>
                <p className="text-sm text-muted-foreground">Date and currency settings</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Date format</Label>
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
                <Label>Default currency</Label>
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

          {/* Appearance Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Sun className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
                <p className="text-sm text-muted-foreground">Customize application theme</p>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === 'light' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="p-3 rounded-full bg-amber-100">
                  <Sun className="h-6 w-6 text-amber-600" />
                </div>
                <span className="text-sm font-medium">Light</span>
              </button>
              
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark' || theme === 'system'
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="p-3 rounded-full bg-slate-800">
                  <Moon className="h-6 w-6 text-slate-200" />
                </div>
                <span className="text-sm font-medium">Dark</span>
              </button>
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
                Save changes
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
