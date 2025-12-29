import { useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { InvoiceChart } from '@/components/dashboard/InvoiceChart';
import { StatusPieChart } from '@/components/dashboard/StatusPieChart';
import { TopVendorsChart } from '@/components/dashboard/TopVendorsChart';
import { RecentInvoices } from '@/components/dashboard/RecentInvoices';
import { useInvoices } from '@/hooks/useInvoices';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
} from 'lucide-react';

// Helper function to parse amount from string
const parseAmount = (value: string | null): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
};

const Index = () => {
  const { invoices, loading } = useInvoices();

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    
    const totalAmount = invoices.reduce((sum, inv) => {
      return sum + parseAmount(inv.total_amount);
    }, 0);

    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;
    const processedInvoices = invoices.filter((inv) => inv.status === 'processed').length;
    const failedInvoices = invoices.filter((inv) => inv.status === 'failed').length;

    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    // Group by month for chart
    const monthlyData = invoices.reduce((acc: any[], inv) => {
      const date = inv.invoice_date || inv.created_at;
      let month = 'Unknown';
      if (date) {
        try {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            month = d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
          }
        } catch {
          month = 'Unknown';
        }
      }
      
      const existing = acc.find((item) => item.month === month);
      const amount = parseAmount(inv.total_amount);
      
      if (existing) {
        existing.amount += amount;
        existing.count += 1;
      } else {
        acc.push({ month, amount, count: 1 });
      }
      return acc;
    }, []);

    // Group by vendor for chart
    const vendorData = invoices.reduce((acc: any[], inv) => {
      const vendor = inv.vendor_name || 'Unknown';
      const existing = acc.find((item) => item.vendor === vendor);
      const amount = parseAmount(inv.total_amount);
      
      if (existing) {
        existing.amount += amount;
      } else {
        acc.push({ vendor, amount });
      }
      return acc;
    }, []);

    const topVendors = vendorData
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const statusDistribution = [
      { status: 'processed', count: processedInvoices, fill: 'hsl(var(--success))' },
      { status: 'pending', count: pendingInvoices, fill: 'hsl(var(--warning))' },
      { status: 'failed', count: failedInvoices, fill: 'hsl(var(--destructive))' },
    ].filter((item) => item.count > 0);

    return {
      totalInvoices,
      totalAmount,
      pendingInvoices,
      averageAmount,
      monthlyData: monthlyData.slice(-6),
      topVendors,
      statusDistribution,
    };
  }, [invoices]);

  // Convert for RecentInvoices component
  const recentInvoicesFormatted = invoices.slice(0, 5).map((inv) => ({
    id: inv.id,
    filename: inv.file_name || 'invoice.pdf',
    status: (inv.status as 'processed' | 'pending' | 'error') || 'pending',
    core: {
      vendor_name: inv.vendor_name || '',
      vendor_tax_id: inv.vendor_tax_id || '',
      vendor_address: inv.vendor_address || '',
      vendor_phone: inv.vendor_phone || '',
      vendor_fax: '',
      vendor_account_no: '',
      buyer_name: inv.buyer_name || '',
      buyer_tax_id: inv.buyer_tax_id || '',
      buyer_address: inv.buyer_address || '',
      buyer_account_no: '',
      invoice_id: inv.invoice_id || '',
      invoice_serial: inv.invoice_serial || '',
      invoice_date: inv.invoice_date || '',
      payment_method: inv.payment_method || '',
      currency: inv.currency || '',
      exchange_rate: '',
      tax_authority_code: '',
      lookup_code: '',
      lookup_url: '',
      subtotal: inv.subtotal || '',
      tax_rate: inv.tax_rate || '',
      tax_amount: inv.tax_amount || '',
      total_amount: inv.total_amount || '',
      amount_in_words: inv.amount_in_words || '',
      line_items: [],
    },
    extend: inv.extend || {},
    createdAt: new Date(inv.created_at),
  }));

  if (loading) {
    return (
      <MainLayout>
        <Header title="Dashboard" subtitle="Trích xuất hóa đơn thông minh với AI" />
        <div className="p-6">
          <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header 
        title="Dashboard" 
        subtitle="Trích xuất hóa đơn thông minh với AI"
      />
      
      <div className="p-6">
        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Tổng hóa đơn"
            value={stats.totalInvoices.toLocaleString()}
            change="Tất cả hóa đơn"
            changeType="neutral"
            icon={FileText}
            delay={0}
          />
          <StatCard
            title="Tổng giá trị"
            value={formatCurrency(stats.totalAmount)}
            change="Tổng số tiền"
            changeType="positive"
            icon={DollarSign}
            iconColor="text-success"
            delay={0.1}
          />
          <StatCard
            title="Đang chờ xử lý"
            value={stats.pendingInvoices}
            change="Cần xem xét"
            changeType="neutral"
            icon={Clock}
            iconColor="text-warning"
            delay={0.2}
          />
          <StatCard
            title="Giá trị TB"
            value={stats.averageAmount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
            change="Mỗi hóa đơn"
            changeType="neutral"
            icon={TrendingUp}
            iconColor="text-chart-2"
            delay={0.3}
          />
        </div>

        {/* Charts Row */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <InvoiceChart
              data={stats.monthlyData}
              title="Xu hướng hóa đơn"
              subtitle="Tổng giá trị theo thời gian"
            />
          </div>
          <StatusPieChart data={stats.statusDistribution} />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopVendorsChart data={stats.topVendors} />
          <RecentInvoices invoices={recentInvoicesFormatted} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
