-- ============================================================================
-- Migration: 013_analytics_experiments_funnels_retention.sql
-- Project: "Interest" - Event Tracking, Funnels, Retention & A/B Experiments
-- STRICT ARCHITECTURAL INVARIANT: ZERO-LOCATION COMPLIANT.
-- Absolutely NO IP address, NO GPS coordinates, NO geocoding columns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Analytics Events (Custom high-throughput telemetry & PostHog bridge)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    anonymous_id VARCHAR(100),
    event_name VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized indexes for funnel step evaluation, user cohort timelines, and event filtering
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_anon_time ON analytics_events(anonymous_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING gin (properties);

-- ----------------------------------------------------------------------------
-- 2. A/B Testing & Feed Experiments Registry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- 'DRAFT', 'RUNNING', 'PAUSED', 'CONCLUDED'
    variants JSONB NOT NULL,
    salt VARCHAR(32) NOT NULL DEFAULT 'interest_feed_salt',
    target_audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Experiment Exposures (Sticky assignment log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiment_exposures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id VARCHAR(64) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id VARCHAR(64) NOT NULL,
    exposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_exp_user UNIQUE(experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_exposures_exp_variant ON experiment_exposures(experiment_id, variant_id);

-- ----------------------------------------------------------------------------
-- 4. Experiment User Overrides (For Admin QA and test suites)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiment_user_overrides (
    experiment_id VARCHAR(64) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (experiment_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 5. Daily Aggregated Interest Satisfaction Metrics (ISI Rollup)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interest_satisfaction_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    impressions INT NOT NULL DEFAULT 0,
    completions INT NOT NULL DEFAULT 0,
    loops INT NOT NULL DEFAULT 0,
    likes INT NOT NULL DEFAULT 0,
    saves INT NOT NULL DEFAULT 0,
    shares INT NOT NULL DEFAULT 0,
    quick_skips INT NOT NULL DEFAULT 0,
    not_interested_count INT NOT NULL DEFAULT 0,
    show_less_count INT NOT NULL DEFAULT 0,
    pause_interest_count INT NOT NULL DEFAULT 0,
    total_watched_ms BIGINT NOT NULL DEFAULT 0,
    total_predicted_watch_ms BIGINT NOT NULL DEFAULT 0,
    isi_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_isi_date_interest UNIQUE(metric_date, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_isi_date ON interest_satisfaction_daily_aggregates(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_isi_score ON interest_satisfaction_daily_aggregates(isi_score DESC);

-- ----------------------------------------------------------------------------
-- 6. Seed Baseline Experiments for Feed Ranking & Exploration
-- ----------------------------------------------------------------------------
INSERT INTO experiments (id, name, description, status, variants, salt, target_audience_filter)
VALUES
(
    'feed_ranking_algorithm',
    'Feed Multi-Objective Scoring Weights',
    'Evaluates interest match prioritization versus predicted watch time optimization in feed retention.',
    'RUNNING',
    '[
        { "id": "control", "name": "Control (Balanced)", "weight": 50, "config": { "weightMatch": 0.40, "weightPwt": 0.25, "weightEngagement": 0.20, "weightFreshness": 0.15 } },
        { "id": "variant_affinity_boost", "name": "Deep Affinity Boost", "weight": 25, "config": { "weightMatch": 0.55, "weightPwt": 0.20, "weightEngagement": 0.15, "weightFreshness": 0.10 } },
        { "id": "variant_pwt_optimized", "name": "PWT Watch-Time Heavy", "weight": 25, "config": { "weightMatch": 0.35, "weightPwt": 0.35, "weightEngagement": 0.15, "weightFreshness": 0.15 } }
    ]'::jsonb,
    'feed_rank_salt_2026',
    '{}'::jsonb
),
(
    'feed_exploration_ratio',
    'Adjacent Interest Exploration Ratio',
    'Tests 10% vs 15% (control) vs 25% serendipity exploration slots on viewer interest expansion.',
    'RUNNING',
    '[
        { "id": "control", "name": "Control (15% Discovery)", "weight": 50, "config": { "explorationRatio": 0.15 } },
        { "id": "variant_conservative", "name": "Conservative (10% Discovery)", "weight": 25, "config": { "explorationRatio": 0.10 } },
        { "id": "variant_serendipity", "name": "Serendipity Push (25% Discovery)", "weight": 25, "config": { "explorationRatio": 0.25 } }
    ]'::jsonb,
    'feed_exp_salt_2026',
    '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
