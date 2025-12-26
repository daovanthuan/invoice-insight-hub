import { motion } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Invoice } from '@/types/invoice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RecentInvoicesProps {
  invoices: Invoice[];
}

const statusStyles = {
  processed: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="glass rounded-xl p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Invoices</h3>
          <p className="text-sm text-muted-foreground">Latest processed documents</p>
        </div>
        <Link to="/invoices">
          <Button variant="ghost" size="sm" className="gap-2">
            View All
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {invoices.slice(0, 5).map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * index }}
            className="flex items-center gap-4 rounded-lg bg-muted/30 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {invoice.core.invoice_id || invoice.filename}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {invoice.core.vendor_name}
              </p>
            </div>

            <div className="text-right">
              <p className="font-semibold text-foreground">
                {invoice.core.currency} {invoice.core.total_amount}
              </p>
              <p className="text-xs text-muted-foreground">
                {invoice.core.invoice_date}
              </p>
            </div>

            <Badge
              variant="outline"
              className={cn('capitalize', statusStyles[invoice.status])}
            >
              {invoice.status}
            </Badge>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
