-- ============================================================================
-- Migration: 025_subscriptions_tips_payouts_and_entitlements.sql
-- Prompt 18: Subscriptions, Tips, Payouts, Entitlements and Store Rules
-- IMMUTABLE RULE: NO GPS, NO LATITUDE/LONGITUDE, NO IP-BASED LOCATION.
-- PCI-DSS RULE: NEVER STORE RAW CARD DETAILS OR TRUST CLIENT PRICES.
-- COMPLIANCE RULE: UNRESOLVED COMPLIANCE / TAX / KYC ISSUES REMAIN BLOCKED.
-- ============================================================================

-- 1. Enhance creator_financial_accounts with Compliance & KYC state
ALTER TABLE creator_financial_accounts
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS is_compliance_blocked BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS compliance_block_reason TEXT DEFAULT 'Identity and tax verification required before enabling payouts.',
  ADD COLUMN IF NOT EXISTS tax_form_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tax_form_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_account_last4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS bank_routing_number VARCHAR(20);

-- 2. Enhance reels with subscriber-only gate flag
ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS is_subscriber_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_reels_subscriber_only 
  ON reels (creator_id, is_subscriber_only) 
  WHERE is_subscriber_only = TRUE;

-- 3. Server-Verified Entitlements Ledger
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entitlement_type VARCHAR(50) NOT NULL, -- 'CREATOR_SUBSCRIPTION', 'COMMUNITY_PASS', 'EXCLUSIVE_CONTENT', 'VIP_BADGE'
  plan_id UUID REFERENCES creator_subscription_plans(id) ON DELETE SET NULL,
  reel_id UUID REFERENCES reels(id) ON DELETE SET NULL,
  gateway VARCHAR(30) NOT NULL, -- 'stripe', 'razorpay', 'apple_iap', 'google_play'
  transaction_id VARCHAR(128) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'REVOKED', 'DISPUTED'
  expires_at TIMESTAMPTZ, -- NULL for lifetime passes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_creator_entitlement UNIQUE(user_id, creator_id, entitlement_type)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_active 
  ON entitlements (user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_entitlements_creator 
  ON entitlements (creator_id, status);

CREATE INDEX IF NOT EXISTS idx_entitlements_transaction 
  ON entitlements (gateway, transaction_id);

-- 4. Payment Webhook Events (Cryptographic Signature Verification & Idempotency)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(30) NOT NULL, -- 'stripe', 'razorpay', 'apple_iap', 'google_play'
  event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PROCESSED', -- 'PROCESSED', 'FAILED', 'IGNORED'
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_gateway_event UNIQUE(gateway, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway_event 
  ON payment_webhook_events (gateway, event_id);

-- 5. Financial Audit Trail (Tamper-evident record of all credits, debits, holds, fees)
CREATE TABLE IF NOT EXISTS financial_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'CREDIT_TIP', 'CREDIT_SUBSCRIPTION', 'PAYOUT_REQUEST', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED', 'REFUND_DEBIT', 'DISPUTE_HOLD', 'FEE_DEDUCTION'
  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT NOT NULL DEFAULT 0,
  balance_before_cents BIGINT NOT NULL,
  balance_after_cents BIGINT NOT NULL,
  reference_id VARCHAR(128),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user 
  ON financial_audit_trail (user_id, created_at DESC);

-- 6. Creator Payout Invoices & Disbursal Records
CREATE TABLE IF NOT EXISTS creator_payout_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_record_id UUID REFERENCES creator_payout_records(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gross_amount_cents BIGINT NOT NULL,
  platform_fee_cents BIGINT NOT NULL,
  tax_withheld_cents BIGINT NOT NULL,
  net_payout_cents BIGINT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  tax_id_masked VARCHAR(50),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_invoices_creator 
  ON creator_payout_invoices (creator_id, issued_at DESC);
