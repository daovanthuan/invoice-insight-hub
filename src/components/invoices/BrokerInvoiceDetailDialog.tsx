import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Image as ImageIcon, Pencil, Save, X, User, Hash, Calendar, DollarSign, ArrowLeftRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrokerInvoice } from "@/types/database";
import {
  BROKER_FIELD_LABELS, BROKER_TX_TYPES, BROKER_TX_TYPE_LABELS, BROKER_NUMERIC_FIELDS,
  BROKER_STATUS_LABELS, BROKER_STATUS_STYLES, formatBrokerValue,
} from "@/lib/brokerFields";

interface Props {
  invoice: BrokerInvoice | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<BrokerInvoice>) => Promise<boolean>;
  onPreviewFile: (path: string | null) => void;
  loadingPreview: boolean;
}

const ALL_KEYS = Object.keys(BROKER_FIELD_LABELS);

type Section = { title: string; icon: React.ComponentType<{ className?: string }>; keys: string[] };

const SECTIONS: Section[] = [
  {
    title: "General",
    icon: User,
    keys: ["client_name", "account_no", "transaction_type", "currency", "description"],
  },
  {
    title: "Security",
    icon: Hash,
    keys: ["securities_id", "security_name", "units", "dividend_rate"],
  },
  {
    title: "Dates",
    icon: Calendar,
    keys: ["trade_date", "settlement_date", "ex_date", "payment_date"],
  },
  {
    title: "Amounts",
    icon: DollarSign,
    keys: ["gross_amount", "net_amount", "wht_rate", "wht_amount"],
  },
  {
    title: "FX / Funds Transfer",
    icon: ArrowLeftRight,
    keys: ["currency_buy", "amount_buy", "account_no_buy", "currency_sell", "amount_sell", "account_no_sell", "rate"],
  },
];

export function BrokerInvoiceDetailDialog({
  invoice, open, onClose, onSave, onPreviewFile, loadingPreview,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      const f: Record<string, string> = {};
      ALL_KEYS.forEach((k) => {
        const v = (invoice as any)[k];
        f[k] = v == null ? "" : String(v);
      });
      setForm(f);
      setEditing(false);
    }
  }, [invoice]);

  if (!invoice) return null;

  const hasValue = (k: string) => {
    const v = (invoice as any)[k];
    return v !== null && v !== undefined && v !== "";
  };

  const handleSave = async () => {
    setSaving(true);
    const updates: Partial<BrokerInvoice> = {};
    ALL_KEYS.forEach((k) => {
      const raw = form[k]?.trim() ?? "";
      if (BROKER_NUMERIC_FIELDS.has(k)) {
        if (raw === "") (updates as any)[k] = null;
        else {
          const n = parseFloat(raw.replace(/,/g, ""));
          (updates as any)[k] = isNaN(n) ? null : n;
        }
      } else if (k === "transaction_type") {
        (updates as any)[k] = (BROKER_TX_TYPES as readonly string[]).includes(raw) ? raw : null;
      } else {
        (updates as any)[k] = raw === "" ? null : raw;
      }
    });
    const ok = await onSave(invoice.id, updates);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Broker Invoice — {invoice.client_name || invoice.securities_id || "N/A"}</span>
            <Badge variant="outline" className={cn(BROKER_STATUS_STYLES[invoice.status])}>
              {BROKER_STATUS_LABELS[invoice.status] || invoice.status}
            </Badge>
            {invoice.transaction_type && (
              <Badge variant="secondary" className="font-normal">
                {BROKER_TX_TYPE_LABELS[invoice.transaction_type] || invoice.transaction_type}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Top bar: confidence + preview + edit */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground">AI confidence</p>
            {invoice.confidence_score != null ? (
              <div className="flex items-center gap-2 mt-1">
                <Progress
                  value={invoice.confidence_score * 100}
                  className={cn("h-2.5 w-24", invoice.confidence_score < 0.7 && "[&>div]:bg-warning")}
                />
                <span className={cn(
                  "text-sm font-semibold",
                  invoice.confidence_score < 0.7 ? "text-warning"
                    : invoice.confidence_score >= 0.9 ? "text-success" : "text-foreground"
                )}>
                  {Math.round(invoice.confidence_score * 100)}%
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {invoice.original_file_path && (
              <Button
                variant="outline" size="sm" className="gap-2"
                onClick={() => onPreviewFile(invoice.original_file_path)}
                disabled={loadingPreview}
              >
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                View original file
              </Button>
            )}
            {!editing ? (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Sectioned fields */}
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const keys = editing ? section.keys : section.keys.filter(hasValue);
            if (keys.length === 0) return null;
            const Icon = section.icon;
            return (
              <div key={section.title} className="rounded-lg border border-border bg-card/40">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 rounded-t-lg">
                  <Icon className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">{section.title}</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2 p-4">
                  {keys.map((k) => (
                    <div key={k} className="space-y-1.5">
                      <Label htmlFor={`bk-${k}`} className="text-xs text-muted-foreground">
                        {BROKER_FIELD_LABELS[k]}
                      </Label>
                      {!editing ? (
                        <p className="text-sm font-medium px-3 py-2 rounded-md bg-muted/40 min-h-[2.25rem]">
                          {formatBrokerValue(k, (invoice as any)[k])}
                        </p>
                      ) : k === "transaction_type" ? (
                        <Select
                          value={form[k] || ""}
                          onValueChange={(v) => setForm((p) => ({ ...p, [k]: v }))}
                        >
                          <SelectTrigger id={`bk-${k}`}><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {BROKER_TX_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{BROKER_TX_TYPE_LABELS[t] || t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`bk-${k}`}
                          value={form[k] || ""}
                          onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                          placeholder={BROKER_NUMERIC_FIELDS.has(k) ? "0" : ""}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {!editing && SECTIONS.every((s) => s.keys.filter(hasValue).length === 0) && (
            <p className="text-sm text-muted-foreground text-center p-6">No extracted data yet</p>
          )}
        </div>

        {invoice.extend && Object.keys(invoice.extend).length > 0 && (
          <div className="rounded-lg border border-border bg-card/40">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 rounded-t-lg">
              <FileText className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Extended information</h4>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 p-4">
              {Object.entries(invoice.extend).map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                  <p className="text-sm font-medium px-3 py-2 rounded-md bg-muted/40 min-h-[2.25rem]">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "N/A")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
