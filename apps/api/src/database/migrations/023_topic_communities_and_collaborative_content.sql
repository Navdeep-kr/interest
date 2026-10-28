-- ============================================================================
-- Migration: 023_topic_communities_and_collaborative_content.sql
-- Project: "Interest" - Communities & Collaborative Content
-- STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, 0 location attributes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Topic Communities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID REFERENCES interests(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    avatar_url TEXT,
    banner_url TEXT,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'RESTRICTED', 'PRIVATE')),
    guidelines JSONB DEFAULT '[]'::jsonb,
    members_count INT NOT NULL DEFAULT 1,
    posts_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_interest ON communities(interest_id, is_active);
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON communities(visibility, is_active);
CREATE INDEX IF NOT EXISTS idx_communities_creator ON communities(creator_id);

-- ----------------------------------------------------------------------------
-- 2. Community Memberships & Roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER')),
    status VARCHAR(25) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING_REQUEST', 'INVITED', 'BANNED', 'MUTED')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ban_reason TEXT,
    muted_until TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_community_membership UNIQUE(community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_members_community ON community_memberships(community_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_members_user ON community_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_members_role ON community_memberships(community_id, role);

-- ----------------------------------------------------------------------------
-- 3. Community Discussion & Collaborative Posts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_type VARCHAR(25) NOT NULL DEFAULT 'DISCUSSION' CHECK (post_type IN ('DISCUSSION', 'SHARED_REEL', 'COLLABORATIVE', 'ANNOUNCEMENT')),
    title VARCHAR(250) NOT NULL,
    body TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]'::jsonb,
    reel_id UUID REFERENCES reels(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at TIMESTAMPTZ,
    is_announcement BOOLEAN NOT NULL DEFAULT FALSE,
    collaboration_status VARCHAR(25) DEFAULT 'NONE' CHECK (collaboration_status IN ('NONE', 'PENDING', 'ACCEPTED', 'REJECTED')),
    likes_count INT NOT NULL DEFAULT 0,
    comments_count INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_posts_community ON community_posts(community_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_posts_pinned ON community_posts(community_id, is_pinned) WHERE is_pinned = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_posts_author ON community_posts(author_id);

-- ----------------------------------------------------------------------------
-- 4. Multi-Author Collaborative Post Invitations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_post_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    collaborator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT uq_post_collaborator UNIQUE(post_id, collaborator_id)
);

CREATE INDEX IF NOT EXISTS idx_post_collab_post ON community_post_collaborators(post_id);
CREATE INDEX IF NOT EXISTS idx_post_collab_user ON community_post_collaborators(collaborator_id, status);

-- ----------------------------------------------------------------------------
-- 5. Shared Video Collections
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT DEFAULT '',
    is_curated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_collections_comm ON community_collections(community_id);

CREATE TABLE IF NOT EXISTS community_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES community_collections(id) ON DELETE CASCADE,
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comm_collection_item UNIQUE(collection_id, reel_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_col_items_collection ON community_collection_items(collection_id);

-- ----------------------------------------------------------------------------
-- 6. Moderation Queue & Reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('POST', 'MEMBER', 'COMMUNITY')),
    target_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    action_taken VARCHAR(50),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_reports_community ON community_reports(community_id, status);

-- ----------------------------------------------------------------------------
-- 7. Moderation Appeals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    appellant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ban_or_action_id UUID,
    appeal_reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_appeals_community ON community_appeals(community_id, status);
