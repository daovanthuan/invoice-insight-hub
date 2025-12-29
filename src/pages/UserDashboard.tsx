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
  AlertCircle,
} from 'lucide-react';

// Helper function to parse amount from string
const parseAmount = (value: string | null): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const UserDashboard = () => {
  const { invoices, loading } = useInvoices();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const processedInvoices = invoices.filter((inv) => inv.status === 'processed').length;
    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;
    const failedInvoices = invoices.filter((inv) => inv.status === 'failed').length;
    
    const totalAmount = invoices.reduce((sum, inv) => {
      return sum + parseAmount(inv.total_amount);
    }, 0);

    return {
      totalInvoices,
      processedInvoices,
      pendingInvoices,
      failedInvoices,
      totalAmount,
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

        {/* Stats Cards */}
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
                          {invoice.vendor_name || invoice.file_name || 'Hóa đơn'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.invoice_date || new Date(invoice.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {invoice.total_amount || '—'}
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
                          : 'Lỗi'}
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
