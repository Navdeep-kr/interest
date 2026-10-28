-- ============================================================================
-- Migration: 014_compliance_privacy_gdpr_dpdp_ccpa_coppa.sql
-- Project: "Interest" - Legal Compliance Layer
-- Regulations: GDPR, India DPDP Act 2023, CCPA/CPRA, US COPPA, DMCA
-- STRICT ARCHITECTURAL INVARIANT: ZERO-LOCATION COMPLIANT.
-- Absolutely NO IP address, NO GPS coordinates, NO geocoding columns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Granular User Consents Ledger (GDPR Art. 7, DPDP Sec. 6, CCPA Opt-Out)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONSENTED', -- 'CONSENTED', 'WITHDRAWN'
    version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    jurisdiction VARCHAR(20) NOT NULL DEFAULT 'GLOBAL', -- 'GLOBAL', 'GDPR', 'DPDP', 'CCPA', 'COPPA'
    user_agent VARCHAR(255),
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    CONSTRAINT uq_user_consent_purpose UNIQUE(user_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id, status);

-- ----------------------------------------------------------------------------
-- 2. Data Subject Access & Export Requests (GDPR Art. 20, DPDP Sec. 11)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'
    format VARCHAR(10) NOT NULL DEFAULT 'JSON',
    download_url TEXT,
    download_token VARCHAR(128),
    expires_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id, status);

-- ----------------------------------------------------------------------------
-- 3. Right to Erasure / Account Deletion Requests (GDPR Art. 17, DPDP Sec. 12)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDING_GRACE_PERIOD', -- 'PENDING_GRACE_PERIOD', 'PROCESSING', 'COMPLETED', 'CANCELED'
    reason TEXT,
    grace_period_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON account_deletion_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_grace ON account_deletion_requests(grace_period_ends_at, status);

-- ----------------------------------------------------------------------------
-- 4. DMCA Notice & Takedown Workflow (17 U.S.C. § 512)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dmca_takedowns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(32) NOT NULL UNIQUE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claimant_name VARCHAR(100) NOT NULL,
    claimant_email VARCHAR(100) NOT NULL,
    copyrighted_work_description TEXT NOT NULL,
    infringing_material_url TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NOTICE_RECEIVED',
    counter_notice_text TEXT,
    counter_notice_at TIMESTAMPTZ,
    restoration_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dmca_ticket ON dmca_takedowns(ticket_number);
CREATE INDEX IF NOT EXISTS idx_dmca_creator ON dmca_takedowns(creator_id, status);

-- ----------------------------------------------------------------------------
-- 5. Grievance Redressal Mechanism (India DPDP Act 2023 & IT Rules 2021)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_grievances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(32) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    complainant_name VARCHAR(100) NOT NULL,
    complainant_email VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'SUBMITTED',
    assigned_officer VARCHAR(100) DEFAULT 'Resident Grievance Officer (India DPDP)',
    resolution_summary TEXT,
    acknowledgement_sla_deadline TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
    resolution_sla_deadline TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 days'),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grievances_ticket ON compliance_grievances(ticket_number);
CREATE INDEX IF NOT EXISTS idx_grievances_status ON compliance_grievances(status);
