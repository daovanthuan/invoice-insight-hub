
-- Fix Security Definer Views -> set security_invoker = true
ALTER VIEW public.dim_time SET (security_invoker = true);
ALTER VIEW public.dim_vendor SET (security_invoker = true);
ALTER VIEW public.dim_buyer SET (security_invoker = true);
ALTER VIEW public.fact_invoices SET (security_invoker = true);
ALTER VIEW public.analytics_vendor_monthly SET (security_invoker = true);
ALTER VIEW public.analytics_vendor_comparison SET (security_invoker = true);
