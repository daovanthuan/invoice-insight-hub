import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SignUpFormData {
  user_code: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | '';
  password: string;
  confirmPassword: string;
}

const initialSignUpFormData: SignUpFormData = {
  user_code: '',
  full_name: '',
  email: '',
  phone: '',
  address: '',
  date_of_birth: '',
  gender: '',
  password: '',
  confirmPassword: '',
};

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginUserCode, setLoginUserCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState<SignUpFormData>(initialSignUpFormData);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (!signUpForm.user_code.trim()) {
      toast.error("Vui lòng nhập mã nhân viên");
      setIsLoading(false);
      return;
    }

    if (!signUpForm.full_name.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      setIsLoading(false);
      return;
    }

    if (!signUpForm.email.trim()) {
      toast.error("Vui lòng nhập email");
      setIsLoading(false);
      return;
    }

    if (signUpForm.password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      setIsLoading(false);
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      setIsLoading(false);
      return;
    }

    try {
      // Check if user_code already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('user_code')
        .eq('user_code', signUpForm.user_code.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        toast.error("Mã nhân viên này đã được sử dụng");
        setIsLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: signUpForm.email.trim(),
        password: signUpForm.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: signUpForm.full_name.trim(),
            user_code: signUpForm.user_code.trim(),
          }
        }
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Email này đã được đăng ký. Vui lòng đăng nhập.");
        } else {
          toast.error(error.message);
        }
        setIsLoading(false);
        return;
      }

      // Update profile with additional info after signup
      if (data.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            user_code: signUpForm.user_code.trim(),
            full_name: signUpForm.full_name.trim(),
            phone: signUpForm.phone.trim() || null,
            address: signUpForm.address.trim() || null,
            date_of_birth: signUpForm.date_of_birth || null,
            gender: signUpForm.gender || null,
          })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        }
      }

      toast.success("Đăng ký thành công! Bạn có thể đăng nhập ngay.");
      setSignUpForm(initialSignUpFormData);
    } catch (error) {
      console.error('Signup error:', error);
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!loginUserCode.trim()) {
      toast.error("Vui lòng nhập mã nhân viên");
      setIsLoading(false);
      return;
    }

    try {
      // First, find the email associated with the user_code
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, status')
        .eq('user_code', loginUserCode.trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast.error("Mã nhân viên không tồn tại");
        setIsLoading(false);
        return;
      }

      if (!profile.email) {
        toast.error("Tài khoản chưa có email liên kết");
        setIsLoading(false);
        return;
      }

      if (profile.status === 'inactive') {
        toast.error("Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
        setIsLoading(false);
        return;
      }

      // Now sign in with the email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: loginPassword,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Mã nhân viên hoặc mật khẩu không đúng.");
        } else {
          toast.error(error.message);
        }
        setIsLoading(false);
        return;
      }

      toast.success("Đăng nhập thành công!");
      navigate("/dashboard");
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">InvoiceAI</h1>
          <p className="text-muted-foreground mt-2">
            Trích xuất hóa đơn thông minh với AI
          </p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Chào mừng</CardTitle>
            <CardDescription>
              Đăng nhập hoặc tạo tài khoản để bắt đầu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
                <TabsTrigger value="signup">Đăng ký</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-user-code">Mã nhân viên</Label>
                    <Input
                      id="signin-user-code"
                      type="text"
                      placeholder="Nhập mã nhân viên"
                      value={loginUserCode}
                      onChange={(e) => setLoginUserCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Mật khẩu</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-user-code">Mã nhân viên <span className="text-destructive">*</span></Label>
                      <Input
                        id="signup-user-code"
                        type="text"
                        placeholder="VD: NV001"
                        value={signUpForm.user_code}
                        onChange={(e) => setSignUpForm({ ...signUpForm, user_code: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-full-name">Họ và tên <span className="text-destructive">*</span></Label>
                      <Input
                        id="signup-full-name"
                        type="text"
                        placeholder="Nhập họ và tên"
                        value={signUpForm.full_name}
                        onChange={(e) => setSignUpForm({ ...signUpForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="email@example.com"
                      value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Số điện thoại</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="0912345678"
                        value={signUpForm.phone}
                        onChange={(e) => setSignUpForm({ ...signUpForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-dob">Ngày sinh</Label>
                      <Input
                        id="signup-dob"
                        type="date"
                        value={signUpForm.date_of_birth}
                        onChange={(e) => setSignUpForm({ ...signUpForm, date_of_birth: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-gender">Giới tính</Label>
                      <Select
                        value={signUpForm.gender}
                        onValueChange={(value) => setSignUpForm({ ...signUpForm, gender: value as 'male' | 'female' | 'other' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Nam</SelectItem>
                          <SelectItem value="female">Nữ</SelectItem>
                          <SelectItem value="other">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-address">Địa chỉ</Label>
                      <Input
                        id="signup-address"
                        type="text"
                        placeholder="Nhập địa chỉ"
                        value={signUpForm.address}
                        onChange={(e) => setSignUpForm({ ...signUpForm, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Mật khẩu <span className="text-destructive">*</span></Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signUpForm.password}
                        onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password">Xác nhận MK <span className="text-destructive">*</span></Label>
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={signUpForm.confirmPassword}
                        onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    <span className="text-destructive">*</span> Bắt buộc | Mật khẩu phải có ít nhất 6 ký tự
                  </p>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      "Đăng ký"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
