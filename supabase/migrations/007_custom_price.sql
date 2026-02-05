-- Add custom_monthly_price column to organizations
-- Used when trainers are manually added with custom pricing
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_monthly_price integer DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN organizations.custom_monthly_price IS 'Custom monthly price in dollars for manually added trainers. If NULL, uses standard tier pricing.';
