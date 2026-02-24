import { useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices } from '@/hooks/useInvoices';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { normalizeCurrency } from '@/lib/currency';
import {
  FileText,
  Upload,
  Clock,
  CheckCircle,
  Wallet,
} from 'lucide-react';

const UserDashboard = () => {
  const { invoices, loading } = useInvoices();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const processedInvoices = invoices.filter((inv) => inv.status === 'processed').length;
    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;
    const rejectedInvoices = invoices.filter((inv) => inv.status === 'rejected').length;
    
    // Chỉ tính chi tiêu từ hóa đơn không bị từ chối hoặc đã hủy
    const validInvoices = invoices.filter((inv) => inv.status !== 'rejected' && inv.status !== 'cancelled');
    
    // Group totals by normalized currency
    const totalsByCurrency = validInvoices.reduce((acc: Record<string, number>, inv) => {
      const currency = normalizeCurrency(inv.currency);
      acc[currency] = (acc[currency] || 0) + (inv.total_amount || 0);
      return acc;
    }, {});

    // Tính chi tiêu tháng này và tháng trước (theo từng loại tiền)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const thisMonthByCurrency = validInvoices
      .filter((inv) => {
        const invDate = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      })
      .reduce((acc: Record<string, number>, inv) => {
        const currency = normalizeCurrency(inv.currency);
        acc[currency] = (acc[currency] || 0) + (inv.total_amount || 0);
        return acc;
      }, {});

    const lastMonthByCurrency = validInvoices
      .filter((inv) => {
        const invDate = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear;
      })
      .reduce((acc: Record<string, number>, inv) => {
        const currency = normalizeCurrency(inv.currency);
        acc[currency] = (acc[currency] || 0) + (inv.total_amount || 0);
        return acc;
      }, {});

    return {
      totalInvoices,
      processedInvoices,
      pendingInvoices,
      rejectedInvoices,
      totalsByCurrency,
      thisMonthByCurrency,
      lastMonthByCurrency,
      validInvoicesCount: validInvoices.length,
    };
  }, [invoices]);

  // Format multi-currency for display
  const formatByCurrency = (totals: Record<string, number>) => {
    const entries = Object.entries(totals).filter(([_, amount]) => amount > 0);
    if (entries.length === 0) return [{ currency: 'VND', amount: 0 }];
    return entries.map(([currency, amount]) => ({ currency, amount }));
  };

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

        {/* Spending Stats - By Currency */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Tổng chi tiêu theo loại tiền</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {formatByCurrency(stats.totalsByCurrency).map(({ currency, amount }) => {
              const thisMonth = stats.thisMonthByCurrency[currency] || 0;
              const lastMonth = stats.lastMonthByCurrency[currency] || 0;
              const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
              
              return (
                <Card key={currency} className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tổng {currency}
                    </CardTitle>
                    <Wallet className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {amount.toLocaleString('vi-VN')} {currency}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Tháng này: {thisMonth.toLocaleString('vi-VN')} {currency}
                      {lastMonth > 0 && (
                        <span className={`ml-2 ${change >= 0 ? 'text-destructive' : 'text-success'}`}>
                          ({change >= 0 ? '+' : ''}{change.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
