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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, Shield, User, Ban, CheckCircle } from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  role_id: string;
  role_name: string;
  status: 'active' | 'inactive';
}

interface Role {
  id: string;
  name: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
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

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, status');

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (userRolesData || []).map((ur) => {
        const profile = profilesData?.find(p => p.id === ur.user_id);
        const role = ur.roles as unknown as { id: string; name: string } | null;
        return {
          id: ur.user_id,
          email: profile?.email || null,
          full_name: profile?.full_name || null,
          created_at: ur.created_at,
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
                    <TableHead>Email</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Vai trò hiện tại</TableHead>
                    <TableHead>Thay đổi vai trò</TableHead>
                    <TableHead>Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={user.status === 'inactive' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                        {user.full_name || user.id.slice(0, 8) + '...'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email || '-'}
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
                        <Button
                          variant={user.status === 'active' ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.status)}
                          disabled={updating === user.id}
                        >
                          {user.status === 'active' ? (
                            <>
                              <Ban className="h-4 w-4 mr-1" />
                              Vô hiệu hóa
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Kích hoạt
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default UserManagement;
