import { BrokerInvoice } from "@/types/database";

export const BROKER_FIELD_LABELS: Record<string, string> = {
  client_name: "Khách hàng",
  account_no: "Số tài khoản",
  description: "Mô tả",
  securities_id: "Mã chứng khoán",
  security_name: "Tên chứng khoán",
  transaction_type: "Loại GD",
  trade_date: "Ngày GD",
  settlement_date: "Ngày thanh toán",
  ex_date: "Ngày chốt quyền",
  payment_date: "Ngày trả",
  currency: "Tiền tệ",
  units: "Số lượng",
  gross_amount: "Tổng (gross)",
  net_amount: "Net amount",
  dividend_rate: "Tỷ lệ cổ tức",
  wht_rate: "WHT (%)",
  wht_amount: "Số tiền WHT",
  currency_buy: "Tiền tệ mua",
  currency_sell: "Tiền tệ bán",
  amount_buy: "Số tiền mua",
  amount_sell: "Số tiền bán",
  rate: "Tỷ giá",
  account_no_buy: "TK mua",
  account_no_sell: "TK bán",
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
  pending: "Đang chờ",
  completed: "Hoàn tất",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
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
    return value.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
  }
  return String(value);
}
