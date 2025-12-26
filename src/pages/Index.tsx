import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { InvoiceChart } from '@/components/dashboard/InvoiceChart';
import { StatusPieChart } from '@/components/dashboard/StatusPieChart';
import { TopVendorsChart } from '@/components/dashboard/TopVendorsChart';
import { RecentInvoices } from '@/components/dashboard/RecentInvoices';
import { mockInvoices, mockDashboardStats } from '@/data/mockData';
import {
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
} from 'lucide-react';

const Index = () => {
  const stats = mockDashboardStats;

  return (
    <MainLayout>
      <Header 
        title="Dashboard" 
        subtitle="Invoice extraction powered by AI"
      />
      
      <div className="p-6">
        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Invoices"
            value={stats.totalInvoices.toLocaleString()}
            change="+12% from last month"
            changeType="positive"
            icon={FileText}
            delay={0}
          />
          <StatCard
            title="Total Amount"
            value={`$${(stats.totalAmount / 1000).toFixed(1)}k`}
            change="+8.2% from last month"
            changeType="positive"
            icon={DollarSign}
            iconColor="text-success"
            delay={0.1}
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingInvoices}
            change="Requires attention"
            changeType="neutral"
            icon={Clock}
            iconColor="text-warning"
            delay={0.2}
          />
          <StatCard
            title="Avg. Invoice Value"
            value={`$${stats.averageAmount.toLocaleString()}`}
            change="+3.1% from last month"
            changeType="positive"
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
              title="Invoice Trend"
              subtitle="Monthly invoice amounts (Last 6 months)"
            />
          </div>
          <StatusPieChart data={stats.statusDistribution} />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopVendorsChart data={stats.topVendors} />
          <RecentInvoices invoices={mockInvoices} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
