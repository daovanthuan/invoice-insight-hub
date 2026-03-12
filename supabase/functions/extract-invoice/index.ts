import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// EXTRACTION MODE CONFIGURATION
// Set to "gemini" (default) or "custom" to use your own AI API
// ============================================================
const EXTRACTION_MODE = (Deno.env.get("EXTRACTION_MODE") ?? "gemini") as "gemini" | "custom";
const CUSTOM_API_URL = Deno.env.get("CUSTOM_AI_API_URL") ?? "";
const CUSTOM_API_KEY = Deno.env.get("CUSTOM_AI_API_KEY") ?? "";

// ============================================================
// FIELD MAPPING: maps your custom API field names → system fields
// Only used when EXTRACTION_MODE = "custom"
// Edit this if your API returns different field names
// ============================================================
const CUSTOM_FIELD_MAPPING: Record<string, string> = {
  // "your_field_name": "system_field_name",
  // Example:
  // "ten_ncc": "vendor_name",
  // "mst_ncc": "vendor_tax_id",
  // "dia_chi_ncc": "vendor_address",
  // "so_hd": "invoice_number",
  // "ngay_hd": "invoice_date",
  // "tong_tien": "total_amount",
};

const SYSTEM_FIELDS = [
  "vendor_name", "vendor_tax_id", "vendor_address", "vendor_phone",
  "vendor_fax", "vendor_account_no", "buyer_name", "buyer_tax_id",
  "buyer_address", "buyer_account_no", "invoice_number", "invoice_serial",
  "invoice_date", "payment_method", "currency", "exchange_rate",
  "tax_authority_code", "lookup_code", "lookup_url", "subtotal",
  "tax_rate", "tax_amount", "total_amount", "amount_in_words",
];

// ============================================================
// GEMINI PROMPTS (unchanged from original)
// ============================================================
const VALIDATION_PROMPT = `You are an image classifier. Determine if the given image is an invoice or receipt document.

An invoice/receipt typically contains:
- Seller/vendor information (name, address, tax ID)
- Buyer/customer information
- List of items/services with prices
- Total amount, tax information
- Invoice number, date

Respond with ONLY valid JSON:
{
  "is_invoice": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}

If it's clearly NOT an invoice (e.g., a photo, screenshot of app, random document, ID card, etc.), set is_invoice to false.`;

const SYSTEM_PROMPT = `You are a highly reliable invoice extraction AI. Your highest priority is accuracy.

RULES FOR NUMERIC FIELDS:
1. Vietnamese Number Format: In Vietnamese invoices, dots (.) are THOUSAND separators and commas (,) are DECIMAL separators.
   - "1.00" means ONE (1), NOT one hundred. The ".00" is decimal places.
   - "49.000" means FORTY-NINE THOUSAND (49000), NOT forty-nine.
   - "1.200.000" means 1,200,000 (one million two hundred thousand).
   - "49000" or "49,000" means forty-nine thousand.
2. Output Format: Always output numeric values as PLAIN NUMBERS without any separators.
   - "1.00" → "1"
   - "49.000" → "49000"  
   - "1.200.000" → "1200000"
   - "15.000" → "15000"
   - "2,5" → "2.5" (use dot as decimal in output)
3. Do NOT blindly copy numbers. UNDERSTAND the Vietnamese formatting context and convert to plain numbers.

RULES FOR TEXT FIELDS:
1. Light spelling normalization for common business terms only.
2. Preserve capitalization where possible.
3. Do Not Touch Codes: NEVER modify invoice numbers, item codes, serial numbers, tax IDs, IBAN/account numbers.

OUTPUT:
Return ONLY valid JSON that matches the schema below. If a field is not found, output an empty string.

{
  "core": {
    "vendor_name": "",
    "vendor_tax_id": "",
    "vendor_address": "",
    "vendor_phone": "",
    "vendor_fax": "",
    "vendor_account_no": "",
    "buyer_name": "",
    "buyer_tax_id": "",
    "buyer_address": "",
    "buyer_account_no": "",
    "invoice_id": "",
    "invoice_serial": "",
    "invoice_date": "",
    "payment_method": "",
    "currency": "",
    "exchange_rate": "",
    "tax_authority_code": "",
    "lookup_code": "",
    "lookup_url": "",
    "subtotal": "",
    "tax_rate": "",
    "tax_amount": "",
    "total_amount": "",
    "amount_in_words": "",
    "line_items": [
      {
        "item_code": "",
        "description": "",
        "unit": "",
        "quantity": "",
        "unit_price": "",
        "amount": ""
      }
    ]
  },
  "extend": {}
}

DATE FORMATTING: Convert detected dates to dd/mm/yyyy.
ADDRESS NORMALIZATION: Remove all line breaks and replace with single spaces.`;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(supabaseUrl ?? "", supabaseServiceRoleKey ?? "", {
  auth: { persistSession: false },
});

