-- ============================================================================
-- Migration: 018_search_recent_and_topic_graph.sql
-- Description: Recent searches history, prohibited/spam search terms moderation,
--              communities search indexes, and topic graph constraints.
-- Strict Zero-Location Architecture: 0% location weighting.
-- ============================================================================

-- Ensure pg_trgm extension is active
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 1. Recent Searches Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_recent_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text VARCHAR(255) NOT NULL,
  search_type VARCHAR(50) NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_search_recent_user_query UNIQUE (user_id, query_text, search_type)
);

CREATE INDEX IF NOT EXISTS idx_search_recent_user_created ON search_recent_queries (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Prohibited & Spam Search Terms
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prohibited_search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'spam',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prohibited_terms_term ON prohibited_search_terms (term);

INSERT INTO prohibited_search_terms (term, category) VALUES
  ('free_followers_hack', 'spam'),
  ('buy_views_cheap', 'spam'),
  ('bot_crypto_pump', 'spam'),
  ('phishing_login_portal', 'illicit'),
  ('carding_dumps_free', 'illicit'),
  ('cp_links_darknet', 'prohibited')
ON CONFLICT (term) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Communities Trigram Search Index
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'paid_interest_communities') THEN
    CREATE INDEX IF NOT EXISTS idx_communities_name_trgm ON paid_interest_communities USING gin (name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_communities_description_trgm ON paid_interest_communities USING gin (description gin_trgm_ops);
  END IF;
END $$;
