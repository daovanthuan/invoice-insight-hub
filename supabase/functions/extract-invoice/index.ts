import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a highly reliable invoice extraction AI. Your highest priority is accuracy.

RULES FOR NUMERIC FIELDS:
1. **Verbatim Extraction**: Extract numbers EXACTLY as seen in the document (e.g., if "1,200.00" or "1.200,00", output exactly the same string).
2. **Precision**: Preserve all dots (.), commas (,), spaces, and separators exactly as printed.
3. **No Normalization**: Never convert formats (e.g., do not convert "1.200,00" to "1200.00").

RULES FOR TEXT FIELDS:
1. **Spelling Normalization (Light Only)**: Fix obvious OCR spelling errors in common business terms.
2. **Preserve Original Capitalization** where possible.
3. **Do Not Touch Codes**: NEVER modify Invoice Numbers, Item Codes, Serial Numbers, Tax IDs, IBAN, or Account Numbers.

EXTRACTION FORMAT:
Extract all relevant information into the following JSON structure. If a field is not found, output an empty string "".

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

DATE FORMATTING: Convert all detected dates to "dd/mm/yyyy" format.
ADDRESS NORMALIZATION: Remove all line breaks and replace with single spaces.
Return ONLY valid JSON, no additional text.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType, isPdf } = await req.json();
    
    // Support both old and new parameter names for backward compatibility
    const base64Data = fileBase64 || (await req.json()).imageBase64;
    
    if (!base64Data && !fileBase64) {
      throw new Error("No file data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const fileType = isPdf ? 'PDF' : 'Image';
    console.log(`Processing invoice extraction (${fileType}) with Gemini 2.5 Flash...`);

    // Build the content based on file type
    let userContent: any[];
    
    if (isPdf) {
      // For PDFs, use the inline_data format with application/pdf
      userContent = [
        {
          type: "file",
          file: {
            filename: "invoice.pdf",
            file_data: `data:application/pdf;base64,${base64Data || fileBase64}`
          }
        },
        {
          type: "text",
          text: "Extract all invoice data from this PDF document and return as JSON."
        }
      ];
    } else {
      // For images, use image_url format
      userContent = [
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType || 'image/png'};base64,${base64Data || fileBase64}`
          }
        },
        {
          type: "text",
          text: "Extract all invoice data from this image and return as JSON."
        }
      ];
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
          { 
            role: "system", 
            content: SYSTEM_PROMPT 
          },
          { 
            role: "user", 
            content: userContent
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("Raw AI response:", content);

    // Parse the JSON from the response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

    console.log("Extracted invoice data successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      data: extractedData 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in extract-invoice function:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
