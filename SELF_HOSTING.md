# Hướng dẫn Self-Hosting - Hệ thống Quản lý Hóa đơn

## 1. Yêu cầu hệ thống

- Node.js >= 18
- Supabase CLI hoặc Docker
- Deno (cho Edge Functions)
- Git

---

## 2. Cài đặt Supabase Local

### Cách 1: Sử dụng Supabase CLI

```bash
# Cài đặt Supabase CLI
npm install -g supabase

# Khởi tạo project
supabase init

# Khởi động local Supabase
supabase start
```

### Cách 2: Sử dụng Docker Compose

```bash
# Clone Supabase docker
git clone https://github.com/supabase/supabase.git
cd supabase/docker

# Copy env file
cp .env.example .env

# Khởi động
docker-compose up -d
```

---

## 3. Database Schema (Chạy theo thứ tự)

### Migration 1: Invoices & Line Items

```sql
-- Create invoices table
CREATE TABLE public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_name TEXT,
    vendor_tax_id TEXT,
    vendor_address TEXT,
    vendor_phone TEXT,
    vendor_fax TEXT,
    vendor_account_no TEXT,
    buyer_name TEXT,
    buyer_tax_id TEXT,
    buyer_address TEXT,
    buyer_account_no TEXT,
    invoice_id TEXT,
    invoice_serial TEXT,
    invoice_date TEXT,
    payment_method TEXT,
    currency TEXT,
    exchange_rate TEXT,
    tax_authority_code TEXT,
    lookup_code TEXT,
    lookup_url TEXT,
    subtotal TEXT,
    tax_rate TEXT,
    tax_amount TEXT,
    total_amount TEXT,
    amount_in_words TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    file_name TEXT,
    file_path TEXT,
    raw_json JSONB,
    extend JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create line_items table
CREATE TABLE public.line_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    item_code TEXT,
    description TEXT,
    unit TEXT,
    quantity TEXT,
    unit_price TEXT,
    amount TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view their own invoices" 
ON public.invoices FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices" 
ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices" 
ON public.invoices FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices" 
ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for line_items
CREATE POLICY "Users can view line items of their invoices" 
ON public.line_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = line_items.invoice_id AND invoices.user_id = auth.uid())
);

CREATE POLICY "Users can create line items for their invoices" 
ON public.line_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = line_items.invoice_id AND invoices.user_id = auth.uid())
);

CREATE POLICY "Users can delete line items of their invoices" 
ON public.line_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = line_items.invoice_id AND invoices.user_id = auth.uid())
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for invoices
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

-- Storage policies
CREATE POLICY "Users can upload their own invoice files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own invoice files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own invoice files" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Migration 2: User Settings

```sql
-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  date_format TEXT NOT NULL DEFAULT 'dmy',
  default_currency TEXT NOT NULL DEFAULT 'VND',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  error_alerts BOOLEAN NOT NULL DEFAULT true,
  weekly_reports BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own settings" 
ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### Migration 3: User Roles

```sql
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
```

---

## 4. Edge Function: Extract Invoice

Tạo file `supabase/functions/extract-invoice/index.ts`:

```typescript
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a highly reliable invoice extraction AI. Your highest priority is accuracy.

RULES FOR NUMERIC FIELDS:
1. Verbatim Extraction: Extract numbers EXACTLY as seen in the document.
2. No Normalization: Never convert number formats.

RULES FOR TEXT FIELDS:
1. Light spelling normalization for common business terms only.
2. Preserve capitalization where possible.
3. Do Not Touch Codes: NEVER modify invoice numbers, item codes, serial numbers, tax IDs.

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

const supabaseAdmin = createClient(supabaseUrl ?? "", supabaseServiceRoleKey ?? "", {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // ============================================================
    // THAY THẾ PHẦN NÀY BẰNG AI PROVIDER CỦA BẠN
    // ============================================================
    
    // Option 1: OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    const isPdf = mimeType === "application/pdf";
    const userContent = isPdf
      ? [
          { type: "text", text: "Extract all invoice data from this PDF and return JSON only." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ]
      : [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: "text", text: "Extract all invoice data and return JSON only." },
        ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    // Option 2: Google Gemini (uncomment nếu dùng)
    // const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    // const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     contents: [{
    //       parts: [
    //         { text: SYSTEM_PROMPT + "\n\nExtract all invoice data and return JSON only." },
    //         { inline_data: { mime_type: mimeType, data: imageBase64 } }
    //       ]
    //     }]
    //   }),
    // });

    // ============================================================

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
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
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 5. Environment Variables

Tạo file `.env.local` cho frontend:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Cho Edge Functions, set secrets:

```bash
# Với Supabase CLI
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set SUPABASE_URL=http://localhost:54321
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 6. Chạy ứng dụng

```bash
# Terminal 1: Chạy Supabase local
supabase start

# Terminal 2: Deploy Edge Functions
supabase functions serve extract-invoice --no-verify-jwt

# Terminal 3: Chạy Frontend
npm install
npm run dev
```

---

## 7. API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/functions/v1/extract-invoice` | POST | Trích xuất dữ liệu hóa đơn từ ảnh/PDF |

### Request Body:
```json
{
  "imageBase64": "base64-encoded-image",
  "mimeType": "image/png"
}
```

### Response:
```json
{
  "success": true,
  "data": {
    "core": { ... },
    "extend": { ... }
  }
}
```

---

## 8. Tài liệu tham khảo

- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno Deploy](https://deno.com/deploy)

---

**Lưu ý:** Bạn cần thay thế `LOVABLE_API_KEY` bằng API key của AI provider mà bạn sử dụng (OpenAI, Google Gemini, etc.)
