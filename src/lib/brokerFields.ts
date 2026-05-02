import { BrokerInvoice } from "@/types/database";

export const BROKER_FIELD_LABELS: Record<string, string> = {
  client_name: "Client",
  account_no: "Account No.",
  description: "Description",
  securities_id: "Securities ID",
  security_name: "Security Name",
  transaction_type: "Transaction Type",
  trade_date: "Trade Date",
  settlement_date: "Settlement Date",
  ex_date: "Ex Date",
  payment_date: "Payment Date",
  currency: "Currency",
  units: "Units",
  gross_amount: "Gross Amount",
  net_amount: "Net Amount",
  dividend_rate: "Dividend Rate",
  wht_rate: "WHT (%)",
  wht_amount: "WHT Amount",
  currency_buy: "Buy Currency",
  currency_sell: "Sell Currency",
  amount_buy: "Buy Amount",
  amount_sell: "Sell Amount",
  rate: "Rate",
  account_no_buy: "Buy Account",
  account_no_sell: "Sell Account",
};

export const BROKER_TX_TYPES = ["CREDIT_ADVICE", "DIVIDEND", "FX_FT"] as const;

export const BROKER_TX_TYPE_LABELS: Record<string, string> = {
  CREDIT_ADVICE: "Credit Advice",
  DIVIDEND: "Dividend",
  FX_FT: "FX-FT",
};

export const BROKER_NUMERIC_FIELDS = new Set([
  "units", "gross_amount", "net_amount", "dividend_rate",
  "wht_rate", "wht_amount", "amount_buy", "amount_sell", "rate",
]);

export const BROKER_DATE_FIELDS = new Set([
  "trade_date", "settlement_date", "ex_date", "payment_date",
]);

export const BROKER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const BROKER_STATUS_STYLES: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted/50 text-muted-foreground border-muted line-through",
};

/** Trả về danh sách field có ít nhất 1 dòng có data (không null/empty). */
export function getBrokerVisibleFields(rows: BrokerInvoice[], keys: string[]): string[] {
  return keys.filter((k) =>
    rows.some((r) => {
      const v = (r as any)[k];
      return v !== null && v !== undefined && v !== "";
    })
  );
}

export function formatBrokerValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (key === "transaction_type") {
    return BROKER_TX_TYPE_LABELS[String(value)] || String(value);
  }
  if (BROKER_NUMERIC_FIELDS.has(key) && typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return String(value);
}
