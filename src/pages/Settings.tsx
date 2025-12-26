import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Cpu,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const handleSave = () => {
    toast.success('Settings saved successfully!');
  };

  return (
    <MainLayout>
      <Header title="Settings" subtitle="Configure your invoice extraction preferences" />

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
                <p className="text-sm text-muted-foreground">Manage your account information</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue="John Doe" className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue="john@company.com" className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" defaultValue="Global Corp Ltd." className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" defaultValue="Finance Manager" className="bg-muted/50" />
              </div>
            </div>
          </motion.div>

          {/* AI Model Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">AI Extraction</h3>
                <p className="text-sm text-muted-foreground">Configure AI model preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary AI Model</Label>
                  <Select defaultValue="gemini">
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="gpt4">GPT-4 Vision</SelectItem>
                      <SelectItem value="claude">Claude 3.5 Sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>OCR Engine</Label>
                  <Select defaultValue="olmocr">
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="olmocr">OlmOCR 2-7B</SelectItem>
                      <SelectItem value="tesseract">Tesseract OCR</SelectItem>
                      <SelectItem value="google">Google Vision OCR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Ensemble Pipeline</p>
                  <p className="text-sm text-muted-foreground">
                    Use 3-way verification for maximum accuracy
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Auto Table Detection</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect and crop tables from documents
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Smart Text Normalization</p>
                  <p className="text-sm text-muted-foreground">
                    Fix OCR spelling errors in common business terms
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
                <p className="text-sm text-muted-foreground">Configure how you receive updates</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email when extraction completes
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Error Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when extraction fails
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Weekly Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly summary of processed invoices
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </motion.div>

          {/* Localization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Localization</h3>
                <p className="text-sm text-muted-foreground">Date and currency preferences</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select defaultValue="dmy">
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
                <Label>Default Currency</Label>
                <Select defaultValue="usd">
                  <SelectTrigger className="bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                    <SelectItem value="gbp">GBP (£)</SelectItem>
                    <SelectItem value="vnd">VND (₫)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-end"
          >
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
