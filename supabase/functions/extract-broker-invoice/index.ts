import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const BROKER_AI_API_URL = Deno.env.get("BROKER_AI_API_URL") ?? "";
const BROKER_AI_API_KEY = Deno.env.get("BROKER_AI_API_KEY") ?? "";

const SYSTEM_PROMPT = `You are an AI that extracts BROKER / SECURITIES / FX confirmation notes (advice slips, contract notes, dividend notices, FX confirmations) issued by banks or brokers.

Extract data and return ONLY valid JSON matching this schema. If a field is not present, return an empty string "".

SCHEMA:
{
  "client_name": "",
  "account_no": "",
  "description": "",
  "securities_id": "",
  "security_name": "",
  "transaction_type": "",     // One of: BUY, SELL, DIVIDEND, INTEREST, FX, TRANSFER, OTHER
  "trade_date": "",            // YYYY-MM-DD
  "settlement_date": "",       // YYYY-MM-DD
  "ex_date": "",               // YYYY-MM-DD
  "payment_date": "",          // YYYY-MM-DD
  "currency": "",
  "gross_amount": "",          // plain number, no separators
  "net_amount": "",
  "dividend_rate": "",
  "wht_rate": "",              // percentage as plain number, e.g. "15" for 15%
  "wht_amount": "",
  "units": "",
  "currency_buy": "",
  "currency_sell": "",
  "amount_buy": "",
  "amount_sell": "",
  "rate": "",
  "account_no_buy": "",
  "account_no_sell": "",
  "extend": {}                 // any extra fields you want to keep
}

RULES:
- Always output JSON only, no markdown.
- Numbers: output as plain numbers without thousand separators. Use dot for decimal.
- Dates: convert to YYYY-MM-DD.
- Determine transaction_type from context (Purchase/Buy → BUY, Sale/Sell → SELL, Dividend/Cash dividend → DIVIDEND, Interest → INTEREST, FX/Foreign Exchange → FX, Transfer → TRANSFER).
- For FX confirmations, fill currency_buy/sell, amount_buy/sell, rate, account_no_buy/sell.
- For dividend, fill securities_id, security_name, gross_amount, net_amount, wht_rate, wht_amount, payment_date, ex_date.`;

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

function calcConfidence(data: any): number {
  const weights: [string, number][] = [
    ["transaction_type", 3], ["client_name", 2], ["currency", 2],
    ["trade_date", 2], ["settlement_date", 1.5], ["payment_date", 1.5],
    ["securities_id", 2], ["security_name", 2], ["account_no", 1.5],
    ["gross_amount", 2.5], ["net_amount", 2.5], ["units", 1],
    ["wht_amount", 1], ["rate", 1],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const earned = weights.reduce((s, [f, w]) => {
    const v = data?.[f];
    return s + (v !== undefined && v !== null && String(v).trim() !== "" ? w : 0);
  }, 0);
  return Math.min(1, +(earned / total).toFixed(3));
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
      JSON.stringify({ data: out, extend, confidence_score, raw: parsed }),
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