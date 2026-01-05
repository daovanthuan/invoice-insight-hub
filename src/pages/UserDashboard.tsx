import { useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices } from '@/hooks/useInvoices';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Upload,
  Clock,
  CheckCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const UserDashboard = () => {
  const { invoices, loading } = useInvoices();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const processedInvoices = invoices.filter((inv) => inv.status === 'processed').length;
    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;
    const rejectedInvoices = invoices.filter((inv) => inv.status === 'rejected').length;
    
    // Chỉ tính chi tiêu từ hóa đơn không bị từ chối
    const validInvoices = invoices.filter((inv) => inv.status !== 'rejected');
    
    const totalSpending = validInvoices.reduce((sum, inv) => {
      return sum + (inv.total_amount || 0);
    }, 0);

    // Tính chi tiêu tháng này và tháng trước
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const thisMonthSpending = validInvoices
      .filter((inv) => {
        const invDate = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const lastMonthSpending = validInvoices
      .filter((inv) => {
        const invDate = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear;
      })
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const spendingChange = lastMonthSpending > 0 
      ? ((thisMonthSpending - lastMonthSpending) / lastMonthSpending) * 100 
      : 0;

    return {
      totalInvoices,
      processedInvoices,
      pendingInvoices,
      rejectedInvoices,
      totalSpending,
      thisMonthSpending,
      lastMonthSpending,
      spendingChange,
    };
  }, [invoices]);

  const recentInvoices = invoices.slice(0, 5);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Trang chủ" subtitle="Quản lý hóa đơn của bạn" />
        <div className="p-6">
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header 
        title="Trang chủ" 
        subtitle="Quản lý hóa đơn của bạn"
      />
      
      <div className="p-6">
        {/* Quick Actions */}
        <div className="mb-6">
          <Button onClick={() => navigate('/upload')} className="gap-2">
            <Upload className="h-4 w-4" />
            Tải hóa đơn mới
          </Button>
        </div>

        {/* Spending Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng chi tiêu
              </CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {stats.totalSpending.toLocaleString('vi-VN')} ₫
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Từ {stats.totalInvoices - stats.rejectedInvoices} hóa đơn hợp lệ
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Chi tiêu tháng này
              </CardTitle>
              {stats.spendingChange >= 0 ? (
                <TrendingUp className="h-5 w-5 text-destructive" />
              ) : (
                <TrendingDown className="h-5 w-5 text-success" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.thisMonthSpending.toLocaleString('vi-VN')} ₫
              </div>
              <div className="flex items-center gap-1 mt-1">
                {stats.lastMonthSpending > 0 ? (
                  <>
                    <span className={`text-xs font-medium ${stats.spendingChange >= 0 ? 'text-destructive' : 'text-success'}`}>
                      {stats.spendingChange >= 0 ? '+' : ''}{stats.spendingChange.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      so với tháng trước
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Tháng trước: {stats.lastMonthSpending.toLocaleString('vi-VN')} ₫
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng hóa đơn
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Đã xử lý
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.processedInvoices}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Đang chờ
              </CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pendingInvoices}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Hóa đơn gần đây</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
              Xem tất cả
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Chưa có hóa đơn nào</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/upload')}
                  className="mt-2"
                >
                  Tải lên hóa đơn đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {invoice.vendor_name || invoice.invoice_number || 'Hóa đơn'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.invoice_date || new Date(invoice.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {invoice.total_amount?.toLocaleString('vi-VN') || '—'}
                      </span>
                      <Badge
                        variant={
                          invoice.status === 'processed'
                            ? 'default'
                            : invoice.status === 'pending'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {invoice.status === 'processed'
                          ? 'Đã xử lý'
                          : invoice.status === 'pending'
                          ? 'Đang chờ'
                          : invoice.status === 'rejected'
                          ? 'Từ chối'
                          : invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default UserDashboard;
