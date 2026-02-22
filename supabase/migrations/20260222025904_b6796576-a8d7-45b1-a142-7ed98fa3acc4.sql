
-- =============================================
-- STAR SCHEMA VIEWS cho Analytics
-- =============================================

-- 1. DIM_TIME view - Chiều thời gian
CREATE OR REPLACE VIEW public.dim_time AS
SELECT DISTINCT
  invoice_date AS date_value,
  EXTRACT(DOW FROM invoice_date::date) AS day_of_week,
  EXTRACT(DAY FROM invoice_date::date) AS day_of_month,
  EXTRACT(MONTH FROM invoice_date::date) AS month,
  EXTRACT(QUARTER FROM invoice_date::date) AS quarter,
  EXTRACT(YEAR FROM invoice_date::date) AS year,
  TO_CHAR(invoice_date::date, 'Mon') AS month_name,
  TO_CHAR(invoice_date::date, 'Q') AS quarter_name
FROM public.invoices
WHERE invoice_date IS NOT NULL;

-- 2. DIM_VENDOR view - Chiều nhà cung cấp
CREATE OR REPLACE VIEW public.dim_vendor AS
SELECT DISTINCT
  vendor_name,
  vendor_tax_id,
  vendor_address,
  vendor_phone
FROM public.invoices
WHERE vendor_name IS NOT NULL;

-- 3. DIM_BUYER view - Chiều người mua
CREATE OR REPLACE VIEW public.dim_buyer AS
SELECT DISTINCT
  buyer_name,
  buyer_tax_id,
  buyer_address
FROM public.invoices
WHERE buyer_name IS NOT NULL;

-- 4. FACT_INVOICES view - Bảng fact chính
CREATE OR REPLACE VIEW public.fact_invoices AS
SELECT
  i.id,
  i.invoice_date,
  EXTRACT(MONTH FROM i.invoice_date::date) AS month,
  EXTRACT(QUARTER FROM i.invoice_date::date) AS quarter,
  EXTRACT(YEAR FROM i.invoice_date::date) AS year,
  i.vendor_name,
  i.vendor_tax_id,
  i.buyer_name,
  i.buyer_tax_id,
  i.currency,
  i.exchange_rate,
  i.status,
  i.subtotal,
  i.tax_rate,
  i.tax_amount,
  i.total_amount,
  i.confidence_score,
  i.payment_method,
  i.owner_id,
  i.created_at,
  -- Aggregation helpers
  CASE WHEN i.status = 'processed' THEN 1 ELSE 0 END AS is_processed,
  CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END AS is_pending,
  CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END AS is_rejected,
  CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END AS is_approved,
  -- Item count
  (SELECT COUNT(*) FROM public.invoice_items ii WHERE ii.invoice_id = i.id) AS item_count
FROM public.invoices i
WHERE i.invoice_date IS NOT NULL;

-- 5. Analytics summary view - Tổng hợp theo vendor + tháng
CREATE OR REPLACE VIEW public.analytics_vendor_monthly AS
SELECT
  vendor_name,
  EXTRACT(YEAR FROM invoice_date::date) AS year,
  EXTRACT(MONTH FROM invoice_date::date) AS month,
  TO_CHAR(invoice_date::date, 'Mon YYYY') AS period,
  COUNT(*) AS invoice_count,
  SUM(total_amount) AS total_revenue,
  AVG(total_amount) AS avg_amount,
  SUM(tax_amount) AS total_tax,
  COUNT(*) FILTER (WHERE status = 'processed') AS processed_count,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'processed'))::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) AS success_rate
FROM public.invoices
WHERE vendor_name IS NOT NULL AND invoice_date IS NOT NULL
GROUP BY vendor_name, EXTRACT(YEAR FROM invoice_date::date), EXTRACT(MONTH FROM invoice_date::date), TO_CHAR(invoice_date::date, 'Mon YYYY')
ORDER BY year DESC, month DESC;

-- 6. Comparison view - So sánh định tính & định lượng giữa vendors
CREATE OR REPLACE VIEW public.analytics_vendor_comparison AS
SELECT
  vendor_name,
  COUNT(*) AS total_invoices,
  SUM(total_amount) AS total_revenue,
  AVG(total_amount) AS avg_invoice_value,
  MIN(total_amount) AS min_invoice,
  MAX(total_amount) AS max_invoice,
  AVG(confidence_score) AS avg_confidence,
  COUNT(DISTINCT currency) AS currency_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'processed'))::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) AS success_rate,
  -- Định tính: xếp hạng vendor
  CASE 
    WHEN COUNT(*) >= 10 AND ROUND((COUNT(*) FILTER (WHERE status = 'processed'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) >= 90 THEN 'Xuất sắc'
    WHEN COUNT(*) >= 5 AND ROUND((COUNT(*) FILTER (WHERE status = 'processed'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) >= 70 THEN 'Tốt'
    WHEN COUNT(*) >= 3 THEN 'Trung bình'
    ELSE 'Mới'
  END AS vendor_rating,
  -- Phân loại quy mô
  CASE
    WHEN SUM(total_amount) >= 1000000000 THEN 'Lớn'
    WHEN SUM(total_amount) >= 100000000 THEN 'Vừa'
    ELSE 'Nhỏ'
  END AS vendor_scale
FROM public.invoices
WHERE vendor_name IS NOT NULL
GROUP BY vendor_name
ORDER BY total_revenue DESC;

-- Add column to invoices for storing original file path
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS original_file_path text;

-- RLS: Views inherit from invoices table RLS, no extra policies needed
