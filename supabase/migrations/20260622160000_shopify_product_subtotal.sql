-- Shopify order subtotal (line items after discounts, before tax/shipping) for Kul split reconciliation.
ALTER TABLE public.shopify_daily_performance
  ADD COLUMN IF NOT EXISTS product_subtotal numeric(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.shopify_daily_performance.product_subtotal IS
  'Sum of order subtotal_price for the day; machine_gross + accessory_gross should approximate this after backfill.';
