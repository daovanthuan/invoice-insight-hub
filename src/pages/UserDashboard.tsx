import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices } from '@/hooks/useInvoices';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { normalizeCurrency } from '@/lib/currency';
import {
  FileText,
  Upload,
  Clock,
  CheckCircle,
  Wallet,
  Download,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

type TimeFilter = 'week' | 'month' | 'quarter' | 'year';

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
};

const getFilterDateRange = (filter: TimeFilter): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (filter) {
    case 'week': {
      start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return { start, end };
};

const UserDashboard = () => {
  const { invoices, loading } = useInvoices();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

  // All valid invoices (exclude cancelled & rejected)
  const validInvoices = useMemo(
    () => invoices.filter((inv) => inv.status !== 'rejected' && inv.status !== 'cancelled'),
    [invoices]
  );

  // Filtered invoices by time range
  const filteredInvoices = useMemo(() => {
    const { start, end } = getFilterDateRange(timeFilter);
    return validInvoices.filter((inv) => {
      const d = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
      return d >= start && d <= end;
    });
  }, [validInvoices, timeFilter]);

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const processedInvoices = invoices.filter((inv) => inv.status === 'processed').length;
    const pendingInvoices = invoices.filter((inv) => inv.status === 'pending').length;

    // Totals by currency for the filtered period
    const totalsByCurrency = filteredInvoices.reduce((acc: Record<string, number>, inv) => {
      const currency = normalizeCurrency(inv.currency);
      acc[currency] = (acc[currency] || 0) + (inv.total_amount || 0);
      return acc;
    }, {});

    return {
      totalInvoices,
      processedInvoices,
      pendingInvoices,
      totalsByCurrency,
      filteredCount: filteredInvoices.length,
    };
  }, [invoices, filteredInvoices]);

  // Monthly chart data - last 6 months
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      months.push({
        label: `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getFullYear()}`,
        start: d,
        end,
      });
    }

    // Collect all currencies present
    const currencies = new Set<string>();
    validInvoices.forEach((inv) => currencies.add(normalizeCurrency(inv.currency)));

    return months.map(({ label, start, end }) => {
      const monthInvoices = validInvoices.filter((inv) => {
        const d = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
        return d >= start && d <= end;
      });

      const row: Record<string, string | number> = { month: label, count: monthInvoices.length };
      currencies.forEach((cur) => {
        row[cur] = monthInvoices
          .filter((inv) => normalizeCurrency(inv.currency) === cur)
          .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      });
      return row;
    });
  }, [validInvoices]);

  const chartCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    validInvoices.forEach((inv) => currencies.add(normalizeCurrency(inv.currency)));
    return Array.from(currencies);
  }, [validInvoices]);

  // Chart colors
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#10b981', '#f59e0b', '#8b5cf6'];

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      toast.error('No data to export');
      return;
    }

    const data = filteredInvoices.map((inv) => ({
      'Invoice Number': inv.invoice_number || '',
      'Date': inv.invoice_date || '',
      'Vendor': inv.vendor_name || '',
      'Vendor Tax ID': inv.vendor_tax_id || '',
      'Buyer': inv.buyer_name || '',
      'Buyer Tax ID': inv.buyer_tax_id || '',
      'Subtotal': inv.subtotal || 0,
      'Tax Rate (%)': inv.tax_rate || 0,
      'Tax Amount': inv.tax_amount || 0,
      'Total': inv.total_amount || 0,
      'Currency': normalizeCurrency(inv.currency),
      'Status': inv.status,
      'Created': new Date(inv.created_at).toLocaleDateString('en-US'),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit column widths
    const colWidths = Object.keys(data[0]).map((key) => ({
      wch: Math.max(key.length, ...data.map((row) => String((row as any)[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Spending Report');
    XLSX.writeFile(wb, `spending-report-${timeFilter}.xlsx`);
    toast.success('Report exported successfully!');
  };

  const formatByCurrency = (totals: Record<string, number>) => {
    const entries = Object.entries(totals).filter(([_, amount]) => amount > 0);
    if (entries.length === 0) return [{ currency: 'VND', amount: 0 }];
    return entries.map(([currency, amount]) => ({ currency, amount }));
  };

  const recentInvoices = invoices.slice(0, 5);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Home" subtitle="Manage your invoices" />
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
        title="Home" 
        subtitle="Manage your invoices"
      />
      
      <div className="p-6">
        {/* Quick Actions & Time Filter */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate('/upload')} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload new invoice
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
          <div className="ml-auto">
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Spending Stats - By Currency (filtered) */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total spending — {TIME_FILTER_LABELS[timeFilter]} ({stats.filteredCount} invoices)
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {formatByCurrency(stats.totalsByCurrency).map(({ currency, amount }) => (
              <Card key={currency} className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total {currency}
                  </CardTitle>
                  <Wallet className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {amount.toLocaleString('en-US')} {currency}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Monthly Spending Chart */}
        {chartData.length > 0 && chartCurrencies.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Spending trend — last 6 months</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))',
                      }}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString('en-US')} ${name}`,
                        '',
                      ]}
                    />
                    <Legend />
                    {chartCurrencies.map((cur, i) => (
                      <Line
                        key={cur}
                        type="monotone"
                        dataKey={cur}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total invoices
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
                Processed
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
                Pending
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
            <CardTitle>Recent invoices</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No invoices yet</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/upload')}
                  className="mt-2"
                >
                  Upload your first invoice
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
                          {invoice.vendor_name || invoice.invoice_number || 'Invoice'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.invoice_date || new Date(invoice.created_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {invoice.total_amount?.toLocaleString('en-US') || '—'}
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
                          ? 'Processed'
                          : invoice.status === 'pending'
                          ? 'Pending'
                          : invoice.status === 'rejected'
                          ? 'Rejected'
                          : invoice.status === 'cancelled'
                          ? 'Cancelled'
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
