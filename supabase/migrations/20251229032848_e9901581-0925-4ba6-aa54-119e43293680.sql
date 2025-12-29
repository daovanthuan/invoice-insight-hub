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
ON public.invoices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices" 
ON public.invoices 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices" 
ON public.invoices 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for line_items
CREATE POLICY "Users can view line items of their invoices" 
ON public.line_items 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.invoices 
        WHERE invoices.id = line_items.invoice_id 
        AND invoices.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create line items for their invoices" 
ON public.line_items 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.invoices 
        WHERE invoices.id = line_items.invoice_id 
        AND invoices.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete line items of their invoices" 
ON public.line_items 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.invoices 
        WHERE invoices.id = line_items.invoice_id 
        AND invoices.user_id = auth.uid()
    )
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
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

-- Storage policies
CREATE POLICY "Users can upload their own invoice files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own invoice files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own invoice files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);