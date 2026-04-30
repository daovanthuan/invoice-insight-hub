import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const BROKER_AI_API_URL = Deno.env.get("BROKER_AI_API_URL") ?? "";
const BROKER_AI_API_KEY = Deno.env.get("BROKER_AI_API_KEY") ?? "";

const SYSTEM_PROMPT = `You are an AI that extracts BROKER / CUSTODIAN advice notes. There are ONLY 3 document types:

1. CREDIT_ADVICE — generic cash credit/debit advice (incoming wire, fee, transfer, interest, redemption, subscription, etc.)
2. DIVIDEND     — cash dividend / coupon / distribution advice for a security
3. FX_FT        — Foreign Exchange / Funds Transfer confirmation (currency conversion or cross-currency transfer)

Extract data and return ONLY valid JSON matching this schema. If a field is not present, return an empty string "".

SCHEMA:
{
  "client_name": "",
  "account_no": "",
  "description": "",
  "securities_id": "",
  "security_name": "",
  "transaction_type": "",     // EXACTLY one of: CREDIT_ADVICE, DIVIDEND, FX_FT
  "trade_date": "",            // YYYY-MM-DD (value/transaction date)
  "settlement_date": "",       // YYYY-MM-DD
  "ex_date": "",               // YYYY-MM-DD (DIVIDEND only)
  "payment_date": "",          // YYYY-MM-DD (DIVIDEND only)
  "currency": "",              // ISO 3-letter code (USD, VND, EUR...)
  "gross_amount": "",          // plain number, no separators
  "net_amount": "",
  "dividend_rate": "",
  "wht_rate": "",              // percentage as plain number, e.g. "15" for 15%
  "wht_amount": "",
  "units": "",
  "currency_buy": "",          // FX_FT only
  "currency_sell": "",         // FX_FT only
  "amount_buy": "",            // FX_FT only
  "amount_sell": "",           // FX_FT only
  "rate": "",                  // FX_FT only
  "account_no_buy": "",        // FX_FT only
  "account_no_sell": "",       // FX_FT only
  "extend": {}                 // any extra fields you want to keep
}

CLASSIFICATION RULES:
- DIVIDEND: document mentions "dividend", "coupon", "distribution", has ex_date / payment_date and a security identifier (ISIN, ticker, bond code).
- FX_FT: document mentions "Foreign Exchange", "FX confirmation", "Funds Transfer", currency conversion, has BOTH a buy and sell currency, OR an exchange rate between two currencies.
- CREDIT_ADVICE: anything else — generic credit/debit advice, wire receipt, fee, interest credit, redemption, subscription, transfer where only ONE currency is involved.

OUTPUT RULES:
- Always output JSON only, no markdown, no comments.
- Numbers: output as plain numbers without thousand separators. Use dot for decimal.
- Dates: convert to YYYY-MM-DD.
- For FX_FT, fill currency_buy/sell, amount_buy/sell, rate, account_no_buy/sell. Leave gross_amount/net_amount empty.
- For DIVIDEND, fill securities_id, security_name, gross_amount, net_amount, wht_rate, wht_amount, payment_date, ex_date, currency.
- For CREDIT_ADVICE, fill client_name, account_no, description, currency, gross_amount, net_amount, trade_date.`;

const FIELDS = [
  "client_name","account_no","description","securities_id","security_name","transaction_type",
  "trade_date","settlement_date","ex_date","payment_date","currency","gross_amount","net_amount",
  "dividend_rate","wht_rate","wht_amount","units","currency_buy","currency_sell","amount_buy",
  "amount_sell","rate","account_no_buy","account_no_sell"
];

function parseJsonFromAI(text: string): any {
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* */ }
    try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1")); } catch { /* */ }
  }
  return null;
}

// Helpers cho confidence
const has = (v: any) => v !== undefined && v !== null && String(v).trim() !== "";
const num = (v: any): number | null => {
  if (!has(v)) return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};
const isISODate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCurrency = (v: any) => typeof v === "string" && /^[A-Z]{3}$/.test(v.trim());

// Trọng số field theo 3 loại GD broker hiện hành
const FIELD_WEIGHTS_BY_TYPE: Record<string, Array<[string, number]>> = {
  CREDIT_ADVICE: [
    ["transaction_type", 3], ["client_name", 2], ["currency", 2.5],
    ["trade_date", 2.5], ["account_no", 2],
    ["gross_amount", 2.5], ["net_amount", 2.5], ["description", 1.5],
  ],
  DIVIDEND: [
    ["transaction_type", 3], ["client_name", 2], ["currency", 2],
    ["ex_date", 1.5], ["payment_date", 2],
    ["securities_id", 2.5], ["security_name", 2], ["account_no", 1.5],
    ["gross_amount", 2.5], ["net_amount", 2.5],
    ["dividend_rate", 1], ["wht_amount", 1.5],
  ],
  FX_FT: [
    ["transaction_type", 3], ["client_name", 2], ["trade_date", 2.5],
    ["currency_buy", 2.5], ["currency_sell", 2.5],
    ["amount_buy", 2.5], ["amount_sell", 2.5], ["rate", 2],
    ["account_no_buy", 1.5], ["account_no_sell", 1.5],
  ],
};

