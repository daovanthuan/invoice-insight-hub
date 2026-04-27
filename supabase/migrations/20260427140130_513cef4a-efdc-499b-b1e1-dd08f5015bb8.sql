-- Bucket riêng cho broker invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('broker-invoices', 'broker-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: user chỉ truy cập folder của mình
CREATE POLICY "Users can view own broker files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'broker-invoices'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own broker files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'broker-invoices'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own broker files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'broker-invoices'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own broker files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'broker-invoices'
  AND auth.uid()::text = (storage.foldername(name))[1]
);