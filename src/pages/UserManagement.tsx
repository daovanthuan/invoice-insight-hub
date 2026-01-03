import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Shield, User, Ban, CheckCircle, Plus, Pencil, Phone, MapPin, Calendar, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  user_code: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  avatar_url: string | null;
  created_at: string;
  role_id: string;
  role_name: string;
  status: 'active' | 'inactive';
}

interface Role {
  id: string;
  name: string;
}

interface UserFormData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  user_code: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | '';
}

const initialFormData: UserFormData = {
  full_name: '',
  email: '',
  phone: '',
  address: '',
  user_code: '',
  date_of_birth: '',
  gender: '',
};

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('status', 'active');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Fetch user roles with profile info
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role_id,
          created_at,
          roles:role_id (id, name)
        `);

      if (userRolesError) throw userRolesError;

      // Fetch profiles with all fields
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, phone, address, user_code, date_of_birth, gender, avatar_url, created_at');

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (userRolesData || []).map((ur) => {
        const profile = profilesData?.find(p => p.id === ur.user_id);
        const role = ur.roles as unknown as { id: string; name: string } | null;
        return {
          id: ur.user_id,
          email: profile?.email || null,
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          address: profile?.address || null,
          user_code: profile?.user_code || null,
          date_of_birth: profile?.date_of_birth || null,
          gender: profile?.gender as 'male' | 'female' | 'other' | null,
          avatar_url: profile?.avatar_url || null,
          created_at: profile?.created_at || ur.created_at,
          role_id: ur.role_id,
          role_name: role?.name || 'unknown',
          status: (profile?.status as 'active' | 'inactive') || 'active',
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách người dùng',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRoleId: string) => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role_id: newRoleId })
        .eq('user_id', userId);

      if (error) throw error;

      const newRole = roles.find(r => r.id === newRoleId);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId 
            ? { ...user, role_id: newRoleId, role_name: newRole?.name || 'unknown' } 
            : user
        )
      );

      toast({
        title: 'Thành công',
        description: `Đã cập nhật vai trò thành ${newRole?.name || 'unknown'}`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật vai trò',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, status: newStatus } : user
        )
      );

      toast({
        title: 'Thành công',
        description: newStatus === 'active' 
          ? 'Đã kích hoạt tài khoản' 
          : 'Đã vô hiệu hóa tài khoản',
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể thay đổi trạng thái tài khoản',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      user_code: user.user_code || '',
      date_of_birth: user.date_of_birth || '',
      gender: user.gender || '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData(initialFormData);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          address: formData.address || null,
          user_code: formData.user_code || null,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                full_name: formData.full_name || null,
                phone: formData.phone || null,
                address: formData.address || null,
                user_code: formData.user_code || null,
                date_of_birth: formData.date_of_birth || null,
                gender: (formData.gender as 'male' | 'female' | 'other') || null,
              }
            : user
        )
      );

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin người dùng',
      });
      closeDialog();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật thông tin người dùng',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'male': return 'Nam';
      case 'female': return 'Nữ';
      case 'other': return 'Khác';
      default: return '-';
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role_name === 'admin').length,
    regularUsers: users.filter((u) => u.role_name === 'user').length,
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Quản lý người dùng" subtitle="Quản lý vai trò và quyền hạn" />
        <div className="p-6">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header 
        title="Quản lý người dùng" 
        subtitle="Quản lý vai trò và quyền hạn"
      />
      
      <div className="p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng người dùng
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Quản trị viên
              </CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.admins}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Người dùng thường
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.regularUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Danh sách người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Chưa có người dùng nào</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Mã NV</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Giới tính</TableHead>
                    <TableHead>Ngày sinh</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Thay đổi vai trò</TableHead>
                    <TableHead>Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={user.status === 'inactive' ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} />
                            <AvatarFallback className="text-xs">
                              {user.full_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || '-'}</p>
                            <p className="text-xs text-muted-foreground">{user.email || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.user_code || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.phone || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getGenderLabel(user.gender)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.date_of_birth ? format(new Date(user.date_of_birth), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                          {user.status === 'active' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Hoạt động
                            </>
                          ) : (
                            <>
                              <Ban className="h-3 w-3 mr-1" />
                              Vô hiệu hóa
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role_name === 'admin' ? 'default' : 'secondary'}
                        >
                          {user.role_name === 'admin' ? (
                            <>
                              <Shield className="h-3 w-3 mr-1" />
                              Quản trị viên
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3 mr-1" />
                              {user.role_name === 'user' ? 'Người dùng' : user.role_name}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role_id}
                          onValueChange={(value) => updateUserRole(user.id, value)}
                          disabled={updating === user.id || user.status === 'inactive'}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name === 'admin' ? 'Quản trị viên' : 
                                 role.name === 'user' ? 'Người dùng' : role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            disabled={updating === user.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={user.status === 'active' ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => toggleUserStatus(user.id, user.status)}
                            disabled={updating === user.id}
                          >
                            {user.status === 'active' ? (
                              <Ban className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Chỉnh sửa thông tin người dùng</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin chi tiết của người dùng
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Họ và tên</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nhập họ và tên"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_code">Mã nhân viên</Label>
                <Input
                  id="user_code"
                  value={formData.user_code}
                  onChange={(e) => setFormData({ ...formData, user_code: e.target.value })}
                  placeholder="Nhập mã nhân viên"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Nhập địa chỉ"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Ngày sinh</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Giới tính</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value as 'male' | 'female' | 'other' | '' })}
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
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Hủy
              </Button>
              <Button onClick={handleSaveUser} disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default UserManagement;
