-- Add cancelled status to invoice_status enum
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'cancelled';