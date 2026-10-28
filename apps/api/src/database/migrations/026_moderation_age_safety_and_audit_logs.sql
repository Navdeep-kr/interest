-- ============================================================================
-- Migration: 026_moderation_age_safety_and_audit_logs.sql
-- Project: "Interest" - Moderation, Age Safety & Trust Architecture
-- IMMUTABLE ZERO-LOCATION RULE: 0 GPS, 0 IP coordinates, NO geographic attributes.
-- ============================================================================

-- 1. Enhance Reports Table for all surfaces (communities) and urgent safety SLAs
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_community_id UUID REFERENCES communities(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reports_target_community ON reports(reported_community_id) WHERE reported_community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_urgent_sla ON reports(is_urgent, sla_due_at) WHERE status = 'PENDING';

-- 2. Enhance Moderation Queue for urgent safety triage and SLA targets
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mod_queue_urgent_priority ON moderation_queue(is_urgent DESC, priority_score DESC, created_at ASC);

-- 3. Enhance Users Table with Server-Enforced Restrictions & Account Suspension
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_posting_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_restricted_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_messaging_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS messaging_restricted_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_commenting_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commenting_restricted_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_suspension ON users(is_suspended, suspension_expires_at);

-- 4. Enhance Reels Table for Prohibited Adult Content & Age Restrictions
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_prohibited_adult BOOLEAN NOT NULL DEFAULT FALSE;
-- Ensure is_age_restricted exists
ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_age_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_reels_prohibited_adult ON reels(is_prohibited_adult);

-- 5. Moderator Action Audit Logs Table (Tamper-evident log of all moderator decisions)
CREATE TABLE IF NOT EXISTS moderator_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(255),
    notes TEXT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_audit_moderator ON moderator_audit_logs(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_audit_target_user ON moderator_audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_audit_entity ON moderator_audit_logs(entity_type, entity_id);

-- 6. Platform Community Guidelines Registry
CREATE TABLE IF NOT EXISTS community_guidelines (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    enforcement_action VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Standard Platform Community Guidelines
INSERT INTO community_guidelines (id, title, category, description, enforcement_action)
VALUES
    ('guide_minor_safety', 'Child Safety & Protection Against Exploitation', 'SAFETY_CRITICAL', 
     'Strict zero-tolerance policy against child sexual abuse material (CSAM), grooming, sexualization, or endangerment of minors. Minors under 13 are prohibited under COPPA.',
     'Immediate permanent account termination, content removal, and urgent referral to law enforcement/NCMEC.'),
    ('guide_adult_prohibited', 'Prohibited Adult Content & Severe Nudity', 'ADULT_POLICY',
     'Sexually explicit acts, pornographic content, non-consensual sexual content, and graphic nudity are strictly prohibited. Such content cannot be monetized, shared, or published.',
     'Immediate content takedown, account strike, and permanent disqualification from monetization.'),
    ('guide_harassment', 'Anti-Harassment, Bullying & Hate Speech', 'COMMUNITY_WELLBEING',
     'Targeted attacks, repeated abusive messages, discriminatory hate speech, doxxing, and intimidation are strictly prohibited across comments, posts, communities, and DMs.',
     'Content removal, progressive account strikes, and temporary or permanent messaging restrictions.'),
    ('guide_impersonation', 'Authenticity & Impersonation Prohibition', 'AUTHENTICITY',
     'Impersonating another creator, brand, organization, or individual to deceive or mislead others is strictly prohibited.',
     'Account suspension, credential verification requirement, or permanent ban.'),
    ('guide_scams_fraud', 'Financial Fraud, Phishing & Deceptive Spam', 'INTEGRITY',
     'Promotion of fraudulent schemes, pyramid schemes, deceptive crypto investments, phishing, or mass automated spam is prohibited.',
     'Immediate ban of offending account, deletion of spam content, and blacklisting of associated links.'),
    ('guide_violence_selfharm', 'Violence, Dangerous Organizations & Self-Harm', 'SAFETY_CRITICAL',
     'Content depicting or encouraging suicide, self-harm, violent extremism, or threats of physical violence is strictly prohibited.',
     'Immediate content removal, urgent safety escalation, and resource provision for mental health support.')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    enforcement_action = EXCLUDED.enforcement_action,
    updated_at = NOW();
