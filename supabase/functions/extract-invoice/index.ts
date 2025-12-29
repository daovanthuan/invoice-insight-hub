import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a highly reliable invoice extraction AI. Your highest priority is accuracy.

RULES FOR NUMERIC FIELDS:
1. Verbatim Extraction: Extract numbers EXACTLY as seen in the document (e.g., "1,200.00" vs "1.200,00"), preserve separators.
2. No Normalization: Never convert number formats.

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Manual auth check (function is public at gateway, but we enforce auth here)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error("Invalid JWT:", userError?.message);
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBase64 = (body.imageBase64 ?? body.fileBase64 ?? "") as string;
    const mimeType = (body.mimeType ?? "image/png") as string;

    if (!imageBase64) {
      return new Response(JSON.stringify({ success: false, error: "Missing imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mimeType === "application/pdf") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "PDF must be converted to an image before extraction.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all invoice data and return JSON only.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ success: false, error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let extractedData: unknown;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse AI JSON", e);
      return new Response(JSON.stringify({ success: false, error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-invoice function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
