import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface VendorData {
  name: string;
  count: number;
  amount: number;
}

interface TopVendorsChartProps {
  data: VendorData[];
}

export function TopVendorsChart({ data }: TopVendorsChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="glass rounded-xl p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Top Vendors</h3>
        <p className="text-sm text-muted-foreground">By total invoice amount</p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={120}
              tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--popover-foreground))',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
            />
            <Bar
              dataKey="amount"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
