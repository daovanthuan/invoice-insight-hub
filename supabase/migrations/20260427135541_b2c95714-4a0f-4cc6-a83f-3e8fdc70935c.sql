-- ENUMS
CREATE TYPE public.broker_transaction_type AS ENUM (
    'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FX', 'TRANSFER', 'OTHER'
);

CREATE TYPE public.broker_invoice_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
);

-- BẢNG broker_invoices
CREATE TABLE public.broker_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status public.broker_invoice_status NOT NULL DEFAULT 'pending',
    confidence_score DOUBLE PRECISION,

    -- Client
    client_name TEXT,
    account_no TEXT,
    description TEXT,

    -- Securities
    securities_id TEXT,
    security_name TEXT,
    units NUMERIC(20, 6),

    -- Transaction
    transaction_type public.broker_transaction_type,
    trade_date DATE,
    settlement_date DATE,
    ex_date DATE,
    payment_date DATE,

    -- Amounts
    currency TEXT DEFAULT 'USD',
    gross_amount NUMERIC(20, 4),
    net_amount NUMERIC(20, 4),

    -- Dividend / Tax
    dividend_rate NUMERIC(10, 6),
    wht_rate NUMERIC(8, 4),
    wht_amount NUMERIC(20, 4),

    -- FX
    currency_buy TEXT,
    currency_sell TEXT,
    amount_buy NUMERIC(20, 4),
    amount_sell NUMERIC(20, 4),
    rate NUMERIC(20, 8),
    account_no_buy TEXT,
    account_no_sell TEXT,

    -- File metadata
    original_file_path TEXT,
    source_zip_name TEXT,
    raw_json JSONB,
    extend JSONB DEFAULT '{}'::jsonb
);

-- INDEXES
CREATE INDEX idx_broker_invoices_owner ON public.broker_invoices(owner_id);
CREATE INDEX idx_broker_invoices_trade_date ON public.broker_invoices(trade_date DESC);
CREATE INDEX idx_broker_invoices_securities_id ON public.broker_invoices(securities_id);
CREATE INDEX idx_broker_invoices_status ON public.broker_invoices(status);
CREATE INDEX idx_broker_invoices_transaction_type ON public.broker_invoices(transaction_type);
CREATE INDEX idx_broker_invoices_client ON public.broker_invoices(client_name);

-- RLS
ALTER TABLE public.broker_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own broker invoices"
    ON public.broker_invoices FOR SELECT
    USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can create broker invoices"
    ON public.broker_invoices FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own broker invoices"
    ON public.broker_invoices FOR UPDATE
    USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can delete own broker invoices"
    ON public.broker_invoices FOR DELETE
    USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- TRIGGER updated_at
CREATE TRIGGER update_broker_invoices_updated_at
    BEFORE UPDATE ON public.broker_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();