// ============================================================
// HELPER: Apply field mapping from custom API response
// ============================================================
function applyFieldMapping(data: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  if (Object.keys(mapping).length === 0) return data;

  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const systemField = mapping[key] ?? key;
    mapped[systemField] = value;
  }
  return mapped;
}

// ============================================================
// HELPER: Normalize custom API response to system format
// ============================================================
function normalizeCustomResponse(apiData: any, apiMapping?: Record<string, string>): any {
  const effectiveMapping = apiMapping ?? CUSTOM_FIELD_MAPPING;
  
  // Apply field mapping if provided by API or configured
  let data = apiData;
  if (effectiveMapping && Object.keys(effectiveMapping).length > 0) {
    data = applyFieldMapping(apiData, effectiveMapping);
  }

  // Build core object in system format
  const core: Record<string, unknown> = {};
  for (const field of SYSTEM_FIELDS) {
    core[field] = data[field] ?? "";
  }

  // Handle invoice_id → invoice_number mapping
  if (!core["invoice_number"] && data["invoice_id"]) {
    core["invoice_number"] = data["invoice_id"];
  }

  // Handle line_items
  if (Array.isArray(data["line_items"])) {
    core["line_items"] = data["line_items"].map((item: any) => {
      const mappedItem = effectiveMapping && Object.keys(effectiveMapping).length > 0
        ? applyFieldMapping(item, effectiveMapping)
        : item;
      return {
        item_code: mappedItem["item_code"] ?? "",
        description: mappedItem["description"] ?? "",
        unit: mappedItem["unit"] ?? "",
        quantity: mappedItem["quantity"] ?? "",
        unit_price: mappedItem["unit_price"] ?? "",
        amount: mappedItem["amount"] ?? "",
      };
    });
  } else {
    core["line_items"] = [];
  }

  // Collect unmapped fields into extend
  const extend: Record<string, unknown> = {};
  const knownFields = new Set([...SYSTEM_FIELDS, "line_items", "invoice_id"]);
  for (const [key, value] of Object.entries(data)) {
    if (!knownFields.has(key) && value !== "" && value !== null && value !== undefined) {
      extend[key] = value;
    }
  }

  return { core, extend };
}

