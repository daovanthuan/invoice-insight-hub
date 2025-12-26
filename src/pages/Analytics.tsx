import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { mockDashboardStats, mockInvoices } from '@/data/mockData';
import { StatCard } from '@/components/dashboard/StatCard';
import { InvoiceChart } from '@/components/dashboard/InvoiceChart';
import { StatusPieChart } from '@/components/dashboard/StatusPieChart';
import { TopVendorsChart } from '@/components/dashboard/TopVendorsChart';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Users,
  Calendar,
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

export default function AnalyticsPage() {
  const stats = mockDashboardStats;

  // Generate weekly data
  const weeklyData = [
    { day: 'Mon', invoices: 12, amount: 45000 },
    { day: 'Tue', invoices: 19, amount: 72000 },
    { day: 'Wed', invoices: 8, amount: 31000 },
    { day: 'Thu', invoices: 15, amount: 58000 },
    { day: 'Fri', invoices: 22, amount: 89000 },
    { day: 'Sat', invoices: 5, amount: 18000 },
    { day: 'Sun', invoices: 3, amount: 12000 },
  ];

  // Extraction success rate data
  const successRateData = [
    { month: 'Jul', rate: 92 },
    { month: 'Aug', rate: 94 },
    { month: 'Sep', rate: 95 },
    { month: 'Oct', rate: 97 },
    { month: 'Nov', rate: 98 },
    { month: 'Dec', rate: 99 },
  ];

  // Currency distribution
  const currencyData = [
    { currency: 'USD', count: 89, percentage: 57 },
    { currency: 'EUR', count: 34, percentage: 22 },
    { currency: 'GBP', count: 18, percentage: 12 },
    { currency: 'SGD', count: 15, percentage: 9 },
  ];

  return (
    <MainLayout>
      <Header title="Analytics" subtitle="Deep insights into your invoice data" />

      <div className="p-6 space-y-8">
        {/* Top Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="This Week"
            value="84"
            change="+23% vs last week"
            changeType="positive"
            icon={FileText}
            delay={0}
          />
          <StatCard
            title="Weekly Revenue"
            value="$325k"
            change="+18% vs last week"
            changeType="positive"
            icon={DollarSign}
            iconColor="text-success"
            delay={0.1}
          />
          <StatCard
            title="Active Vendors"
            value="28"
            change="+4 new this month"
            changeType="positive"
            icon={Users}
            iconColor="text-chart-2"
            delay={0.2}
          />
          <StatCard
            title="Avg. Processing Time"
            value="2.3s"
            change="-0.5s improvement"
            changeType="positive"
            icon={Calendar}
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
              <h3 className="text-lg font-semibold text-foreground">Weekly Activity</h3>
              <p className="text-sm text-muted-foreground">Invoices processed per day</p>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
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
              <h3 className="text-lg font-semibold text-foreground">AI Extraction Accuracy</h3>
              <p className="text-sm text-muted-foreground">Monthly success rate trend</p>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={successRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    domain={[85, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value) => [`${value}%`, 'Accuracy']}
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
            </div>
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <InvoiceChart
              data={stats.monthlyData}
              title="Revenue Trend"
              subtitle="Total invoice amounts by month"
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
              <p className="text-sm text-muted-foreground">Invoices by currency type</p>
            </div>
            <div className="space-y-4">
              {currencyData.map((item, idx) => (
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
              ))}
            </div>
          </motion.div>

          <TopVendorsChart data={stats.topVendors} />
        </div>
      </div>
    </MainLayout>
  );
}
