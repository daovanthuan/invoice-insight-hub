import * as XLSX from "xlsx";
import { Invoice } from "@/types/database";
import { BrokerInvoice } from "@/types/database";
import { BROKER_FIELD_LABELS, BROKER_STATUS_LABELS, getBrokerVisibleFields, formatBrokerValue } from "@/lib/brokerFields";

const statusLabels: Record<string, string> = {
  processed: "Processed",
  approved: "Approved",
  pending: "Pending",
  draft: "Draft",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const mapInvoiceRow = (inv: Invoice) => ({
  "Invoice No.": inv.invoice_number || "",
  "Serial": inv.invoice_serial || "",
  "Invoice Date": inv.invoice_date || "",
  "Vendor": inv.vendor_name || "",
  "Vendor Tax ID": inv.vendor_tax_id || "",
  "Buyer": inv.buyer_name || "",
  "Buyer Tax ID": inv.buyer_tax_id || "",
  "Currency": inv.currency || "",
  "Subtotal": inv.subtotal || 0,
  "Tax Rate (%)": inv.tax_rate || 0,
  "Tax Amount": inv.tax_amount || 0,
  "Total": inv.total_amount || 0,
  "Status": statusLabels[inv.status] || inv.status,
  "Payment Method": inv.payment_method || "",
  "Created": inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-US") : "",
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
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
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
  row["Status"] = BROKER_STATUS_LABELS[inv.status] || inv.status;
  row["Confidence (%)"] =
    inv.confidence_score != null ? Math.round(inv.confidence_score * 100) : "";
  row["Created"] = inv.created_at
    ? new Date(inv.created_at).toLocaleDateString("en-US")
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
