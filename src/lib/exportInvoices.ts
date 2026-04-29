import * as XLSX from "xlsx";
import { Invoice } from "@/types/database";
import { BrokerInvoice } from "@/types/database";
import { BROKER_FIELD_LABELS, BROKER_STATUS_LABELS, getBrokerVisibleFields, formatBrokerValue } from "@/lib/brokerFields";

const statusLabels: Record<string, string> = {
  processed: "Đã xử lý",
  approved: "Đã duyệt",
  pending: "Đang chờ",
  draft: "Nháp",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

const mapInvoiceRow = (inv: Invoice) => ({
  "Mã HĐ": inv.invoice_number || "",
  "Ký hiệu": inv.invoice_serial || "",
  "Ngày HĐ": inv.invoice_date || "",
  "Nhà cung cấp": inv.vendor_name || "",
  "MST NCC": inv.vendor_tax_id || "",
  "Người mua": inv.buyer_name || "",
  "MST NM": inv.buyer_tax_id || "",
  "Tiền tệ": inv.currency || "",
  "Cộng tiền hàng": inv.subtotal || 0,
  "Thuế suất (%)": inv.tax_rate || 0,
  "Tiền thuế": inv.tax_amount || 0,
  "Tổng cộng": inv.total_amount || 0,
  "Trạng thái": statusLabels[inv.status] || inv.status,
  "HTTT": inv.payment_method || "",
  "Ngày tạo": inv.created_at ? new Date(inv.created_at).toLocaleDateString("vi-VN") : "",
});

export const exportToExcel = (invoices: Invoice[], filename = "invoices") => {
  const rows = invoices.map(mapInvoiceRow);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hóa đơn");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToCSV = (invoices: Invoice[], filename = "invoices") => {
  const rows = invoices.map(mapInvoiceRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  // BOM for Vietnamese characters
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ===== Broker exports =====
const BROKER_KEYS = Object.keys(BROKER_FIELD_LABELS);

const mapBrokerRow = (inv: BrokerInvoice, keys: string[]) => {
  const row: Record<string, unknown> = {};
  keys.forEach((k) => {
    row[BROKER_FIELD_LABELS[k]] = formatBrokerValue(k, (inv as any)[k]);
  });
  row["Trạng thái"] = BROKER_STATUS_LABELS[inv.status] || inv.status;
  row["Độ tin cậy (%)"] =
    inv.confidence_score != null ? Math.round(inv.confidence_score * 100) : "";
  row["Ngày tạo"] = inv.created_at
    ? new Date(inv.created_at).toLocaleDateString("vi-VN")
    : "";
  return row;
};

export const exportBrokerToExcel = (invoices: BrokerInvoice[], filename = "broker-invoices") => {
  const visible = getBrokerVisibleFields(invoices, BROKER_KEYS);
  const keys = visible.length ? visible : BROKER_KEYS;
  const rows = invoices.map((i) => mapBrokerRow(i, keys));
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length)) + 2,
  }));
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Broker");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportBrokerToCSV = (invoices: BrokerInvoice[], filename = "broker-invoices") => {
  const visible = getBrokerVisibleFields(invoices, BROKER_KEYS);
  const keys = visible.length ? visible : BROKER_KEYS;
  const rows = invoices.map((i) => mapBrokerRow(i, keys));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
