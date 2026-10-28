-- ============================================================================
-- Migration: 012_monetization_subscriptions_communities_ads_and_funds.sql
-- Project: "Interest" - Monetization Architecture
-- IMMUTABLE RULE: NO GPS, NO LATITUDE/LONGITUDE, NO IP-BASED LOCATION,
-- NO GEO-TARGETING IN ADS. Ads and Fund pools are strictly interest-driven.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Creator Subscription Plans (Tiers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    price_cents INT NOT NULL CHECK (price_cents > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'month', -- 'month', 'year'
    perks TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_plans_creator ON creator_subscription_plans(creator_id, is_active);

-- ----------------------------------------------------------------------------
-- 2. User Subscriptions (Patronage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES creator_subscription_plans(id) ON DELETE CASCADE,
    gateway VARCHAR(20) NOT NULL, -- 'stripe', 'razorpay'
    gateway_subscription_id VARCHAR(100) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'expired', 'trialing'
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscriber_creator UNIQUE(subscriber_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subs_subscriber ON user_subscriptions(subscriber_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subs_creator ON user_subscriptions(creator_id, status);

-- ----------------------------------------------------------------------------
-- 3. Creator Tips / Micro-Support
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES reels(id) ON DELETE SET NULL,
    amount_cents INT NOT NULL CHECK (amount_cents > 0),
    platform_fee_cents INT NOT NULL DEFAULT 0,
    net_creator_cents INT NOT NULL CHECK (net_creator_cents >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    message VARCHAR(500),
    gateway VARCHAR(20) NOT NULL, -- 'stripe', 'razorpay'
    gateway_payment_id VARCHAR(100) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_creator ON creator_tips(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_sender ON creator_tips(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_reel ON creator_tips(reel_id);

-- ----------------------------------------------------------------------------
-- 4. Paid Interest Communities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paid_interest_communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    banner_url TEXT,
    pricing_type VARCHAR(20) NOT NULL DEFAULT 'recurring', -- 'recurring', 'one_time'
    price_cents INT NOT NULL CHECK (price_cents > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    billing_interval VARCHAR(20) DEFAULT 'month', -- 'month', 'year', NULL for one_time
    members_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paid_comm_interest ON paid_interest_communities(interest_id, is_active);
CREATE INDEX IF NOT EXISTS idx_paid_comm_creator ON paid_interest_communities(creator_id, is_active);

-- ----------------------------------------------------------------------------
-- 5. Paid Community Memberships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paid_community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES paid_interest_communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'canceled'
    gateway VARCHAR(20) NOT NULL,
    gateway_order_id VARCHAR(100),
    expires_at TIMESTAMPTZ, -- NULL for lifetime one-time entry
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_community_user_member UNIQUE(community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_members_user ON paid_community_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_members_community ON paid_community_memberships(community_id, status);

-- ----------------------------------------------------------------------------
-- 6. Creator Fund Pools (Allocated from Pure Interest Watch Time)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_fund_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_name VARCHAR(50) NOT NULL UNIQUE, -- e.g. '2026-10'
    total_pool_cents BIGINT NOT NULL CHECK (total_pool_cents > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open', -- 'open', 'calculating', 'distributed'
    total_qualified_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_pools_period ON creator_fund_pools(period_start, period_end);

-- ----------------------------------------------------------------------------
-- 7. Creator Fund Allocations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_fund_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_id UUID NOT NULL REFERENCES creator_fund_pools(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qualified_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    affinity_weighted_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    interest_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    earnings_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'allocated', -- 'allocated', 'credited', 'paid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pool_creator UNIQUE(pool_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_fund_alloc_creator ON creator_fund_allocations(creator_id, status);

-- ----------------------------------------------------------------------------
-- 8. Ad Campaigns (Zero-Location, Interest-Only Targeting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    target_interest_ids UUID[] NOT NULL, -- Target purely by taxonomy nodes
    call_to_action_url VARCHAR(500),
    call_to_action_text VARCHAR(50) NOT NULL DEFAULT 'Learn More',
    daily_budget_cents INT NOT NULL CHECK (daily_budget_cents > 0),
    total_budget_cents INT NOT NULL CHECK (total_budget_cents > 0),
    spent_cents INT NOT NULL DEFAULT 0,
    bid_type VARCHAR(10) NOT NULL DEFAULT 'CPM', -- 'CPM', 'CPC'
    bid_cents INT NOT NULL CHECK (bid_cents > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'REJECTED'
    impressions_count INT NOT NULL DEFAULT 0,
    clicks_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_advertiser ON ad_campaigns(advertiser_id, status);
CREATE INDEX IF NOT EXISTS idx_ads_active_status ON ad_campaigns(status) WHERE status = 'ACTIVE';

-- ----------------------------------------------------------------------------
-- 9. Privacy-Friendly Ad Analytics Events (Zero-Location)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- 'IMPRESSION', 'CLICK'
    interest_id UUID REFERENCES interests(id) ON DELETE SET NULL,
    cost_cents INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_events_campaign ON ad_analytics_events(campaign_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 10. Creator Financial & Tax Accounts (Zero Location)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_financial_accounts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gateway VARCHAR(20) NOT NULL DEFAULT 'stripe', -- 'stripe', 'razorpay'
    stripe_account_id VARCHAR(100),
    razorpay_account_id VARCHAR(100),
    payout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    available_balance_cents BIGINT NOT NULL DEFAULT 0,
    pending_balance_cents BIGINT NOT NULL DEFAULT 0,
    lifetime_earnings_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    tax_id_number VARCHAR(100), -- TIN / EIN / GSTIN / PAN
    tax_entity_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL', -- 'INDIVIDUAL', 'BUSINESS'
    tax_legal_name VARCHAR(200),
    tax_jurisdiction_code VARCHAR(50), -- e.g. 'US-W9', 'IN-GST', 'EU-VAT'
    tax_withholding_rate_bps INT NOT NULL DEFAULT 0, -- basis points (e.g. 1000 = 10%)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. Invoices & Itemized Receipts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(200) NOT NULL,
    tax_id_number VARCHAR(100),
    subtotal_cents INT NOT NULL,
    tax_rate_bps INT NOT NULL DEFAULT 0,
    tax_amount_cents INT NOT NULL DEFAULT 0,
    total_amount_cents INT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    gateway VARCHAR(20) NOT NULL,
    gateway_invoice_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'PAID', -- 'DRAFT', 'OPEN', 'PAID', 'VOID'
    items_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, issued_at DESC);

-- ----------------------------------------------------------------------------
-- 12. Creator Payout Records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_payout_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gateway VARCHAR(20) NOT NULL, -- 'stripe', 'razorpay'
    gateway_payout_id VARCHAR(100) UNIQUE,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    tax_withholding_cents BIGINT NOT NULL DEFAULT 0,
    net_payout_cents BIGINT NOT NULL CHECK (net_payout_cents > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'PAID', 'FAILED'
    failure_reason TEXT,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payout_records_creator ON creator_payout_records(creator_id, initiated_at DESC);
