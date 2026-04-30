-- Đổi enum broker_transaction_type sang 3 loại: CREDIT_ADVICE, DIVIDEND, FX_FT
-- Map dữ liệu cũ:
--   BUY/SELL/INTEREST/TRANSFER/OTHER -> CREDIT_ADVICE
--   FX -> FX_FT
--   DIVIDEND -> DIVIDEND

-- 1. Tạo enum mới
CREATE TYPE public.broker_transaction_type_new AS ENUM ('CREDIT_ADVICE', 'DIVIDEND', 'FX_FT');

-- 2. Đổi cột sang text tạm để map
ALTER TABLE public.broker_invoices
  ALTER COLUMN transaction_type TYPE text USING transaction_type::text;

-- 3. Map dữ liệu cũ
UPDATE public.broker_invoices
SET transaction_type = CASE
  WHEN transaction_type = 'DIVIDEND' THEN 'DIVIDEND'
  WHEN transaction_type = 'FX' THEN 'FX_FT'
  WHEN transaction_type IN ('BUY','SELL','INTEREST','TRANSFER','OTHER') THEN 'CREDIT_ADVICE'
  ELSE NULL
END;

-- 4. Đổi sang enum mới
ALTER TABLE public.broker_invoices
  ALTER COLUMN transaction_type TYPE public.broker_transaction_type_new
  USING transaction_type::public.broker_transaction_type_new;

-- 5. Drop enum cũ và đổi tên
DROP TYPE public.broker_transaction_type;
ALTER TYPE public.broker_transaction_type_new RENAME TO broker_transaction_type;