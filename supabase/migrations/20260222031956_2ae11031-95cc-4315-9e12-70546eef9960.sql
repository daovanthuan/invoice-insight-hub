-- Add source_zip_name column to track which ZIP file an invoice came from
ALTER TABLE public.invoices ADD COLUMN source_zip_name text DEFAULT NULL;
