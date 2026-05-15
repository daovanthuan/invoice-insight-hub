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
  "transaction_type": "",
  "trade_date": "",
  "settlement_date": "",
  "ex_date": "",
  "payment_date": "",
  "currency": "",
  "gross_amount": "",
  "net_amount": "",
  "dividend_rate": "",
  "wht_rate": "",
  "wht_amount": "",
  "units": "",
  "currency_buy": "",
  "currency_sell": "",
  "amount_buy": "",
  "amount_sell": "",
  "rate": "",
  "account_no_buy": "",
  "account_no_sell": "",
  "extend": {}
}

OUTPUT RULES:
- Always output JSON only, no markdown, no comments.
- Numbers: output as plain numbers without thousand separators. Use dot for decimal.
- Dates: convert to YYYY-MM-DD.
- For FX_FT, fill currency_buy/sell, amount_buy/sell, rate, account_no_buy/sell. Leave gross_amount/net_amount empty.
- For DIVIDEND, fill securities_id, security_name, gross_amount, net_amount, wht_rate, wht_amount, payment_date, ex_date, currency.
- For CREDIT_ADVICE, fill client_name, account_no, description, currency, gross_amount, net_amount, trade_date.`;

const FIELDS = [
  "client_name",
  "account_no",
  "description",
  "securities_id",
  "security_name",
  "transaction_type",
  "trade_date",
  "settlement_date",
  "ex_date",
  "payment_date",
  "currency",
  "gross_amount",
  "net_amount",
  "dividend_rate",
  "wht_rate",
  "wht_amount",
  "units",
  "currency_buy",
  "currency_sell",
  "amount_buy",
  "amount_sell",
  "rate",
  "account_no_buy",
  "account_no_sell",
];

function parseJsonFromAI(text: string): any {
  let cleaned = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // ignore
  }

  const m = cleaned.match(/\{[\s\S]*\}/);

  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      // ignore
    }

    try {
      return JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1"));
    } catch {
      // ignore
    }
  }

  return null;
}

const has = (v: any) =>
  v !== undefined && v !== null && String(v).trim() !== "";

const num = (v: any): number | null => {
  if (!has(v)) return null;

  const n = parseFloat(String(v).replace(/,/g, ""));

  return isNaN(n) ? null : n;
};

const isISODate = (v: any) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isCurrency = (v: any) =>
  typeof v === "string" && /^[A-Z]{3}$/.test(v.trim());

const FIELD_WEIGHTS_BY_TYPE: Record<string, Array<[string, number]>> = {
  CREDIT_ADVICE: [
    ["transaction_type", 3],
    ["client_name", 2],
    ["currency", 2.5],
    ["trade_date", 2.5],
    ["account_no", 2],
    ["gross_amount", 2.5],
    ["net_amount", 2.5],
    ["description", 1.5],
  ],
  DIVIDEND: [
    ["transaction_type", 3],
    ["client_name", 2],
    ["currency", 2],
    ["ex_date", 1.5],
    ["payment_date", 2],
    ["securities_id", 2.5],
    ["security_name", 2],
    ["account_no", 1.5],
    ["gross_amount", 2.5],
    ["net_amount", 2.5],
    ["dividend_rate", 1],
    ["wht_amount", 1.5],
  ],
  FX_FT: [
    ["transaction_type", 3],
    ["client_name", 2],
    ["trade_date", 2.5],
    ["currency_buy", 2.5],
    ["currency_sell", 2.5],
    ["amount_buy", 2.5],
    ["amount_sell", 2.5],
    ["rate", 2],
    ["account_no_buy", 1.5],
    ["account_no_sell", 1.5],
  ],
};

function calcConfidence(data: any): number {
  if (!data) return 0;

  const tx = String(data.transaction_type || "").toUpperCase();
  const weights =
    FIELD_WEIGHTS_BY_TYPE[tx] || FIELD_WEIGHTS_BY_TYPE.CREDIT_ADVICE;

  const total = weights.reduce((s, [, w]) => s + w, 0);
  const earned = weights.reduce(
    (s, [f, w]) => s + (has(data?.[f]) ? w : 0),
    0,
  );

  let score = total > 0 ? earned / total : 0;

  const dateFields = [
    "trade_date",
    "settlement_date",
    "ex_date",
    "payment_date",
  ];

  for (const df of dateFields) {
    if (has(data?.[df]) && !isISODate(data[df])) score -= 0.05;
  }

  if (has(data?.currency) && !isCurrency(data.currency)) score -= 0.05;

  if (tx === "FX_FT") {
    if (has(data?.currency_buy) && !isCurrency(data.currency_buy)) score -= 0.05;
    if (has(data?.currency_sell) && !isCurrency(data.currency_sell)) score -= 0.05;
  }

  const amountFields = [
    "gross_amount",
    "net_amount",
    "amount_buy",
    "amount_sell",
  ];

  for (const af of amountFields) {
    const n = num(data?.[af]);
    if (n !== null && n <= 0) score -= 0.05;
  }

  let bonus = 0;

  const gross = num(data?.gross_amount);
  const net = num(data?.net_amount);
  const wht = num(data?.wht_amount) ?? 0;

  if (gross !== null && net !== null && gross > 0) {
    const diff = Math.abs(gross - Math.abs(wht) - net);
    if (diff / gross <= 0.01) bonus += 0.06;
  }

  if (tx === "FX_FT") {
    const ab = num(data?.amount_buy);
    const as_ = num(data?.amount_sell);
    const rate = num(data?.rate);

    if (ab && as_ && rate && rate > 0) {
      const expected1 = ab * rate;
      const expected2 = as_ * rate;

      if (expected1 > 0 && Math.abs(expected1 - as_) / expected1 <= 0.02) {
        bonus += 0.08;
      } else if (
        expected2 > 0 &&
        Math.abs(expected2 - ab) / expected2 <= 0.02
      ) {
        bonus += 0.08;
      }
    }
  }

  score = Math.max(0, Math.min(1, score + bonus));

  return +score.toFixed(3);
}

function normalizeTransactionType(v: any): string {
  const s = String(v || "").toUpperCase();

  if (s.includes("FX")) return "FX_FT";
  if (s.includes("DIVIDEND") || s.includes("ADVICE / STATEMENT")) {
    return "DIVIDEND";
  }
  if (s.includes("CREDIT") || s.includes("DEBIT")) return "CREDIT_ADVICE";

  return s || "";
}

function normalizeDateToISO(v: any): string {
  if (!has(v)) return "";

  const s = String(v).trim();

  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return s;
}

function normalizeAmount(v: any): string {
  if (!has(v)) return "";

  return String(v)
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizePercentValue(v: any): string {
  if (!has(v)) return "";

  return String(v)
    .replace("%", "")
    .trim();
}

function normalizeBrokerAIOutput(dataObj: any): Record<string, any> {
  const src = dataObj || {};

  return {
    client_name: src.CLIENT_NAME ?? src.client_name ?? "",
    account_no: src.ACCOUNT_NO ?? src.account_no ?? "",
    description: src.DESCRIPTION ?? src.description ?? "",
    securities_id: src.SECURITIES_ID ?? src.securities_id ?? "",
    security_name: src.SECURITY_NAME ?? src.security_name ?? "",

    transaction_type: normalizeTransactionType(
      src.TRANSACTION_TYPE ?? src.transaction_type ?? "",
    ),

    trade_date: normalizeDateToISO(src.TRADE_DATE ?? src.trade_date ?? ""),
    settlement_date: normalizeDateToISO(
      src.SETTLEMENT_DATE ?? src.settlement_date ?? "",
    ),
    ex_date: normalizeDateToISO(src.EX_DATE ?? src.ex_date ?? ""),
    payment_date: normalizeDateToISO(
      src.PAYMENT_DATE ?? src.payment_date ?? "",
    ),

    currency: src.CURRENCY ?? src.currency ?? "",

    gross_amount: normalizeAmount(src.GROSS_AMOUNT ?? src.gross_amount ?? ""),
    net_amount: normalizeAmount(src.NET_AMOUNT ?? src.net_amount ?? ""),
    dividend_rate: normalizeAmount(
      src.DIVIDEND_RATE ?? src.dividend_rate ?? "",
    ),
    wht_rate: normalizePercentValue(src.WHT_RATE ?? src.wht_rate ?? ""),
    wht_amount: normalizeAmount(src.WHT_AMOUNT ?? src.wht_amount ?? ""),
    units: normalizeAmount(src.UNITS ?? src.units ?? ""),

    currency_buy: src.CURRENCY_BUY ?? src.currency_buy ?? "",
    currency_sell: src.CURRENCY_SELL ?? src.currency_sell ?? "",
    amount_buy: normalizeAmount(src.AMOUNT_BUY ?? src.amount_buy ?? ""),
    amount_sell: normalizeAmount(src.AMOUNT_SELL ?? src.amount_sell ?? ""),
    rate: normalizeAmount(src.RATE ?? src.rate ?? ""),
    account_no_buy: src.ACCOUNT_NO_BUY ?? src.account_no_buy ?? "",
    account_no_sell: src.ACCOUNT_NO_SELL ?? src.account_no_sell ?? "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const { fileBase64, mimeType, fileName } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({
          error: "Missing fileBase64 or mimeType",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ===== Try Custom AI: Hugging Face Gradio Space first =====
if (BROKER_AI_API_URL) {
  try {
    const baseUrl = BROKER_AI_API_URL.replace(/\/+$/, "");

    const submitUrl =
      `${baseUrl}/gradio_api/call/predict`;
    
    console.log("HF submit URL:", submitUrl);
    
    const submitResp = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(BROKER_AI_API_KEY
          ? { Authorization: `Bearer ${BROKER_AI_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        data: [
          {
            name: fileName || "broker.pdf",
            data: `data:${mimeType};base64,${fileBase64}`,
          },
        ],
      }),
    });
    });

    if (!submitResp.ok) {
      const errTxt = await submitResp.text();
      console.error("Custom broker AI submit failed:", submitResp.status, errTxt);
      throw new Error(`HF submit failed: ${submitResp.status}`);
    }

    const submitJson = await submitResp.json();
    console.log("HF submit response:", JSON.stringify(submitJson));

    let cj: any = submitJson;

    // Gradio /call/predict usually returns { event_id }
    if (submitJson?.event_id) {
      const eventUrl = `${baseUrl}/call/predict/${submitJson.event_id}`;

      console.log("Polling broker AI:", eventUrl);

      const eventResp = await fetch(eventUrl, {
        method: "GET",
        headers: {
          ...(BROKER_AI_API_KEY
            ? { Authorization: `Bearer ${BROKER_AI_API_KEY}` }
            : {}),
        },
        signal: AbortSignal.timeout(180_000),
      });

      if (!eventResp.ok) {
        const errTxt = await eventResp.text();
        console.error("Custom broker AI event failed:", eventResp.status, errTxt);
        throw new Error(`HF event failed: ${eventResp.status}`);
      }

      const eventText = await eventResp.text();
      console.log("HF event raw:", eventText);

      const dataLine = eventText
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!dataLine) {
        throw new Error("HF event response has no data line");
      }

      cj = JSON.parse(dataLine.replace(/^data:\s*/, ""));
    }

    const dataObj = Array.isArray(cj?.data)
      ? cj.data[0]
      : cj?.data ?? cj;

    if (dataObj && typeof dataObj === "object") {
      const normalized = normalizeBrokerAIOutput(dataObj);

      const out: Record<string, any> = {};

      for (const f of FIELDS) {
        out[f] = normalized[f] ?? "";
      }

      const extend: Record<string, any> = {};

      for (const [k, v] of Object.entries(dataObj)) {
        if (
          !FIELDS.includes(k) &&
          k !== "extend" &&
          v !== "" &&
          v !== null &&
          v !== undefined
        ) {
          extend[k] = v;
        }
      }

      const confidence_score = calcConfidence(out);

      return new Response(
        JSON.stringify({
          data: out,
          extend,
          confidence_score,
          raw: dataObj,
          source: "custom_ai",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  } catch (err) {
    console.error("Custom broker AI exception, falling back to Gemini:", err);
  }
}

    // ===== Fallback: Gemini via Lovable AI Gateway =====
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const isPdf = mimeType === "application/pdf";

    const userContent = isPdf
      ? [
        {
          type: "file",
          file: {
            filename: fileName || "broker.pdf",
            file_data: `data:application/pdf;base64,${fileBase64}`,
          },
        },
        {
          type: "text",
          text: "Extract broker/securities/FX confirmation data. JSON only.",
        },
      ]
      : [
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${fileBase64}`,
          },
        },
        {
          type: "text",
          text: "Extract broker/securities/FX confirmation data. JSON only.",
        },
      ];

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: userContent,
            },
          ],
        }),
      },
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Đã vượt giới hạn yêu cầu, vui lòng thử lại sau.",
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (resp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Hết credit AI, vui lòng nạp thêm trong Workspace Settings.",
          }),
          {
            status: 402,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const t = await resp.text();

      console.error("AI gateway error:", resp.status, t);

      return new Response(
        JSON.stringify({
          error: "AI gateway error",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const json = await resp.json();

    const content = json?.choices?.[0]?.message?.content as string | undefined;

    if (!content) {
      throw new Error("No content in AI response");
    }

    const parsed = parseJsonFromAI(content);

    if (!parsed) {
      throw new Error("Failed to parse AI response");
    }

    const out: Record<string, any> = {};

    for (const f of FIELDS) {
      out[f] = parsed[f] ?? "";
    }

    const extend =
      parsed.extend && typeof parsed.extend === "object" ? parsed.extend : {};

    for (const [k, v] of Object.entries(parsed)) {
      if (
        !FIELDS.includes(k) &&
        k !== "extend" &&
        v !== "" &&
        v !== null &&
        v !== undefined
      ) {
        extend[k] = v;
      }
    }

    const confidence_score = calcConfidence(out);

    return new Response(
      JSON.stringify({
        data: out,
        extend,
        confidence_score,
        raw: parsed,
        source: "gemini",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (e) {
    console.error("extract-broker-invoice error:", e);

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