// ============================================================
// CUSTOM AI EXTRACTION
// ============================================================
async function extractWithCustomAI(imageBase64: string, mimeType: string): Promise<{
  data: any;
  confidenceScore: number;
  mathWarnings: string[];
}> {
  if (!CUSTOM_API_URL) {
    throw new Error("CUSTOM_AI_API_URL is not configured. Set it in Supabase secrets.");
  }

  console.log("Custom AI: Sending request to", CUSTOM_API_URL);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (CUSTOM_API_KEY) {
    headers["Authorization"] = `Bearer ${CUSTOM_API_KEY}`;
  }

  const response = await fetch(CUSTOM_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      image_base64: imageBase64,
      mime_type: mimeType,
      options: { language: "vi" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Custom AI error:", response.status, errorText);
    throw new Error(`Custom AI API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Custom AI extraction failed");
  }

  // Normalize response: handle field_mapping from API or use configured mapping
  const apiMapping = result.field_mapping ?? undefined;
  const normalized = normalizeCustomResponse(result.data, apiMapping);

  // Use confidence from API if provided, otherwise calculate
  const apiConfidence = typeof result.confidence === "number" ? result.confidence : null;
  const { confidenceScore, mathWarnings } = calculateConfidence(normalized.core, apiConfidence);

  return {
    data: normalized,
    confidenceScore,
    mathWarnings,
  };
}

// ============================================================
// GEMINI EXTRACTION (original logic)
// ============================================================
async function extractWithGemini(imageBase64: string, mimeType: string): Promise<{
  data: any;
  confidenceScore: number;
  mathWarnings: string[];
}> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const isPdf = mimeType === "application/pdf";
  const buildUserContent = (promptText: string) => isPdf
    ? [
        { type: "file", file: { filename: "invoice.pdf", file_data: `data:application/pdf;base64,${imageBase64}` } },
        { type: "text", text: promptText },
      ]
    : [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: "text", text: promptText },
      ];

  // Step 1: Validate
  console.log("Gemini Step 1: Validating, isPdf:", isPdf, "mimeType:", mimeType);
  const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: VALIDATION_PROMPT },
        { role: "user", content: buildUserContent("Is this an invoice or receipt? Respond with JSON only.") },
      ],
    }),
  });

  if (validationResponse.ok) {
    const validationData = await validationResponse.json();
    const validationContent = validationData?.choices?.[0]?.message?.content as string | undefined;
    if (validationContent) {
      try {
        const jsonMatch = validationContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const validation = JSON.parse(jsonMatch[0]);
          console.log("Validation result:", validation);
          if (validation.is_invoice === false) {
            throw new Error(`NOT_INVOICE:${validation.reason || "Không xác định được nội dung hóa đơn"}`);
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("NOT_INVOICE:")) throw e;
        console.error("Failed to parse validation response:", e);
      }
    }
  }

  // Step 2: Extract
  const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT + "\n\nExtract all invoice data and return JSON only." },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }]
    })
  }
);

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error("AI gateway error");
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!content) throw new Error("No content in AI response");

  let extractedData = parseJsonFromAI(content);

  // Retry once if parsing failed
  if (!extractedData) {
    console.log("First parse failed, retrying extraction...");
    const retryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserContent("Extract all invoice data. Return ONLY a valid JSON object, no markdown, no extra text.") },
        ],
      }),
    });

    if (retryResponse.ok) {
      const retryData = await retryResponse.json();
      const retryContent = retryData?.choices?.[0]?.message?.content as string | undefined;
      if (retryContent) extractedData = parseJsonFromAI(retryContent);
    }
  }

  if (!extractedData) {
    console.error("Failed to parse AI JSON after retry. Raw:", content.substring(0, 500));
    throw new Error("Failed to parse AI response");
  }

  const coreData = (extractedData as any)?.core || {};
  const { confidenceScore, mathWarnings } = calculateConfidence(coreData, null);

  return { data: extractedData, confidenceScore, mathWarnings };
}

// ============================================================
// SHARED: Parse JSON from AI response
// ============================================================
function parseJsonFromAI(text: string): unknown {
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  try { return JSON.parse(cleaned.trim()); } catch (_) { /* fall through */ }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) { /* fall through */ }
    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(fixed); } catch (_) { /* fall through */ }
  }
  return null;
}

// ============================================================
// SHARED: Calculate confidence score with math validation
// ============================================================
function calculateConfidence(coreData: any, apiConfidence: number | null): {
  confidenceScore: number;
  mathWarnings: string[];
} {
  const weightedFields: [string, number][] = [
    ['total_amount', 3], ['invoice_id', 3], ['invoice_number', 3], ['vendor_name', 3], ['invoice_date', 2.5],
    ['vendor_tax_id', 2], ['buyer_name', 2], ['subtotal', 2], ['tax_amount', 1.5],
    ['buyer_tax_id', 1], ['tax_rate', 1], ['currency', 1], ['payment_method', 0.5],
  ];
  const totalWeight = weightedFields.reduce((sum, [, w]) => sum + w, 0);
  const earnedWeight = weightedFields.reduce((sum, [field, w]) => {
    const val = coreData[field];
    return sum + ((val !== undefined && val !== null && val !== '') ? w : 0);
  }, 0);
  const hasLineItems = Array.isArray(coreData.line_items) && coreData.line_items.length > 0;
  const lineItemBonus = hasLineItems ? 0.05 : 0;

  const parseNum = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    let str = String(v).trim().replace(/[¤$€£¥₫\s]/g, '');
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  };

  let mathPenalty = 0;
  const mathWarnings: string[] = [];

  const subtotalNum = parseNum(coreData.subtotal);
  const taxAmountNum = parseNum(coreData.tax_amount);
  const totalAmountNum = parseNum(coreData.total_amount);

  if (subtotalNum !== null && taxAmountNum !== null && totalAmountNum !== null && totalAmountNum > 0) {
    const expectedTotal = subtotalNum + taxAmountNum;
    const diff = Math.abs(expectedTotal - totalAmountNum);
    if (diff > totalAmountNum * 0.02) {
      mathPenalty += 0.15;
      mathWarnings.push(`Subtotal(${subtotalNum}) + Tax(${taxAmountNum}) = ${expectedTotal} ≠ Total(${totalAmountNum})`);
    }
  }

  if (hasLineItems && subtotalNum !== null && subtotalNum > 0) {
    const lineItemsSum = (coreData.line_items as any[]).reduce((sum: number, item: any) => sum + (parseNum(item.amount) ?? 0), 0);
    if (lineItemsSum > 0) {
      const diff = Math.abs(lineItemsSum - subtotalNum);
      if (diff > subtotalNum * 0.02) {
        mathPenalty += 0.10;
        mathWarnings.push(`LineItems sum(${lineItemsSum}) ≠ Subtotal(${subtotalNum})`);
      }
    }
  }

  if (hasLineItems) {
    let itemMismatchCount = 0;
    for (const item of coreData.line_items as any[]) {
      const qty = parseNum(item.quantity);
      const price = parseNum(item.unit_price);
      const amt = parseNum(item.amount);
      if (qty !== null && price !== null && amt !== null && amt > 0) {
        if (Math.abs(qty * price - amt) > amt * 0.02) itemMismatchCount++;
      }
    }
    if (itemMismatchCount > 0) {
      mathPenalty += Math.min(0.10, itemMismatchCount * 0.03);
      mathWarnings.push(`${itemMismatchCount} line item(s) have qty*price ≠ amount`);
    }
  }

  if (mathWarnings.length > 0) console.log("Math validation warnings:", mathWarnings);

  // If API provides its own confidence, blend it with our math validation
  let baseScore: number;
  if (apiConfidence !== null) {
    baseScore = apiConfidence;
  } else {
    baseScore = (earnedWeight / totalWeight) + lineItemBonus;
  }

  const confidenceScore = Math.min(1, Math.max(0, Math.round((baseScore - mathPenalty) * 100) / 100));
  return { confidenceScore, mathWarnings };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBase64 = (body.imageBase64 ?? body.fileBase64 ?? "") as string;
    const mimeType = (body.mimeType ?? "image/png") as string;
    // Allow per-request mode override: body.extraction_mode = "gemini" | "custom"
    const mode = (body.extraction_mode ?? EXTRACTION_MODE) as "gemini" | "custom";

    if (!imageBase64) {
      return new Response(JSON.stringify({ success: false, error: "Missing imageBase64" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Extraction mode: ${mode}`);

    let result: { data: any; confidenceScore: number; mathWarnings: string[] };

    if (mode === "custom") {
      result = await extractWithCustomAI(imageBase64, mimeType);
    } else {
      result = await extractWithGemini(imageBase64, mimeType);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result.data,
      confidence_score: result.confidenceScore,
      math_warnings: result.mathWarnings.length > 0 ? result.mathWarnings : undefined,
      extraction_mode: mode,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-invoice function:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("NOT_INVOICE:")) {
      return new Response(JSON.stringify({
        success: false,
        error: `Hình ảnh không phải là hóa đơn: ${message.slice(12)}`,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ success: false, error: "Payment required. Please add credits to continue." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