function calcConfidence(data: any): number {
  if (!data) return 0;

  const tx = String(data.transaction_type || "").toUpperCase();
  const weights = FIELD_WEIGHTS_BY_TYPE[tx] || FIELD_WEIGHTS_BY_TYPE.CREDIT_ADVICE;

  // 1) Field coverage theo loại GD
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const earned = weights.reduce((s, [f, w]) => s + (has(data?.[f]) ? w : 0), 0);
  let score = total > 0 ? earned / total : 0;

  // 2) Format penalties
  const dateFields = ["trade_date", "settlement_date", "ex_date", "payment_date"];
  for (const df of dateFields) {
    if (has(data?.[df]) && !isISODate(data[df])) score -= 0.05;
  }
  if (has(data?.currency) && !isCurrency(data.currency)) score -= 0.05;
  if (tx === "FX_FT") {
    if (has(data?.currency_buy) && !isCurrency(data.currency_buy)) score -= 0.05;
    if (has(data?.currency_sell) && !isCurrency(data.currency_sell)) score -= 0.05;
  }

  // 3) Numeric sanity: số tiền phải > 0
  const amountFields = ["gross_amount", "net_amount", "amount_buy", "amount_sell"];
  for (const af of amountFields) {
    const n = num(data?.[af]);
    if (n !== null && n <= 0) score -= 0.05;
  }

  // 4) Cross-field consistency bonus (cộng tối đa +0.10)
  let bonus = 0;
  const gross = num(data?.gross_amount);
  const net = num(data?.net_amount);
  const wht = num(data?.wht_amount) ?? 0;
  if (gross !== null && net !== null && gross > 0) {
    // gross - wht ≈ net (sai số <= 1%)
    const diff = Math.abs(gross - wht - net);
    if (diff / gross <= 0.01) bonus += 0.06;
  }
  if (tx === "FX_FT") {
    const ab = num(data?.amount_buy);
    const as_ = num(data?.amount_sell);
    const rate = num(data?.rate);
    if (ab && as_ && rate && rate > 0) {
      // amount_sell ≈ amount_buy * rate (sai số <= 2%)
      const expected = ab * rate;
      if (expected > 0 && Math.abs(expected - as_) / expected <= 0.02) bonus += 0.08;
    }
  }

  score = Math.max(0, Math.min(1, score + bonus));
  return +score.toFixed(3);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, mimeType, fileName } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Missing fileBase64 or mimeType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Try Custom AI (FastAPI / LayoutLMv3 on HF Spaces) first =====
    if (BROKER_AI_API_URL) {
      try {
        const url = BROKER_AI_API_URL.replace(/\/+$/, "") + "/extract";
        console.log("Calling broker AI:", url);
        const customResp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(BROKER_AI_API_KEY ? { Authorization: `Bearer ${BROKER_AI_API_KEY}` } : {}),
          },
          body: JSON.stringify({ image_base64: fileBase64, mime_type: mimeType, file_name: fileName }),
          signal: AbortSignal.timeout(120_000),
        });

        if (customResp.ok) {
          const cj = await customResp.json();
          const dataObj = cj?.data ?? cj;
          if (dataObj && typeof dataObj === "object") {
            const out: Record<string, any> = {};
            for (const f of FIELDS) out[f] = dataObj[f] ?? "";
            const extend: Record<string, any> = (dataObj.extend && typeof dataObj.extend === "object") ? dataObj.extend : {};
            for (const [k, v] of Object.entries(dataObj)) {
              if (!FIELDS.includes(k) && k !== "extend" && v !== "" && v !== null && v !== undefined) {
                extend[k] = v;
              }
            }
            const confidence_score = typeof cj?.confidence === "number" ? cj.confidence : calcConfidence(out);
            return new Response(
              JSON.stringify({ data: out, extend, confidence_score, raw: dataObj, source: "custom_ai" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const errTxt = await customResp.text();
          console.error("Custom broker AI failed:", customResp.status, errTxt);
        }
      } catch (err) {
        console.error("Custom broker AI exception, falling back to Gemini:", err);
      }
    }

    // ===== Fallback: Gemini via Lovable AI Gateway =====
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isPdf = mimeType === "application/pdf";
    const userContent = isPdf
      ? [
          { type: "file", file: { filename: fileName || "broker.pdf", file_data: `data:application/pdf;base64,${fileBase64}` } },
          { type: "text", text: "Extract broker/securities/FX confirmation data. JSON only." },
        ]
      : [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
          { type: "text", text: "Extract broker/securities/FX confirmation data. JSON only." },
        ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Đã vượt giới hạn yêu cầu, vui lòng thử lại sau." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Hết credit AI, vui lòng nạp thêm trong Workspace Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content as string | undefined;
    if (!content) throw new Error("No content in AI response");

    const parsed = parseJsonFromAI(content);
    if (!parsed) throw new Error("Failed to parse AI response");

    // Build a clean output, separating known vs extend
    const out: Record<string, any> = {};
    for (const f of FIELDS) out[f] = parsed[f] ?? "";
    const extend = parsed.extend && typeof parsed.extend === "object" ? parsed.extend : {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!FIELDS.includes(k) && k !== "extend" && v !== "" && v !== null && v !== undefined) {
        extend[k] = v;
      }
    }

    const confidence_score = calcConfidence(out);

    return new Response(
      JSON.stringify({ data: out, extend, confidence_score, raw: parsed, source: "gemini" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-broker-invoice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});