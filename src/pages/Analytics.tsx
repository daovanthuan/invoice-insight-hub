import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { normalizeCurrency } from '@/lib/currency';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices } from '@/hooks/useInvoices';
import { StatCard } from '@/components/dashboard/StatCard';
import { InvoiceChart } from '@/components/dashboard/InvoiceChart';
import { StatusPieChart } from '@/components/dashboard/StatusPieChart';
import { TopVendorsChart } from '@/components/dashboard/TopVendorsChart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  FileText,
  Users,
  CheckCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export default function AnalyticsPage() {
  const { invoices, loading } = useInvoices();

  const stats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // This week invoices
    const thisWeekInvoices = invoices.filter((inv) => {
      const date = new Date(inv.created_at);
      return date >= startOfWeek;
    });

    // Last week invoices
    const lastWeekInvoices = invoices.filter((inv) => {
      const date = new Date(inv.created_at);
      return date >= startOfLastWeek && date < startOfWeek;
    });

    const thisWeekCount = thisWeekInvoices.length;
    const lastWeekCount = lastWeekInvoices.length;
    const weeklyChange = lastWeekCount > 0 
      ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) 
      : thisWeekCount > 0 ? 100 : 0;

    // Weekly revenue
    const thisWeekRevenue = thisWeekInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const lastWeekRevenue = lastWeekInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const revenueChange = lastWeekRevenue > 0 
      ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
      : thisWeekRevenue > 0 ? 100 : 0;

    // Active vendors (unique vendor names)
    const activeVendors = new Set(invoices.map((inv) => inv.vendor_name).filter(Boolean)).size;

    // Processed rate
    const processedCount = invoices.filter((inv) => inv.status === 'processed').length;
    const processedRate = invoices.length > 0 ? Math.round((processedCount / invoices.length) * 100) : 0;

    // Weekly data (group by day of week)
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = weekDays.map((day, idx) => {
      const dayInvoices = thisWeekInvoices.filter((inv) => {
        const date = new Date(inv.created_at);
        return date.getDay() === idx;
      });
      return {
        day,
        invoices: dayInvoices.length,
        amount: dayInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
      };
    });

    // Monthly success rate (processed / total per month)
    const monthlyRateMap = invoices.reduce((acc: Record<string, { total: number; processed: number }>, inv) => {
      const date = new Date(inv.created_at);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!acc[monthKey]) {
        acc[monthKey] = { total: 0, processed: 0 };
      }
      acc[monthKey].total += 1;
      if (inv.status === 'processed') {
        acc[monthKey].processed += 1;
      }
      return acc;
    }, {});

    const successRateData = Object.entries(monthlyRateMap)
      .map(([month, data]) => ({
        month,
        rate: data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0,
      }))
      .slice(-6);

    // Currency distribution
    const currencyMap = invoices.reduce((acc: Record<string, number>, inv) => {
      const currency = normalizeCurrency(inv.currency);
      acc[currency] = (acc[currency] || 0) + 1;
      return acc;
    }, {});

    const totalCurrencyCount = Object.values(currencyMap).reduce((a, b) => a + b, 0);
    const currencyData = Object.entries(currencyMap)
      .map(([currency, count]) => ({
        currency,
        count,
        percentage: totalCurrencyCount > 0 ? Math.round((count / totalCurrencyCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly data for chart
    const monthlyData = invoices.reduce((acc: any[], inv) => {
      const date = inv.invoice_date || inv.created_at;
      let month = 'Unknown';
      if (date) {
        try {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            month = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
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

    // Top vendors
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

    const topVendors = vendorData.sort((a, b) => b.amount - a.amount).slice(0, 5);

    // Status distribution
    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;
    const rejectedInvoices = invoices.filter((inv) => inv.status === 'rejected').length;

    const statusDistribution = [
      { status: 'processed', count: processedCount, fill: 'hsl(var(--success))' },
      { status: 'pending', count: pendingInvoices, fill: 'hsl(var(--warning))' },
      { status: 'rejected', count: rejectedInvoices, fill: 'hsl(var(--destructive))' },
    ].filter((item) => item.count > 0);

    return {
      thisWeekCount,
      weeklyChange,
      thisWeekRevenue,
      revenueChange,
      activeVendors,
      processedRate,
      weeklyData,
      successRateData,
      currencyData,
      monthlyData: monthlyData.slice(-6),
      topVendors,
      statusDistribution,
    };
  }, [invoices]);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Analytics" subtitle="Detailed invoice data analysis" />
        <div className="p-6 space-y-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Analytics" subtitle="Detailed invoice data analysis" />

      <div className="p-6 space-y-8">
        {/* Top Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="This Week"
            value={stats.thisWeekCount.toString()}
            change={`${stats.weeklyChange >= 0 ? '+' : ''}${stats.weeklyChange}% vs last week`}
            changeType={stats.weeklyChange >= 0 ? 'positive' : 'negative'}
            icon={FileText}
            delay={0}
          />
          <StatCard
            title="Weekly Revenue"
            value={formatCurrency(stats.thisWeekRevenue)}
            change={`${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}% vs last week`}
            changeType={stats.revenueChange >= 0 ? 'positive' : 'negative'}
            icon={DollarSign}
            iconColor="text-success"
            delay={0.1}
          />
          <StatCard
            title="Vendors"
            value={stats.activeVendors.toString()}
            change="Active vendors"
            changeType="neutral"
            icon={Users}
            iconColor="text-chart-2"
            delay={0.2}
          />
          <StatCard
            title="Processing Rate"
            value={`${stats.processedRate}%`}
            change="Processed invoices"
            changeType={stats.processedRate >= 80 ? 'positive' : 'neutral'}
            icon={CheckCircle}
            iconColor="text-chart-5"
            delay={0.3}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6"
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">This Week's Activity</h3>
              <p className="text-sm text-muted-foreground">Invoices processed by day</p>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value: number) => [value, 'Invoices']}
                  />
                  <Bar dataKey="invoices" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Extraction Success Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6"
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">Success Rate</h3>
              <p className="text-sm text-muted-foreground">Monthly trend</p>
            </div>
            <div className="h-[300px]">
              {stats.successRateData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.successRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(value) => [`${value}%`, 'Success rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="hsl(var(--success))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--success))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data yet
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <InvoiceChart
              data={stats.monthlyData}
              title="Revenue Trend"
              subtitle="Total invoice value by month"
            />
          </div>
          <StatusPieChart data={stats.statusDistribution} />
        </div>

        {/* Currency Distribution & Top Vendors */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Currency Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-xl p-6"
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">Currency Distribution</h3>
              <p className="text-sm text-muted-foreground">Invoices by currency</p>
            </div>
            <div className="space-y-4">
              {stats.currencyData.length > 0 ? (
                stats.currencyData.map((item, idx) => (
                  <div key={item.currency} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{item.currency}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count} invoices ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.1 * idx }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: `hsl(var(--chart-${(idx % 5) + 1}))`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No data yet
                </div>
              )}
            </div>
          </motion.div>

          <TopVendorsChart data={stats.topVendors} />
        </div>
      </div>
    </MainLayout>
  );
}
