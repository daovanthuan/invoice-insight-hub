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
import { normalizeCurrency, formatCurrencyCompact } from '@/lib/currency';
import {
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
} from 'lucide-react';

const Index = () => {
  const { invoices, loading } = useInvoices();

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    
    // Chỉ tính hóa đơn hợp lệ (không bị hủy hoặc từ chối)
    const validInvoices = invoices.filter(
      (inv) => inv.status !== 'cancelled' && inv.status !== 'rejected'
    );
    
    // Group totals by normalized currency (chỉ từ hóa đơn hợp lệ)
    const totalsByCurrency = validInvoices.reduce((acc: Record<string, number>, inv) => {
      const currency = normalizeCurrency(inv.currency);
      acc[currency] = (acc[currency] || 0) + (inv.total_amount || 0);
      return acc;
    }, {});

    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;
    const processedInvoices = invoices.filter((inv) => inv.status === 'processed').length;
    const rejectedInvoices = invoices.filter((inv) => inv.status === 'rejected').length;
    const cancelledInvoices = invoices.filter((inv) => inv.status === 'cancelled').length;

    // Calculate average per normalized currency (chỉ từ hóa đơn hợp lệ)
    const invoicesByCurrency = validInvoices.reduce((acc: Record<string, number>, inv) => {
      const currency = normalizeCurrency(inv.currency);
      acc[currency] = (acc[currency] || 0) + 1;
      return acc;
    }, {});

    const averageByCurrency: Record<string, number> = {};
    Object.keys(totalsByCurrency).forEach((currency) => {
      averageByCurrency[currency] = totalsByCurrency[currency] / (invoicesByCurrency[currency] || 1);
    });

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
      const amount = inv.total_amount || 0;
      
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
      const amount = inv.total_amount || 0;
      
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
      { status: 'rejected', count: rejectedInvoices, fill: 'hsl(var(--destructive))' },
    ].filter((item) => item.count > 0);

    return {
      totalInvoices,
      totalsByCurrency,
      averageByCurrency,
      pendingInvoices,
      monthlyData: monthlyData.slice(-6),
      topVendors,
      statusDistribution,
    };
  }, [invoices]);

  // Format multi-currency totals for display (compact, max 3 shown)
  const formatMultiCurrency = (totals: Record<string, number>) => {
    const entries = Object.entries(totals)
      .filter(([_, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a); // Sort by amount descending
    
    if (entries.length === 0) return '0';
    
    const displayEntries = entries.slice(0, 3);
    const remaining = entries.length - 3;
    
    let result = displayEntries
      .map(([currency, amount]) => formatCurrencyCompact(amount, currency))
      .join(' | ');
    
    if (remaining > 0) {
      result += ` (+${remaining})`;
    }
    
    return result;
  };

  const formatMultiCurrencyAverage = (averages: Record<string, number>) => {
    const entries = Object.entries(averages).filter(([_, amount]) => amount > 0);
    if (entries.length === 0) return '0';
    
    if (entries.length === 1) {
      return `${entries[0][1].toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${entries[0][0]}`;
    }
    
    // If multiple currencies, just show count
    return `${entries.length} loại tiền`;
  };

  // Convert for RecentInvoices component
  const recentInvoicesFormatted = invoices.slice(0, 5).map((inv) => ({
    id: inv.id,
    filename: inv.invoice_number || 'invoice.pdf',
    status: (inv.status === 'processed' ? 'processed' : inv.status === 'rejected' ? 'error' : 'pending') as 'processed' | 'pending' | 'error',
    core: {
      vendor_name: inv.vendor_name || '',
      vendor_tax_id: inv.vendor_tax_id || '',
      vendor_address: inv.vendor_address || '',
      vendor_phone: inv.vendor_phone || '',
      vendor_fax: inv.vendor_fax || '',
      vendor_account_no: inv.vendor_account_no || '',
      buyer_name: inv.buyer_name || '',
      buyer_tax_id: inv.buyer_tax_id || '',
      buyer_address: inv.buyer_address || '',
      buyer_account_no: inv.buyer_account_no || '',
      invoice_id: inv.invoice_number || '',
      invoice_serial: inv.invoice_serial || '',
      invoice_date: inv.invoice_date || '',
      payment_method: inv.payment_method || '',
      currency: inv.currency || '',
      exchange_rate: String(inv.exchange_rate || ''),
      tax_authority_code: inv.tax_authority_code || '',
      lookup_code: inv.lookup_code || '',
      lookup_url: inv.lookup_url || '',
      subtotal: String(inv.subtotal || ''),
      tax_rate: String(inv.tax_rate || ''),
      tax_amount: String(inv.tax_amount || ''),
      total_amount: String(inv.total_amount || ''),
      amount_in_words: inv.amount_in_words || '',
      line_items: [],
    },
    extend: (inv.extend || {}) as Record<string, unknown>,
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
            value={formatMultiCurrency(stats.totalsByCurrency)}
            change="Theo từng loại tiền"
            changeType="positive"
            icon={DollarSign}
            iconColor="text-success"
            delay={0.1}
          />
          <StatCard
            title="Đang chờ xử lý"
            value={String(stats.pendingInvoices)}
            change="Cần xem xét"
            changeType="neutral"
            icon={Clock}
            iconColor="text-warning"
            delay={0.2}
          />
          <StatCard
            title="Giá trị TB"
            value={formatMultiCurrencyAverage(stats.averageByCurrency)}
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
