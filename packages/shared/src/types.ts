/**
 * Domain Models, DTOs, and Enums for "Interest"
 * Strict Zero-Location Architecture: No geo, IP, or location coordinates.
 */

export enum ReelStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  TRANSCODING = 'TRANSCODING',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED', // LIVE
  FAILED = 'FAILED', // REJECTED
  ARCHIVED = 'ARCHIVED',
}

export enum ReelVisibility {
  PUBLIC = 'PUBLIC',
  FOLLOWERS_ONLY = 'FOLLOWERS_ONLY',
  PRIVATE = 'PRIVATE',
}


export enum EngagementAction {
  QUICK_SKIP = 'QUICK_SKIP', // Watched < 1.5s
  WATCH_PARTIAL = 'WATCH_PARTIAL', // Watched between 1.5s and 90%
  WATCH_COMPLETE = 'WATCH_COMPLETE', // Watched >= 90%
  LOOP = 'LOOP', // Watched >= 100% and replayed
  LIKE = 'LIKE',
  SAVE = 'SAVE',
  SHARE = 'SHARE',
}

export interface SocialLink {
  title: string;
  url: string;
}

export type TaggingPrivacy = 'EVERYONE' | 'FOLLOWING' | 'NOBODY';
export type MentionPrivacy = 'EVERYONE' | 'FOLLOWING' | 'NOBODY';
export type FollowRelationshipStatus = 'NOT_FOLLOWING' | 'REQUESTED' | 'FOLLOWING';

export interface UserProfile {
  id: string;
  email?: string;
  phoneNumber?: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  preferredLanguages: string[]; // Explicitly chosen by user (e.g. ['en', 'ja'])
  reelsCount: number;
  followersCount: number;
  followingCount: number;
  isPrivate?: boolean;
  links?: SocialLink[];
  hideFollowerCount?: boolean;
  hideFollowingCount?: boolean;
  allowTagging?: TaggingPrivacy;
  allowMentions?: MentionPrivacy;
  // Relationship with viewing user
  isFollowing?: boolean;
  isFollower?: boolean;
  isMutual?: boolean;
  hasPendingRequest?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;
  isRestricted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowRequestItem {
  id: string;
  requesterId: string;
  requester: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  targetId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}


export interface InterestTaxonomyNode {
  id: string;
  slug: string;
  title: string;
  description: string;
  parentId?: string | null;
  level: number; // 0 = Root Category, 1 = Sub-genre, 2 = Deep Niche
  icon?: string;
  vector: number[]; // 512-dimension unit vector
  reelsCount?: number;
  children?: InterestTaxonomyNode[];
}

export enum FeedMode {
  FOR_YOU = 'FOR_YOU',
  FOLLOWING = 'FOLLOWING',
  INTEREST = 'INTEREST',
}

export enum FeedControlAction {
  SHOW_LESS = 'SHOW_LESS',
  NOT_INTERESTED = 'NOT_INTERESTED',
  PAUSE_INTEREST = 'PAUSE_INTEREST',
}

export enum CandidateSource {
  VECTOR_SIMILARITY = 'VECTOR_SIMILARITY',
  TRENDING_INTEREST = 'TRENDING_INTEREST',
  FOLLOWING = 'FOLLOWING',
  EXPLORATION = 'EXPLORATION',
  TEST_AUDIENCE = 'TEST_AUDIENCE',
}

export interface PrefetchReelItem {
  id: string;
  hlsMasterUrl: string;
  thumbnailUrl: string;
  firstSegmentUrl: string;
}

export interface ReelItem {
  id: string;
  creatorId: string;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  title: string;
  caption?: string;
  hlsMasterUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  primaryInterestId: string;
  interestTags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
  remixOf?: RemixAttribution | null;
  allowDuet?: boolean;
  allowRemix?: boolean;
  isAiGenerated?: boolean;
  aiLabelType?: AiLabelType;
  isAgeRestricted?: boolean;
  isPinned?: boolean;
  mediaType?: 'VIDEO' | 'IMAGE';
  imageUrls?: string[];
  visibility?: ReelVisibility;
  hashtags?: string[];
  mentions?: string[];
  similarityScore?: number; // Distance/Similarity from user vector
  rankingScore?: number; // Final combined multi-objective ranking score
  predictedWatchTime?: number; // Normalized predicted completion ratio
  isExplorationSlot?: boolean; // True if delivered via epsilon-greedy serendipity
  isTestAudienceSlot?: boolean; // True if delivered as guaranteed emerging creator test audience
  candidateSource?: CandidateSource;
  explanation?: string; // Human-readable transparency rationale (e.g. "Because you follow #Rust")
  createdAt: string;
}

export interface TelemetryEvent {
  reelId: string;
  durationMs: number;
  watchedMs: number;
  loopCount: number;
  completedFullLoop: boolean;
  action: EngagementAction;
  timestamp: number;
}

export interface TelemetryBatchDto {
  events: TelemetryEvent[];
}

export interface FeedResponseDto {
  items: ReelItem[];
  prefetch: PrefetchReelItem[];
  nextCursor?: string | null;
  hasMore: boolean;
  batchTimestamp: number;
  mode: FeedMode;
  interestFilter?: {
    id: string;
    slug: string;
    title: string;
  } | null;
}

export interface FeedControlDto {
  reelId: string;
  action: FeedControlAction;
  interestId?: string;
  reason?: string;
}

export interface FeedControlResponse {
  success: boolean;
  action: FeedControlAction;
  message: string;
  interestId?: string;
}

export interface CreateReelPresignedUrlDto {
  filename: string;
  contentType: string;
  fileSizeBytes: number;

}

export interface CreateReelPresignedUrlResponse {
  reelId: string;
  uploadUrl: string;
  s3Key: string;
  expiresInSeconds: number;
}

export interface FinalizeReelDto {
  reelId: string;
  title: string;
  caption?: string;
  hashtags?: string[];
  primaryInterestId: string;
  interestTagIds: string[];
  visibility?: ReelVisibility;
  coverTimestampSeconds?: number;
}

export interface InitiateMultipartUploadDto {
  filename: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface InitiateMultipartUploadResponse {
  reelId: string;
  uploadId: string;
  s3Key: string;
  partSize: number;
  expectedParts: number;
}

export interface GetMultipartPartUrlsDto {
  reelId: string;
  uploadId: string;
  s3Key: string;
  partNumbers: number[];
}

export interface MultipartPartUrl {
  partNumber: number;
  url: string;
}

export interface CompleteMultipartUploadDto {
  reelId: string;
  uploadId: string;
  s3Key: string;
  parts: Array<{ partNumber: number; etag: string }>;
}

export interface ReelStatusResponse {
  reelId: string;
  status: ReelStatus;
  progressPercent: number;
  hlsMasterUrl?: string | null;
  thumbnailUrl?: string | null;
  errorReason?: string | null;
  updatedAt: string;
}

export interface SuggestInterestsDto {
  title: string;
  caption?: string;
  hashtags?: string[];
  limit?: number;
}

export interface SuggestedInterestItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  confidenceScore: number;
  parentTitle?: string;
}


export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInterestItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: number;
  affinityWeight: number;
  isMuted: boolean;
  isPaused: boolean;
  interactionCount: number;
}

export interface WhyAmISeeingThisResponse {
  reelId: string;
  reelTitle: string;
  primaryInterest: {
    id: string;
    slug: string;
    title: string;
  };
  matchedInterests: Array<{
    id: string;
    slug: string;
    title: string;
    isPrimary: boolean;
    userFollows: boolean;
    userAffinityWeight?: number;
  }>;
  vectorSimilarityPercent: number;
  userAffinityWeight?: number;
  isExplorationSlot: boolean;
  rationale: string;
  zeroLocationGuarantee: string;
}

// ============================================================================
// Social Engagement, Interactions, Collections & Remix Types
// ============================================================================

export interface LikeToggleResponse {
  liked: boolean;
  likeCount: number;
  reelId: string;
}

export interface CommentLikeToggleResponse {
  liked: boolean;
  likeCount: number;
  commentId: string;
}

export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface CommentItem {
  id: string;
  reelId: string;
  userId: string;
  user: CommentAuthor;
  parentId?: string | null;
  text: string;
  likeCount: number;
  isLiked?: boolean;
  isPinned: boolean;
  isHidden: boolean;
  repliesCount: number;
  replies?: CommentItem[];
  mentions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentDto {
  text: string;
  parentId?: string;
}

export interface CommentModerateDto {
  action: 'hide' | 'unhide' | 'delete';
}

export interface CommentsResponseDto {
  items: CommentItem[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface SaveToggleResponse {
  saved: boolean;
  saveCount: number;
  reelId: string;
}

export interface CollectionItem {
  id: string;
  userId: string;
  name: string;
  isPrivate: boolean;
  reelsCount: number;
  previewThumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionDto {
  name: string;
  isPrivate?: boolean;
}

export interface SaveToCollectionDto {
  reelId: string;
}

export interface CollectionDetailsResponse {
  collection: CollectionItem;
  reels: ReelItem[];
  totalCount: number;
}

export interface CreateShareDto {
  platform?: string; // 'internal', 'whatsapp', 'twitter', 'copy_link', etc.
}

export interface ShareResponse {
  shared: boolean;
  shareCount: number;
  shareUrl: string;
}

export interface FollowToggleResponse {
  following: boolean;
  isMutual: boolean;
  followersCount: number;
  followingCount: number;
}

export interface FollowProfileItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  isFollowing: boolean;
  isMutual: boolean;
}

export type RemixType = 'DUET' | 'REMIX' | 'AUDIO_USE';

export interface RemixAttribution {
  originalReelId: string;
  originalTitle: string;
  originalCreator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  remixType: RemixType;
  originalAudioUrl?: string;
}

export interface ReelRemixesResponse {
  originalReelId: string;
  totalRemixes: number;
  remixes: ReelItem[];
}

// ============================================================================
// Creator Tools, In-App Editor, Drafts, Scheduling & Analytics Types
// ============================================================================

export interface VideoClipItem {
  id: string;
  uri: string;
  durationSeconds: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  speed: number;
}

export interface TextOverlayItem {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  xPercent: number; // 0-100% of video width
  yPercent: number; // 0-100% of video height
  startTimeSeconds: number;
  endTimeSeconds: number;
  startTimeMs?: number;
  endTimeMs?: number;
  fontStyle?: string;
  backgroundColor?: string;
}

export type AspectRatioPreset = '9:16' | '1:1' | '16:9' | '4:5';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SubtitleCue {
  id: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

export interface AudioMixControls {
  originalVolume: number; // 0.0 - 1.0
  soundVolume: number; // 0.0 - 1.0
  isMuted: boolean;
  soundStartOffsetMs?: number;
}

export interface LicensedSoundItem {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  audioUrl: string;
  genre?: string;
  isLicensed: boolean;
  licenseType?: string;
  coverUrl?: string;
  attributionText?: string;
  reelsCount?: number;
}

export interface AudienceControlsDto {
  visibility: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
  allowComments: boolean;
  allowRemix: boolean;
  isCommercial: boolean;
  brandName?: string;
}

export interface StickerOverlayItem {
  id: string;
  emoji: string;
  label?: string;
  xPercent: number;
  yPercent: number;
  scale: number;
}

export type VideoFilterPreset =
  | 'none'
  | 'vibrant'
  | 'noir'
  | 'cyberpunk'
  | 'cinematic'
  | 'lofi'
  | 'warm';

export interface AudioTrackItem {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  audioUrl: string;
  genre?: string;
  isLicensed?: boolean;
  licenseType?: string;
}

export interface EditorState {
  clips: VideoClipItem[];
  textOverlays: TextOverlayItem[];
  stickers: StickerOverlayItem[];
  filter: VideoFilterPreset;
  musicTrack?: {
    track: AudioTrackItem;
    musicVolume: number; // 0.0 - 1.0
    originalAudioVolume: number; // 0.0 - 1.0
  } | null;
  autoCaptions: boolean;
  playbackSpeed: number;
  aspectRatio?: AspectRatioPreset;
  cropRect?: CropRect;
  subtitles?: SubtitleCue[];
  audioControls?: AudioMixControls;
  trimStartMs?: number;
  trimEndMs?: number;
  coverFrameTimestampMs?: number;
}

export interface ReelDraftItem {
  id: string;
  userId: string;
  clientDraftId?: string;
  title: string;
  caption?: string;
  primaryInterestId?: string;
  secondaryTagIds?: string[];
  hashtags?: string[];
  coverTimestamp: number;
  coverFrameTimestampMs?: number;
  videoUri?: string;
  aspectRatio?: AspectRatioPreset;
  trimStartMs?: number;
  trimEndMs?: number;
  cropRect?: CropRect;
  subtitles?: SubtitleCue[];
  textOverlays?: TextOverlayItem[];
  audioControls?: AudioMixControls;
  soundId?: string;
  sound?: LicensedSoundItem;
  visibility?: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
  allowComments?: boolean;
  allowRemix?: boolean;
  isCommercial?: boolean;
  brandName?: string;
  scheduledAt?: string;
  editorState: EditorState;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDraftDto {
  clientDraftId?: string;
  title?: string;
  caption?: string;
  primaryInterestId?: string;
  secondaryTagIds?: string[];
  hashtags?: string[];
  coverTimestamp?: number;
  coverFrameTimestampMs?: number;
  videoUri?: string;
  aspectRatio?: AspectRatioPreset;
  trimStartMs?: number;
  trimEndMs?: number;
  cropRect?: CropRect;
  subtitles?: SubtitleCue[];
  textOverlays?: TextOverlayItem[];
  audioControls?: AudioMixControls;
  soundId?: string;
  visibility?: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
  allowComments?: boolean;
  allowRemix?: boolean;
  isCommercial?: boolean;
  brandName?: string;
  scheduledAt?: string;
  editorState?: EditorState;
}

export interface ScheduleReelDto {
  reelId: string;
  scheduledAt: string; // ISO 8601 string
  clientTimezoneOffsetMinutes?: number;
}

export interface PublishReelDto {
  clientPublicationId: string; // Idempotency token to prevent duplicate publish
  reelId?: string;
  title: string;
  caption?: string;
  primaryInterestId?: string;
  secondaryTagIds?: string[];
  hashtags?: string[];
  aspectRatio?: AspectRatioPreset;
  trimStartMs?: number;
  trimEndMs?: number;
  coverFrameTimestampMs?: number;
  cropRect?: CropRect;
  subtitles?: SubtitleCue[];
  textOverlays?: TextOverlayItem[];
  audioControls?: AudioMixControls;
  soundId?: string;
  visibility?: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
  allowComments?: boolean;
  allowRemix?: boolean;
  isCommercial?: boolean;
  brandName?: string;
  scheduledAt?: string;
  clientTimezoneOffsetMinutes?: number;
}

export type PublishingSessionStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED';

export interface PublishingSessionResponse {
  sessionId: string;
  reelId?: string;
  clientPublicationId: string;
  status: PublishingSessionStatus;
  stage: string;
  progressPercent: number;
  errorMessage?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  hlsMasterUrl?: string | null;
  thumbnailUrl?: string | null;
  updatedAt: string;
}

export interface ScheduledReelItem {
  id: string;
  creatorId: string;
  title: string;
  caption?: string;
  thumbnailUrl?: string;
  scheduledAt: string;
  primaryInterestId: string;
  status: ReelStatus;
  createdAt: string;
}

export interface CreatorAudienceInterest {
  interestId: string;
  interestTitle: string;
  categoryTitle?: string;
  viewerCount: number;
  percentage: number;
}

export interface RetentionPoint {
  bucketPercent: number; // 0, 10, 20, ..., 100
  retentionPercent: number; // 100% down to completion %
}

export interface FollowerGrowthPoint {
  date: string; // YYYY-MM-DD
  newFollowers: number;
  netFollowers: number;
}

export interface CreatorTopReel {
  id: string;
  title: string;
  thumbnailUrl?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  avgCompletionRate: number;
  primaryInterestTitle?: string;
  createdAt: string;
}

export interface CreatorAnalyticsOverview {
  totalViews: number;
  totalWatchHours: number;
  avgWatchRatio: number;
  totalFollowers: number;
  followerGrowthPercent: number;
  topInterests: CreatorAudienceInterest[];
  retentionCurve: RetentionPoint[];
  followerGrowth: FollowerGrowthPoint[];
  topReels: CreatorTopReel[];
  zeroLocationGuarantee: string;
}

// ----------------------------------------------------------------------------
// Search, Audio & Discovery Models
// ----------------------------------------------------------------------------

export enum SearchType {
  ALL = 'all',
  REELS = 'reels',
  USERS = 'users',
  HASHTAGS = 'hashtags',
  INTERESTS = 'interests',
  AUDIO = 'audio',
  COMMUNITIES = 'communities',
}

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  audioUrl: string;
  durationSeconds: number;
  coverUrl?: string;
  reelsCount: number;
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  followersCount: number;
  reelsCount: number;
  isVerified: boolean;
  sharedInterestsCount: number;
  relevanceScore: number;
}

export interface HashtagSearchResult {
  id: string;
  tag: string;
  reelsCount: number;
  isTrending?: boolean;
  relevanceScore: number;
}

export interface InterestSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  categoryTitle?: string;
  level: number;
  icon?: string;
  reelsCount: number;
  viewerAffinityWeight?: number;
  relevanceScore: number;
}

export interface ReelSearchResult {
  id: string;
  title: string;
  caption?: string;
  transcriptText?: string;
  thumbnailUrl: string;
  hlsMasterUrl: string;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  primaryInterest: {
    id: string;
    title: string;
  };
  hashtags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  matchSnippet?: string; // Highlighted match inside title, caption, or auto-transcript
  matchSource?: 'title' | 'caption' | 'transcript' | 'hashtag';
  textRelevanceScore: number;
  interestMatchScore: number;
  finalRankScore: number;
}

export interface AudioSearchResult {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  audioUrl: string;
  durationSeconds: number;
  coverUrl?: string;
  reelsCount: number;
  relevanceScore: number;
}

export interface CommunitySearchResult {
  id: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  creatorId: string;
  creatorUsername?: string;
  interestId: string;
  interestTitle?: string;
  membersCount: number;
  priceCents: number;
  currency: string;
  pricingType: string;
  relevanceScore: number;
}

export interface UnifiedSearchResults {
  query: string;
  reels: ReelSearchResult[];
  users: UserSearchResult[];
  hashtags: HashtagSearchResult[];
  interests: InterestSearchResult[];
  audio: AudioSearchResult[];
  communities?: CommunitySearchResult[];
  totalCount: number;
  isProhibited?: boolean;
  moderationMessage?: string;
  emptySuggestions?: {
    trendingTopics: string[];
    popularHashtags: string[];
  };
}

export interface RecentSearchItem {
  id: string;
  userId: string;
  queryText: string;
  searchType: string;
  createdAt: string;
}

export interface SafeAutocompleteSuggestion {
  text: string;
  type: 'topic' | 'creator' | 'hashtag' | 'community' | 'query';
  id?: string;
  icon?: string;
  subtitle?: string;
}

export interface SafeAutocompleteResult {
  query: string;
  suggestions: SafeAutocompleteSuggestion[];
  isProhibited?: boolean;
}

export interface TopicPageDetails {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: number;
  icon?: string;
  parentId?: string;
  parentTitle?: string;
  breadcrumbs: { id: string; slug: string; title: string; level: number }[];
  subtopics: { id: string; slug: string; title: string; icon?: string; reelsCount: number }[];
  relatedInterests: { id: string; slug: string; title: string; similarityScore: number }[];
  reelsCount: number;
  followersCount: number;
  isFollowing: boolean;
  isMuted: boolean;
  isPaused: boolean;
  recentReels: ReelSearchResult[];
  topReels: ReelSearchResult[];
}

export interface TransparentTrendingWindow {
  window: '24h' | '72h' | '7d';
  calculatedAt: string;
  topics: {
    id: string;
    slug: string;
    title: string;
    categoryTitle: string;
    icon?: string;
    velocityScore: number;
    postCount: number;
    rank: number;
  }[];
  hashtags: {
    tag: string;
    postCount: number;
    rank: number;
  }[];
}

export interface TrendingInterest {
  id: string;
  slug: string;
  title: string;
  categoryTitle: string;
  icon?: string;
  recentReelsCount: number;
  growthPercent: number;
  totalReelsCount: number;
  trendingRank: number;
}

export interface ExplorePayload {
  trendingInterests: TrendingInterest[];
  recommendedTopics: InterestTaxonomyNode[];
  featuredCreators: UserSearchResult[];
  trendingAudio: AudioSearchResult[];
  categoryClusters: {
    categoryId: string;
    categoryTitle: string;
    icon?: string;
    topicsCount: number;
    sampleNiches: string[];
  }[];
}

// ----------------------------------------------------------------------------
// Direct Messaging (DMs), WebSockets & Voice Notes Models
// ----------------------------------------------------------------------------

export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING', // Message request from non-mutual/stranger
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum ParticipantRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum MessageType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  REEL = 'REEL',
  SYSTEM = 'SYSTEM',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export interface VoiceMetadata {
  url: string;
  durationSeconds: number;
  waveform: number[]; // Normalized amplitude points e.g. [20, 65, 80, 45, ...]
}

export interface AttachedReelPreview {
  id: string;
  title: string;
  thumbnailUrl?: string;
  creatorUsername: string;
  primaryInterestTitle: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  text?: string;
  messageType: MessageType;
  voiceMetadata?: VoiceMetadata;
  attachedReel?: AttachedReelPreview;
  mediaUrl?: string;
  mediaType?: string;
  seqNum: number;
  clientMsgId?: string;
  status: MessageStatus | string;
  isEdited: boolean;
  editedAt?: string;
  isRead: boolean;
  readBy: string[]; // List of user IDs who have read this message
  readAt?: string;
  deliveredTo?: string[];
  deliveredAt?: string;
  isEphemeral: boolean;
  expiresAt?: string;
  isDeletedForEveryone?: boolean;
  createdAt: string;
}

export interface ConversationParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: ParticipantRole;
  status: 'ACCEPTED' | 'PENDING' | 'REJECTED';
  isMuted?: boolean;
  isArchived?: boolean;
  lastDeliveredMessageId?: string;
  lastReadMessageId?: string;
  lastReadSeq?: number;
  lastReadAt?: string;
  joinedAt: string;
}

export interface ConversationItem {
  id: string;
  type: ConversationType;
  title?: string; // Group title or other participant display name
  avatarUrl?: string;
  creatorId?: string;
  status: ConversationStatus;
  participants: ConversationParticipant[];
  lastMessage?: MessageItem;
  lastMessageAt: string;
  lastSeqNum: number;
  lastMessagePreview?: string;
  unreadCount: number;
  disappearingTtlSeconds?: number | null;
  isMuted?: boolean;
  isArchived?: boolean;
  isSpamRequest?: boolean;
  spamScore?: number;
  createdAt: string;
}

export interface CreateDirectChatDto {
  targetUserId: string;
  initialText?: string;
  initialReelId?: string;
}

export interface CreateGroupChatDto {
  title: string;
  participantUserIds: string[];
  avatarUrl?: string;
  disappearingTtlSeconds?: number;
}

export interface SendMessageDto {
  conversationId: string;
  text?: string;
  messageType?: MessageType;
  voiceUrl?: string;
  voiceDurationSeconds?: number;
  voiceWaveform?: number[];
  attachedReelId?: string;
  mediaUrl?: string;
  mediaType?: string;
  clientMsgId?: string;
  expiresInSeconds?: number; // Override TTL if specified
}

export interface EditMessageDto {
  text: string;
}

export interface DeleteMessageDto {
  deleteForEveryone?: boolean;
}

export interface MarkDeliveredDto {
  messageId?: string;
  seqNum?: number;
}

export interface SyncMessagesResponse {
  conversationId: string;
  messages: MessageItem[];
  latestSeqNum: number;
  hasMore: boolean;
}

export interface AddGroupParticipantDto {
  userId: string;
}

export interface UpdateParticipantRoleDto {
  role: ParticipantRole;
}

export interface ReportMessageDto {
  reason: string;
  details?: string;
}

export interface ToggleConversationControlDto {
  isMuted?: boolean;
  isArchived?: boolean;
}

export type ContactPrivacySetting = 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY';

export interface UpdateDisappearingTimerDto {
  ttlSeconds: number | null; // null = off, 86400 = 24h, 604800 = 7d, etc.
}

export interface RespondRequestDto {
  action: 'ACCEPT' | 'DECLINE' | 'BLOCK';
}

export interface ChatPrivacySettingsDto {
  readReceiptsEnabled: boolean;
  messageRequestsFilter: 'STANDARD' | 'STRICT' | 'OFF';
  messagePrivacy?: ContactPrivacySetting;
}

export enum WsChatEvents {
  // Client -> Server
  JOIN_CONVERSATION = 'join_conversation',
  LEAVE_CONVERSATION = 'leave_conversation',
  SEND_MESSAGE = 'send_message',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  MARK_READ = 'mark_read',
  MARK_DELIVERED = 'mark_delivered',

  // Server -> Client
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_SENT = 'message:sent',
  MESSAGE_DELIVERED = 'message:delivered',
  MESSAGE_READ = 'message:read',
  MESSAGE_EDITED = 'message:edited',
  MESSAGE_DELETED = 'message:deleted',
  USER_TYPING = 'user:typing',
  CONVERSATION_UPDATED = 'conversation:updated',
  REQUEST_ACTION = 'request:action',
  ERROR = 'error',
}

// ============================================================================
// TRUST & SAFETY ENUMS, INTERFACES & DTOS
// ============================================================================

export enum ReportTargetType {
  REEL = 'REEL',
  COMMENT = 'COMMENT',
  USER = 'USER',
  MESSAGE = 'MESSAGE',
  COMMUNITY = 'COMMUNITY',
}

export enum ReportCategory {
  NUDITY_SEXUAL = 'NUDITY_SEXUAL',
  VIOLENCE_DANGEROUS = 'VIOLENCE_DANGEROUS',
  HATE_SPEECH_HARASSMENT = 'HATE_SPEECH_HARASSMENT',
  HARASSMENT_BULLYING = 'HARASSMENT_BULLYING',
  IMPERSONATION = 'IMPERSONATION',
  SCAM_FRAUD = 'SCAM_FRAUD',
  COPYRIGHT_INFRINGEMENT = 'COPYRIGHT_INFRINGEMENT',
  SPAM_SCAM = 'SPAM_SCAM',
  MINOR_SAFETY = 'MINOR_SAFETY',
  SELF_HARM_SUICIDE = 'SELF_HARM_SUICIDE',
  MISINFORMATION = 'MISINFORMATION',
  UNLABELED_AI = 'UNLABELED_AI',
  ADULT_PROHIBITED = 'ADULT_PROHIBITED',
}

export enum SeverityLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ModerationStatus {
  PENDING_SCAN = 'PENDING_SCAN',
  APPROVED = 'APPROVED',
  FLAGGED = 'FLAGGED',
  REJECTED = 'REJECTED',
  REMOVED = 'REMOVED',
}

export enum ModerationActionType {
  APPROVE = 'APPROVE',
  REMOVE = 'REMOVE',
  AGE_RESTRICT = 'AGE_RESTRICT',
  LABEL_AI = 'LABEL_AI',
  WARN_USER = 'WARN_USER',
  RESTRICT_USER = 'RESTRICT_USER',
  SUSPEND_USER = 'SUSPEND_USER',
  BAN_USER = 'BAN_USER',
}

export enum AiLabelType {
  NONE = 'NONE',
  CREATOR_DISCLOSED = 'CREATOR_DISCLOSED',
  AI_DETECTED = 'AI_DETECTED',
  MODERATOR_ENFORCED = 'MODERATOR_ENFORCED',
}

export enum AppealStatus {
  PENDING = 'PENDING',
  APPROVED_REINSTATED = 'APPROVED_REINSTATED',
  REJECTED = 'REJECTED',
}

export interface ModerationQueueItem {
  id: string;
  entityType: ReportTargetType;
  entityId: string;
  creatorId: string;
  creatorUsername?: string;
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  priorityScore: number;
  reasons: string[];
  reportCount: number;
  isUrgent?: boolean;
  slaDueAt?: string | null;
  assignedModeratorId?: string | null;
  aiModerationScores?: {
    nudity?: number;
    violence?: number;
    hateSpeech?: number;
    copyrightMatch?: number;
    syntheticProbability?: number;
  };
  contentPreview?: {
    title?: string;
    caption?: string;
    thumbnailUrl?: string;
    text?: string;
    name?: string;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAppealItem {
  id: string;
  userId: string;
  username?: string;
  entityType: string;
  entityId: string;
  statement: string;
  status: AppealStatus;
  reviewerId?: string | null;
  reviewNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface UserStrikeItem {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  reason: string;
  severity: 'WARNING' | 'STANDARD' | 'SEVERE';
  expiresAt: string;
  createdAt: string;
}

export interface KeywordFilterItem {
  id: string;
  userId: string;
  keyword: string;
  isRegex: boolean;
  createdAt: string;
}

export interface CreateReportDto {
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  details?: string;
}

export interface CreateAppealDto {
  entityType: string;
  entityId: string;
  statement: string;
}

export interface ModeratorActionDto {
  action: ModerationActionType;
  notes?: string;
  suspensionDays?: number;
  restrictionType?: 'POSTING' | 'COMMENTING' | 'MESSAGING' | 'COMMUNITY' | 'ACCOUNT_SUSPENSION';
  restrictionDays?: number;
}

export interface ResolveAppealDto {
  decision: 'APPROVE' | 'REJECT';
  notes?: string;
}

export interface UserAccountSafetyStatus {
  userId: string;
  isActive: boolean;
  isSuspended: boolean;
  suspensionExpiresAt?: string | null;
  suspensionReason?: string | null;
  strikesCount: number;
  isPostingRestricted: boolean;
  postingRestrictedUntil?: string | null;
  isMessagingRestricted: boolean;
  messagingRestrictedUntil?: string | null;
  isCommentingRestricted: boolean;
  commentingRestrictedUntil?: string | null;
}

export interface ModeratorAuditLogItem {
  id: string;
  moderatorId: string;
  moderatorUsername?: string;
  action: ModerationActionType | string;
  entityType: string;
  entityId: string;
  targetUserId?: string | null;
  reason?: string | null;
  notes?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  createdAt: string;
}

export interface OperationalSlaStatus {
  pendingReportsCount: number;
  urgentReportsCount: number;
  breachedSlaCount: number;
  avgResolutionTimeMinutes: number;
  complianceRatePercent: number;
}

export interface CommunityGuidelineItem {
  id: string;
  title: string;
  category: string;
  description: string;
  enforcementAction: string;
  updatedAt: string;
}

export interface SafetySettingsDto {
  minorSafetyEnforced: boolean;
  personalizedAdsEnabled: boolean;
  strictCommentFiltering: boolean;
}

export interface ContentScanResult {
  action: 'APPROVE' | 'FLAG' | 'REJECT';
  reasons: string[];
  scores: {
    nudity: number;
    violence: number;
    hateSpeech: number;
    copyrightMatch: number;
    syntheticProbability: number;
  };
  isAiGenerated: boolean;
  aiLabelType: AiLabelType;
  copyrightMatchedTrack?: {
    title: string;
    artist: string;
    rightsHolder: string;
    allowedForRemix: boolean;
  };
}

// ============================================================================
// NOTIFICATIONS ENUMS, INTERFACES & DTOS
// ============================================================================

export enum NotificationType {
  LIKE = 'LIKE',
  COMMENT = 'COMMENT',
  MENTION = 'MENTION',
  FOLLOW = 'FOLLOW',
  DM = 'DM',
  INTEREST_DIGEST = 'INTEREST_DIGEST',
  CREATOR_MILESTONE = 'CREATOR_MILESTONE',
  SECURITY_ALERT = 'SECURITY_ALERT',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
}

export enum NotificationPriority {
  URGENT = 'URGENT', // 1:1 DMs, security alerts -> bypass quiet hours & throttling
  HIGH = 'HIGH',     // Direct mentions, comment replies
  NORMAL = 'NORMAL', // Likes, follows, creator milestones
  LOW = 'LOW',       // Weekly interest digests
}

export enum DevicePlatform {
  FCM = 'FCM',
  APNS = 'APNS',
  WEB = 'WEB',
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actorId?: string;
  actorIds?: string[];
  actorCount: number;
  actors?: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  }>;
  entityId?: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  isRead: boolean;
  isBatched: boolean;
  deepLinkUrl?: string;
  dedupKey?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  // In-App
  inAppLikes: boolean;
  inAppComments: boolean;
  inAppMentions: boolean;
  inAppFollows: boolean;
  inAppDms: boolean;
  inAppInterests: boolean;
  inAppMilestones: boolean;
  // Push
  pushLikes: boolean;
  pushComments: boolean;
  pushMentions: boolean;
  pushFollows: boolean;
  pushDms: boolean;
  pushInterests: boolean;
  pushMilestones: boolean;
  // Email
  emailDigest: boolean;
  emailSecurityAlerts: boolean;
  emailMilestones: boolean;
  // Privacy
  hideNotificationPreviews: boolean;
  // Quiet Hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // '22:00'
  quietHoursEnd: string;   // '08:00'
  clientTimezoneOffsetMinutes: number; // e.g. -300 or +330
  // Throttling
  maxPushesPerHour: number;
  batchingWindowSeconds: number;
}

export interface RegisterDeviceTokenDto {
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  pushProvider?: string;
}

export interface UpdateNotificationPreferencesDto {
  inAppLikes?: boolean;
  inAppComments?: boolean;
  inAppMentions?: boolean;
  inAppFollows?: boolean;
  inAppDms?: boolean;
  inAppInterests?: boolean;
  inAppMilestones?: boolean;
  pushLikes?: boolean;
  pushComments?: boolean;
  pushMentions?: boolean;
  pushFollows?: boolean;
  pushDms?: boolean;
  pushInterests?: boolean;
  pushMilestones?: boolean;
  emailDigest?: boolean;
  emailSecurityAlerts?: boolean;
  emailMilestones?: boolean;
  hideNotificationPreviews?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  clientTimezoneOffsetMinutes?: number;
  maxPushesPerHour?: number;
}

export interface DispatchNotificationDto {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body: string;
  entityId?: string;
  deepLinkUrl?: string;
  dedupKey?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  forceImmediatePush?: boolean;
  hidePreview?: boolean;
}

export type DeepLinkTargetScreen =
  | 'reel'
  | 'profile'
  | 'chat_thread'
  | 'topic'
  | 'notification_center'
  | 'settings_notifications'
  | 'not_found'
  | 'access_denied';

export interface DeepLinkResolutionResult {
  url: string;
  targetScreen: DeepLinkTargetScreen;
  params: Record<string, string>;
  isValid: boolean;
  accessGranted: boolean;
  title?: string;
  fallbackReason?: string;
}

export interface ResolveDeepLinkDto {
  url: string;
}

// ============================================================================
// MONETIZATION: SUBSCRIPTIONS, TIPS, COMMUNITIES, CREATOR FUND & ADS
// ============================================================================

export enum PaymentGateway {
  STRIPE = 'stripe',
  RAZORPAY = 'razorpay',
  APPLE_IAP = 'apple_iap',
  GOOGLE_PLAY = 'google_play',
}

export enum EntitlementType {
  CREATOR_SUBSCRIPTION = 'CREATOR_SUBSCRIPTION',
  COMMUNITY_PASS = 'COMMUNITY_PASS',
  EXCLUSIVE_CONTENT = 'EXCLUSIVE_CONTENT',
  VIP_BADGE = 'VIP_BADGE',
}

export enum EntitlementStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  DISPUTED = 'DISPUTED',
}

export enum KycStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  TRIALING = 'trialing',
}

export enum TipStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum CommunityPricingType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
}

export enum CommunityMembershipStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
}

export enum CreatorFundPoolStatus {
  OPEN = 'open',
  CALCULATING = 'calculating',
  DISTRIBUTED = 'distributed',
}

export enum AdCampaignStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXHAUSTED = 'EXHAUSTED',
  REJECTED = 'REJECTED',
}

export enum AdBidType {
  CPM = 'CPM',
  CPC = 'CPC',
}

export enum AdEventType {
  IMPRESSION = 'IMPRESSION',
  CLICK = 'CLICK',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
}

export enum TaxEntityType {
  INDIVIDUAL = 'INDIVIDUAL',
  BUSINESS = 'BUSINESS',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export interface CreatorSubscriptionPlan {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  perks: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSubscriptionItem {
  id: string;
  subscriberId: string;
  creatorId: string;
  planId: string;
  planTitle?: string;
  gateway: PaymentGateway;
  gatewaySubscriptionId?: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export interface CreatorTipItem {
  id: string;
  senderId: string;
  creatorId: string;
  reelId?: string;
  amountCents: number;
  platformFeeCents: number;
  netCreatorCents: number;
  currency: string;
  message?: string;
  gateway: PaymentGateway;
  status: TipStatus;
  createdAt: string;
}

export interface PaidInterestCommunityItem {
  id: string;
  creatorId: string;
  interestId: string;
  interestTitle?: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  pricingType: CommunityPricingType;
  priceCents: number;
  currency: string;
  billingInterval?: 'month' | 'year';
  membersCount: number;
  isActive: boolean;
  isMember?: boolean;
  createdAt: string;
}

export interface PaidCommunityMembershipItem {
  id: string;
  communityId: string;
  userId: string;
  status: CommunityMembershipStatus;
  gateway: PaymentGateway;
  expiresAt?: string;
  createdAt: string;
}

export interface CreatorFundPoolItem {
  id: string;
  periodName: string;
  totalPoolCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: CreatorFundPoolStatus;
  totalQualifiedWatchTimeSeconds: number;
  createdAt: string;
}

export interface CreatorFundAllocationItem {
  id: string;
  poolId: string;
  periodName?: string;
  creatorId: string;
  qualifiedWatchTimeSeconds: number;
  affinityWeightedScore: number;
  interestBreakdown: Record<string, number>;
  earningsCents: number;
  status: 'allocated' | 'credited' | 'paid';
  createdAt: string;
}

export interface AdCampaignItem {
  id: string;
  advertiserId: string;
  title: string;
  reelId: string;
  targetInterestIds: string[];
  callToActionUrl?: string;
  callToActionText: string;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  spentCents: number;
  bidType: AdBidType;
  bidCents: number;
  status: AdCampaignStatus;
  impressionsCount: number;
  clicksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedAdItem {
  isAd: true;
  campaignId: string;
  reelId: string;
  advertiserId: string;
  advertiserName: string;
  title: string;
  targetInterestId: string;
  callToActionUrl?: string;
  callToActionText: string;
  attributionToken: string;
}

export interface CreatorFinancialAccount {
  userId: string;
  gateway: PaymentGateway;
  stripeAccountId?: string;
  razorpayAccountId?: string;
  payoutEnabled: boolean;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  lifetimeEarningsCents: number;
  currency: string;
  taxIdNumber?: string;
  taxEntityType: TaxEntityType;
  taxLegalName?: string;
  taxJurisdictionCode?: string;
  taxWithholdingRateBps: number;
  kycStatus: KycStatus;
  isComplianceBlocked: boolean;
  complianceBlockReason?: string;
  taxFormType?: string;
  taxFormSubmittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserEntitlementItem {
  id: string;
  userId: string;
  creatorId?: string;
  entitlementType: EntitlementType;
  planId?: string;
  reelId?: string;
  gateway: PaymentGateway;
  transactionId: string;
  status: EntitlementStatus;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorEligibilityStatus {
  isEligible: boolean;
  minFollowersRequired: number;
  currentFollowers: number;
  minAccountAgeDays: number;
  currentAccountAgeDays: number;
  kycStatus: KycStatus;
  isTaxCompliant: boolean;
  isComplianceBlocked: boolean;
  complianceBlockReason?: string;
  reasons: string[];
}

export interface FinancialAuditTrailItem {
  id: string;
  userId: string;
  actionType: string;
  amountCents: number;
  feeCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  referenceId?: string;
  notes?: string;
  createdAt: string;
}

export interface CreatorPayoutInvoiceItem {
  id: string;
  payoutRecordId?: string;
  invoiceNumber: string;
  creatorId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  taxWithheldCents: number;
  netPayoutCents: number;
  currency: string;
  taxIdMasked?: string;
  issuedAt: string;
  pdfUrl?: string;
}

export interface RestorePurchasesDto {
  gateway: PaymentGateway;
  receiptData?: string;
  purchaseToken?: string;
  productId?: string;
}

export interface RestorePurchasesResult {
  restoredCount: number;
  restoredEntitlements: UserEntitlementItem[];
  message: string;
}

export interface VerifyInAppPurchaseDto {
  gateway: PaymentGateway.APPLE_IAP | PaymentGateway.GOOGLE_PLAY;
  receiptOrToken: string;
  productId: string;
  transactionId: string;
  creatorId?: string;
  planId?: string;
  reelId?: string;
  isSandbox?: boolean;
}

export interface SubscriberContentGateResult {
  hasAccess: boolean;
  isSubscriberOnly: boolean;
  reason: 'ACTIVE_SUBSCRIPTION' | 'CONTENT_CREATOR' | 'SUBSCRIBER_ONLY_LOCKED' | 'PUBLIC';
  previewAvailable: boolean;
}

export interface PaymentWebhookResult {
  processed: boolean;
  isDuplicate: boolean;
  eventType: string;
  transactionId?: string;
  eventId?: string;
  message?: string;
  error?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  userId: string;
  recipientName: string;
  taxIdNumber?: string;
  subtotalCents: number;
  taxRateBps: number;
  taxAmountCents: number;
  totalAmountCents: number;
  currency: string;
  gateway: PaymentGateway;
  gatewayInvoiceId?: string;
  status: InvoiceStatus;
  itemsBreakdown: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
  }>;
  issuedAt: string;
  paidAt?: string;
}

export interface CreatorPayoutRecord {
  id: string;
  creatorId: string;
  gateway: PaymentGateway;
  gatewayPayoutId?: string;
  amountCents: number;
  taxWithholdingCents: number;
  netPayoutCents: number;
  currency: string;
  status: PayoutStatus;
  failureReason?: string;
  initiatedAt: string;
  completedAt?: string;
}

// DTOs
export interface CreateSubscriptionPlanDto {
  title: string;
  description?: string;
  priceCents: number;
  currency?: string;
  billingInterval?: 'month' | 'year';
  perks?: string[];
}

export interface SubscribeToPlanDto {
  planId: string;
  gateway: PaymentGateway;
  paymentMethodToken?: string;
}

export interface SendTipDto {
  creatorId: string;
  reelId?: string;
  amountCents: number;
  currency?: string;
  message?: string;
  gateway: PaymentGateway;
  paymentMethodToken?: string;
}

export interface CreatePaidCommunityDto {
  interestId: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  pricingType: CommunityPricingType;
  priceCents: number;
  currency?: string;
  billingInterval?: 'month' | 'year';
}

export interface JoinPaidCommunityDto {
  communityId: string;
  gateway: PaymentGateway;
  paymentMethodToken?: string;
}

export interface CreateAdCampaignDto {
  title: string;
  reelId: string;
  targetInterestIds: string[];
  callToActionUrl?: string;
  callToActionText?: string;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  bidType?: AdBidType;
  bidCents: number;
}

export interface TrackAdEventDto {
  campaignId: string;
  eventType: AdEventType;
  interestId?: string;
  attributionToken: string;
}

export interface UpdateTaxProfileDto {
  taxIdNumber: string;
  taxEntityType: TaxEntityType;
  taxLegalName: string;
  taxJurisdictionCode: string;
  gateway?: PaymentGateway;
}

export interface RequestPayoutDto {
  amountCents?: number; // Optional, defaults to all available balance
}

export interface CalculateCreatorFundDto {
  periodName: string;
  totalPoolCents: number;
  currency?: string;
}

// ============================================================================
// Event Tracking & Analytics (Strict Zero-Location)
// ============================================================================

export enum AnalyticsEventName {
  APP_INSTALLED = 'app_installed',
  SESSION_STARTED = 'session_started',
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_INTEREST_SELECTED = 'onboarding_interest_selected',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  FEED_VIEWED = 'feed_viewed',
  FEED_REEL_IMPRESSION = 'feed_reel_impression',
  FEED_REEL_WATCHED = 'feed_reel_watched',
  FEED_REEL_COMPLETED = 'feed_reel_completed',
  FEED_REEL_SKIPPED = 'feed_reel_skipped',
  REEL_LIKED = 'reel_liked',
  REEL_COMMENTED = 'reel_commented',
  REEL_SAVED = 'reel_saved',
  REEL_SHARED = 'reel_shared',
  CREATOR_STUDIO_OPENED = 'creator_studio_opened',
  CREATOR_DRAFT_SAVED = 'creator_draft_saved',
  CREATOR_REEL_PUBLISHED = 'creator_reel_published',
  INTEREST_CHIP_TAPPED = 'interest_chip_tapped',
  INTEREST_FEEDBACK_SUBMITTED = 'interest_feedback_submitted',
  WHY_SEEING_THIS_OPENED = 'why_seeing_this_opened',
  EXPERIMENT_EXPOSURE = 'experiment_exposure',
}

export interface TrackEventDto {
  eventName: AnalyticsEventName | string;
  properties?: Record<string, any>;
  userId?: string;
  anonymousId?: string;
  timestamp?: number;
}

export interface TrackBatchEventsDto {
  events: TrackEventDto[];
}

// ----------------------------------------------------------------------------
// Funnel Analytics (Install -> Onboarding -> First Reel -> First Post)
// ----------------------------------------------------------------------------

export interface FunnelStepMetrics {
  stepIndex: number;
  stepName: string;
  eventName: AnalyticsEventName | string;
  count: number;
  conversionRateFromPrev: number; // 0.00 - 1.00 (or 100%)
  conversionRateFromStart: number; // 0.00 - 1.00
  dropoffCount: number;
  dropoffRate: number; // 0.00 - 1.00
  medianDurationSecondsToNext?: number;
}

export interface FunnelAnalysisResponse {
  funnelName: string;
  totalStarted: number;
  totalCompleted: number;
  overallConversionRate: number;
  steps: FunnelStepMetrics[];
  segments?: {
    segmentKey: string;
    segmentValue: string;
    conversionRate: number;
    count: number;
  }[];
}

// ----------------------------------------------------------------------------
// Retention Analytics (N-Day Cohorts)
// ----------------------------------------------------------------------------

export interface CohortRetentionRow {
  cohortDate: string; // YYYY-MM-DD
  cohortSize: number;
  day0Pct: number;
  day1Pct: number;
  day3Pct: number;
  day7Pct: number;
  day14Pct: number;
  day30Pct: number;
}

export interface RetentionAnalysisResponse {
  cohorts: CohortRetentionRow[];
  averageDay1: number;
  averageDay7: number;
  averageDay30: number;
  depthBreakdown: {
    interestCountTier: '1-2 Interests' | '3-5 Interests' | '6+ Interests';
    cohortSize: number;
    day1Pct: number;
    day7Pct: number;
    day30Pct: number;
  }[];
}

// ----------------------------------------------------------------------------
// Interest-Match Satisfaction Telemetry
// ----------------------------------------------------------------------------

export interface InterestSatisfactionMetric {
  interestId: string;
  interestSlug: string;
  interestTitle: string;
  categoryName: string;
  totalImpressions: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  completionRatePct: number;
  quickSkipRatePct: number;
  negativeFeedbackRatePer1k: number;
  interestSatisfactionIndex: number; // 0.0 - 100.0 score
  avgPredictedWatchTimeSec: number;
  avgActualWatchTimeSec: number;
  watchTimeCalibrationError: number; // Absolute delta (sec)
}

export interface InterestSatisfactionResponse {
  overallSatisfactionIndex: number; // 0.0 - 100.0
  totalEvaluatedImpressions: number;
  topSatisfiedInterests: InterestSatisfactionMetric[];
  bottomSatisfiedInterests: InterestSatisfactionMetric[];
  signalsBreakdown: {
    completions: number;
    loops: number;
    likes: number;
    saves: number;
    quickSkips: number;
    notInterested: number;
    showLess: number;
  };
  predictedVsActualCalibration: {
    meanAbsoluteErrorSec: number;
    correlationCoefficient: number;
  };
}

// ----------------------------------------------------------------------------
// A/B Testing & Feed Experiments
// ----------------------------------------------------------------------------

export enum ExperimentStatus {
  DRAFT = 'DRAFT',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  CONCLUDED = 'CONCLUDED',
}

export interface ExperimentVariantConfig {
  id: string; // e.g. 'control', 'variant_affinity'
  name: string;
  weight: number; // 0 - 100 allocation weight
  config: Record<string, any>;
}

export interface ExperimentDto {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variants: ExperimentVariantConfig[];
  salt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentVariantMetrics {
  variantId: string;
  variantName: string;
  isControl: boolean;
  sampleSize: number;
  trafficPercentage: number;
  meanWatchTimeSeconds: number;
  conversionRate: number; // e.g. like/save or Day 1 return
  relativeLiftPct?: number; // Lift over control
  pValue?: number;
  isStatisticallySignificant?: boolean; // p < 0.05
  confidenceInterval95?: [number, number];
}

export interface ExperimentEvaluationResult {
  experiment: ExperimentDto;
  totalParticipants: number;
  startDate: string;
  daysRunning: number;
  variants: ExperimentVariantMetrics[];
  recommendation: string;
  winnerVariantId?: string;
}

// ============================================================================
// Compliance Layer: GDPR, India DPDP Act, CCPA, COPPA, DMCA & Grievance Redressal
// ============================================================================

export enum ConsentPurpose {
  ESSENTIAL_TERMS = 'essential_terms',
  INTEREST_RECOMMENDATIONS = 'interest_recommendation_profiling',
  INTEREST_ADS = 'interest_targeted_ads',
  ANALYTICS_TELEMETRY = 'analytics_telemetry',
  PUSH_NOTIFICATIONS = 'push_notifications',
  MINOR_PARENTAL_CONSENT = 'minor_parental_consent',
}

export enum ConsentStatus {
  CONSENTED = 'CONSENTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ComplianceJurisdiction {
  GLOBAL = 'GLOBAL',
  GDPR = 'GDPR', // EU / EEA
  DPDP = 'DPDP', // India
  CCPA = 'CCPA', // California, USA
  COPPA = 'COPPA', // US Children Privacy
}

export interface UserConsentRecord {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  version: string;
  jurisdiction: ComplianceJurisdiction;
  consentedAt: string;
  withdrawnAt?: string;
}

export enum DataExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export interface DataExportRequest {
  id: string;
  userId: string;
  status: DataExportStatus;
  format: 'JSON';
  downloadUrl?: string;
  downloadToken?: string;
  expiresAt?: string;
  requestedAt: string;
  completedAt?: string;
}

export enum AccountDeletionStatus {
  PENDING_GRACE_PERIOD = 'PENDING_GRACE_PERIOD',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

export interface AccountDeletionRequest {
  id: string;
  userId: string;
  status: AccountDeletionStatus;
  reason?: string;
  gracePeriodEndsAt: string;
  requestedAt: string;
  completedAt?: string;
}

export enum DmcaStatus {
  NOTICE_RECEIVED = 'NOTICE_RECEIVED',
  CONTENT_REMOVED = 'CONTENT_REMOVED',
  COUNTER_NOTICE_RECEIVED = 'COUNTER_NOTICE_RECEIVED',
  RESTORATION_SCHEDULED = 'RESTORATION_SCHEDULED',
  RESTORED = 'RESTORED',
  RESOLVED_PERMANENT_TAKEDOWN = 'RESOLVED_PERMANENT_TAKEDOWN',
}

export interface DmcaTakedownRecord {
  id: string;
  ticketNumber: string;
  reelId: string;
  creatorId: string;
  claimantName: string;
  claimantEmail: string;
  copyrightedWorkDescription: string;
  infringingMaterialUrl: string;
  status: DmcaStatus;
  counterNoticeText?: string;
  counterNoticeAt?: string;
  restorationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export enum GrievanceCategory {
  DPDP_DATA_PROTECTION = 'DPDP_DATA_PROTECTION',
  GDPR_RIGHTS = 'GDPR_RIGHTS',
  CCPA_OPT_OUT = 'CCPA_OPT_OUT',
  COPPA_CHILD_SAFETY = 'COPPA_CHILD_SAFETY',
  HARASSMENT_DEFAMATION = 'HARASSMENT_DEFAMATION',
  CONTENT_IMPERSONATION = 'CONTENT_IMPERSONATION',
}

export enum GrievanceStatus {
  SUBMITTED = 'SUBMITTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  ESCALATED_TO_DPO = 'ESCALATED_TO_DPO',
}

export interface ComplianceGrievanceRecord {
  id: string;
  ticketNumber: string;
  userId?: string;
  complainantName: string;
  complainantEmail: string;
  category: GrievanceCategory;
  subject: string;
  description: string;
  status: GrievanceStatus;
  assignedOfficer?: string;
  resolutionSummary?: string;
  acknowledgementSlaDeadline: string; // 72 hours SLA
  resolutionSlaDeadline: string; // 15 days SLA
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface PrivacySettingsDto {
  isPrivateAccount: boolean;
  allowSearchDiscovery: boolean;
  messagingPermission: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY';
  commentingPermission: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'OFF';
  activityStatusVisible: boolean;
  personalizedAdsConsent: boolean;
  isMinor?: boolean;
}

export interface UpdatePrivacySettingsDto {
  isPrivateAccount?: boolean;
  allowSearchDiscovery?: boolean;
  messagingPermission?: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY';
  commentingPermission?: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'OFF';
  activityStatusVisible?: boolean;
  personalizedAdsConsent?: boolean;
}

export interface UserSessionItem {
  id: string;
  deviceName?: string | null;
  userAgent?: string | null;
  isCurrentSession?: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface AccountDeletionJobItem {
  id: string;
  requestId: string;
  userId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  currentStep: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeletionCascadeReport {
  reelsArchivedOrPurged: number;
  commentsDeleted: number;
  likesAndSavesRemoved: number;
  communitiesHandedOverOrDeactivated: number;
  subscriptionsCancelled: number;
  messagesAnonymized: number;
  financialRecordsAnonymized: number;
  sessionsRevoked: number;
  backupPurgeTimelineDays: number; // e.g. 90 days rolling backup purge
  shredded?: boolean;
}

// ============================================================================
// Prompt 15 — Stories & Temporary Content Types
// ============================================================================

export type StoryMediaType = 'PHOTO' | 'VIDEO';
export type StoryAudience = 'PUBLIC' | 'FOLLOWERS_ONLY' | 'CLOSE_FRIENDS';
export type StoryReplySetting = 'ALL' | 'FOLLOWERS' | 'OFF';

export interface StoryCreatorInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
}

export interface StoryItem {
  id: string;
  creatorId: string;
  creator: StoryCreatorInfo;
  mediaType: StoryMediaType;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  caption: string;
  textOverlays: TextOverlayItem[];
  audience: StoryAudience;
  allowReplies: StoryReplySetting;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  isViewed: boolean;
  viewProgressPercent: number;
  viewsCount?: number;
  reactionsCount?: number;
}

export interface CreatorStoryTrayItem {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  hasUnviewedStories: boolean;
  latestStoryAt: string;
  stories: StoryItem[];
}

export interface CreateStoryDto {
  mediaType: StoryMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  caption?: string;
  textOverlays?: TextOverlayItem[];
  audience?: StoryAudience;
  allowReplies?: StoryReplySetting;
}

export interface RecordStoryViewDto {
  progressPercent?: number;
  completed?: boolean;
}

export interface ReactToStoryDto {
  reaction: string; // e.g. '❤️', '🔥', '😂', '👏', '😮', '😢'
}

export interface ReplyToStoryDto {
  text: string;
}

export interface ReportStoryDto {
  reason: 'SPAM' | 'HARASSMENT' | 'HATE_SPEECH' | 'INAPPROPRIATE' | 'COPYRIGHT' | 'OTHER';
  details?: string;
}

// ============================================================================
// Prompt 16 — Communities & Collaborative Content Types
// ============================================================================

export type CommunityVisibility = 'PUBLIC' | 'RESTRICTED' | 'PRIVATE';
export type CommunityMemberRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type CommunityMemberStatus = 'ACTIVE' | 'PENDING_REQUEST' | 'INVITED' | 'BANNED' | 'MUTED';
export type CommunityPostType = 'DISCUSSION' | 'SHARED_REEL' | 'COLLABORATIVE' | 'ANNOUNCEMENT';
export type PostCollaborationStatus = 'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CommunityGuideline {
  id: string;
  title: string;
  description: string;
}

export interface CommunityItem {
  id: string;
  creatorId: string;
  interestId?: string | null;
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  visibility: CommunityVisibility;
  guidelines: CommunityGuideline[];
  membersCount: number;
  postsCount: number;
  isActive: boolean;
  userRole?: CommunityMemberRole | null;
  userStatus?: CommunityMemberStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMemberUserInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
}

export interface CommunityMemberItem {
  id: string;
  communityId: string;
  userId: string;
  user: CommunityMemberUserInfo;
  role: CommunityMemberRole;
  status: CommunityMemberStatus;
  invitedBy?: string | null;
  banReason?: string | null;
  mutedUntil?: string | null;
  joinedAt?: string | null;
  createdAt: string;
}

export interface CommunityCollaboratorItem {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  respondedAt?: string | null;
}

export interface CommunityPostItem {
  id: string;
  communityId: string;
  authorId: string;
  author: CommunityMemberUserInfo;
  postType: CommunityPostType;
  title: string;
  body: string;
  mediaUrls: string[];
  reelId?: string | null;
  isPinned: boolean;
  pinnedAt?: string | null;
  isAnnouncement: boolean;
  collaborationStatus: PostCollaborationStatus;
  collaborators: CommunityCollaboratorItem[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCollectionItem {
  id: string;
  communityId: string;
  creatorId: string;
  title: string;
  description: string;
  isCurated: boolean;
  itemsCount: number;
  createdAt: string;
}

export interface CommunityReportItem {
  id: string;
  communityId: string;
  reporterId: string;
  targetType: 'POST' | 'MEMBER' | 'COMMUNITY';
  targetId: string;
  reason: string;
  details?: string | null;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  actionTaken?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CommunityAppealItem {
  id: string;
  communityId: string;
  appellantId: string;
  appellant: CommunityMemberUserInfo;
  banOrActionId?: string | null;
  appealReason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CreateCommunityDto {
  name: string;
  slug?: string;
  description?: string;
  interestId?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  visibility?: CommunityVisibility;
  guidelines?: CommunityGuideline[];
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  visibility?: CommunityVisibility;
  guidelines?: CommunityGuideline[];
}

export interface InviteCommunityMemberDto {
  userId: string;
}

export interface UpdateCommunityMemberRoleDto {
  role: CommunityMemberRole;
}

export interface ModerateCommunityMemberDto {
  action: 'BAN' | 'MUTE' | 'UNBAN' | 'UNMUTE';
  reason?: string;
  muteDurationHours?: number;
}

export interface HandoverCommunityOwnershipDto {
  newOwnerId: string;
}

export interface CreateCommunityPostDto {
  postType?: CommunityPostType;
  title: string;
  body: string;
  mediaUrls?: string[];
  reelId?: string;
  isPinned?: boolean;
  isAnnouncement?: boolean;
  collaboratorIds?: string[];
}

export interface ReportCommunityTargetDto {
  targetType: 'POST' | 'MEMBER' | 'COMMUNITY';
  targetId: string;
  reason: string;
  details?: string;
}

export interface ReviewCommunityReportDto {
  status: 'RESOLVED' | 'DISMISSED';
  actionTaken?: 'REMOVE_POST' | 'BAN_MEMBER' | 'MUTE_MEMBER' | 'NO_ACTION';
}

export interface SubmitCommunityAppealDto {
  appealReason: string;
  banOrActionId?: string;
}

export interface ReviewCommunityAppealDto {
  status: 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
}

export interface CreateCommunityCollectionDto {
  title: string;
  description?: string;
  isCurated?: boolean;
}

export interface AddReelToCommunityCollectionDto {
  reelId: string;
}

// ============================================================================
// Prompt 17 — Creator Analytics & Scheduling Types
// ============================================================================

export type DiscoverySource =
  | 'FOR_YOU'
  | 'FOLLOWING'
  | 'SEARCH'
  | 'TOPIC_PAGE'
  | 'COMMUNITY'
  | 'DIRECT_LINK';

export interface ViewCountingRules {
  minWatchSecondsForView: number; // e.g. 1.5s
  completionRatioThreshold: number; // e.g. 0.90
  deduplicationWindowMinutes: number; // e.g. 30m
  rapidSkipDurationLimitSeconds: number; // e.g. 1.5s
  botFilteringEnabled: boolean;
}

export interface AnalyticsTimeframe {
  startDate: string;
  endDate: string;
  timezone: string;
  processingDelayMinutes: number;
  lastAggregatedAt: string;
}

export interface CreatorEarningsReconciliation {
  grossRevenueCents: number;
  platformFeeCents: number;
  netEarningsCents: number;
  tipsCount: number;
  activeSubscriptionsCount: number;
  currency: string;
  isFinancialAuthoritative: boolean;
}

export interface DiscoverySourceBreakdown {
  source: DiscoverySource;
  count: number;
  percentage: number;
}

export interface TopicPerformanceItem {
  topicId: string;
  topicTitle: string;
  reelsCount: number;
  viewsCount: number;
  watchTimeSeconds: number;
  avgWatchRatio: number;
  engagementRate: number;
}

export interface VerifiedCreatorAnalytics {
  timeframe: AnalyticsTimeframe;
  countingRules: ViewCountingRules;
  totalViews: number;
  totalWatchHours: number;
  avgWatchRatio: number;
  completionRate: number; // percentage (0-100)
  engagementRate: number; // percentage (0-100)
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalShares: number;
  totalFollowers: number;
  followerGrowthPercent: number;
  followerGrowth: FollowerGrowthPoint[];
  retentionCurve: RetentionPoint[];
  discoverySources: DiscoverySourceBreakdown[];
  topicPerformance: TopicPerformanceItem[];
  earnings: CreatorEarningsReconciliation;
  topReels: CreatorTopReel[];
  scheduledCount: number;
  hasSufficientData: boolean;
  zeroLocationGuarantee: string;
}

export interface IngestTelemetryEventDto {
  clientEventId?: string;
  reelId: string;
  durationMs: number;
  watchedMs: number;
  loopCount?: number;
  action: EngagementAction;
  discoverySource?: DiscoverySource;
  sessionHash?: string;
  timestamp?: number;
}

// ============================================================================
// Prompt 25 — Learn Mode Types
// ============================================================================

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type LearnContentType = 'VIDEO' | 'ARTICLE' | 'QUIZ' | 'PROJECT_BRIEF';

export type CredentialClassification =
  | 'VERIFIED_CREDENTIAL'
  | 'ACCREDITED_CERTIFICATION'
  | 'INFORMAL_CREATOR_TIP'
  | 'COMMUNITY_WORKSHOP';

export type DifficultyVoteType = 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD';

export interface LessonItem {
  id: string;
  pathId: string;
  orderIndex: number;
  title: string;
  description: string;
  contentType: LearnContentType;
  contentUrl?: string;
  reelId?: string;
  durationSeconds: number;
  prerequisiteLessonIds: string[];
  isDeleted?: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DifficultyStats {
  tooEasyVotes: number;
  justRightVotes: number;
  tooHardVotes: number;
  averageRating: number; // 1.0 - 5.0
  totalFeedbackCount: number;
}

export interface SkillPath {
  id: string;
  title: string;
  slug: string;
  description: string;
  interestId: string;
  interestName: string;
  level: SkillLevel;
  classification: CredentialClassification;
  isVerifiedCredential: boolean; // Institutional / accredited vs informal creator content
  issuingOrganization?: string; // e.g. "Interest Design Institute", "Verified Systems Guild"
  verificationBadgeUrl?: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  isCreatorCurated: boolean;
  prerequisitePathIds: string[];
  estimatedDurationMinutes: number;
  lessonCount: number;
  lessons: LessonItem[];
  difficultyStats: DifficultyStats;
  rating: number; // 0.0 - 5.0
  ratingsCount: number;
  enrolledCount: number;
  completedCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPathProgress {
  userId: string;
  pathId: string;
  currentLessonId: string;
  completedLessonIds: string[];
  percentComplete: number;
  isCompleted: boolean;
  completedAt?: string;
  lastAccessedAt: string;
  timeSpentSeconds: number;
  missingOrDeletedLessonsHandled: boolean;
}

export interface UserLearnReminder {
  userId: string;
  enabled: boolean;
  reminderTime: string; // "HH:MM" e.g. "18:30"
  daysOfWeek: number[]; // 1-7 (Mon-Sun)
  channel: 'IN_APP' | 'PUSH';
  targetSkillPathId?: string;
  targetSkillPathTitle?: string;
  updatedAt: string;
}

export interface DifficultyFeedbackRecord {
  id: string;
  userId: string;
  pathId: string;
  lessonId?: string;
  feedback: DifficultyVoteType;
  ratingScore: number; // 1-5
  comments?: string;
  createdAt: string;
}

// ============================================================================
// Prompt 26 — AI Interest Assistant Types
// ============================================================================

export type AiGroundedSourceType =
  | 'REEL'
  | 'INTEREST'
  | 'COMMUNITY'
  | 'LEARN_PATH'
  | 'CREATOR'
  | 'PLAYLIST';

export interface AiGroundedSource {
  id: string;
  title: string;
  type: AiGroundedSourceType;
  deepLinkUrl: string;
  snippet: string;
  isPublic: boolean;
  authorName?: string;
}

export interface AiRelatedInterest {
  id: string;
  slug: string;
  title: string;
  vectorSimilarity: number;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostMicrocents: number;
}

export interface AiAssistantMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  summary?: string;
  groundedSources: AiGroundedSource[];
  relatedInterests: AiRelatedInterest[];
  suggestedActions: string[];
  isFallbackToSearch: boolean;
  tokenUsage: AiTokenUsage;
  latencyMs: number;
  timestamp: string;
}

export interface AiRateLimitAndCostStatus {
  userId: string;
  queriesRemainingThisHour: number;
  dailyTokenUsage: number;
  dailyTokenLimit: number;
  isBudgetExceeded: boolean;
  isBetaEnrolled: boolean;
}

export interface AiQualityFeedbackDto {
  messageId: string;
  isHelpful: boolean;
  feedbackCategory?:
    | 'ACCURATE'
    | 'HALLUCINATION'
    | 'IRRELEVANT'
    | 'OFFENSIVE'
    | 'OTHER';
  comments?: string;
}

// ============================================================================
// Prompt 27 — Live Video and Events Types
// ============================================================================

export type LiveStreamStatus =
  | 'SCHEDULED'
  | 'STARTING'
  | 'LIVE'
  | 'PAUSED'
  | 'ENDED'
  | 'TERMINATED_MODERATION';

export type StreamHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'RECONNECTING';

export type CoHostStatus =
  | 'NONE'
  | 'INVITED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'DISCONNECTED';

export type LiveReactionType =
  | 'HEART'
  | 'FIRE'
  | 'CELEBRATE'
  | 'MINDBLOWN'
  | 'CLAP';

export interface StreamHealthMetrics {
  status: StreamHealthStatus;
  bitrateKbps: number;
  fps: number;
  droppedFramePercent: number;
  jitterMs: number;
  lastHeartbeatAt: string;
}

export interface LiveCoHostItem {
  userId: string;
  username: string;
  avatarUrl?: string;
  status: CoHostStatus;
  joinedAt?: string;
}

export interface LiveEventItem {
  id: string;
  hostId: string;
  hostUsername: string;
  hostAvatarUrl?: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  interestId: string;
  interestName: string;
  scheduledStartTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: LiveStreamStatus;
  is18Plus: boolean;
  recordSession: boolean;
  recordingUrl?: string;
  recordingRetentionDays: number;
  streamKeyHash: string;
  playbackUrl: string;
  viewerCount: number;
  peakViewers: number;
  coHost?: LiveCoHostItem;
  health: StreamHealthMetrics;
  remindersCount: number;
  isReminderSet?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiveQuestionItem {
  id: string;
  eventId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  question: string;
  isApproved: boolean;
  isAnswered: boolean;
  isPinned: boolean;
  upvotesCount: number;
  hasUpvoted?: boolean;
  createdAt: string;
}

export interface LiveReactionBatch {
  eventId: string;
  reaction: LiveReactionType;
  count: number;
}

// ============================================================================
// PROMPT 28 — CREATOR MARKETPLACE TYPES
// ============================================================================

export type CampaignStatus =
  | 'DRAFT'
  | 'OPEN_FOR_APPLICATIONS'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type ApplicationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type ContractStatus =
  | 'DRAFTED'
  | 'ACTIVE'
  | 'SUBMITTED'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'DISPUTED'
  | 'FULFILLED';

export type DeliverableStatus =
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED'
  | 'CHANGES_REQUESTED'
  | 'APPROVED';

export type DisputeStatus =
  | 'OPENED'
  | 'UNDER_REVIEW'
  | 'RESOLVED_CREATOR'
  | 'RESOLVED_BRAND'
  | 'MUTUALLY_CANCELLED';

export interface MarketplaceEligibility {
  isEligible: boolean;
  followersCount: number;
  requiredFollowers: number;
  accountAgeDays: number;
  activeStrikesCount: number;
  hasVerifiedIdentity: boolean;
  hasStripeConnectAccount: boolean;
  ineligibilityReasons: string[];
}

export interface CreatorPortfolioItem {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  interestCategories: string[];
  featuredReelIds: string[];
  baseRateCents: number;
  averageEngagementRate: number;
  verifiedPastCampaignsCount: number;
}

export interface BrandCampaignItem {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string;
  title: string;
  description: string;
  interestId: string;
  interestName: string;
  budgetMinCents: number;
  budgetMaxCents: number;
  requiredDeliverables: string[];
  applicationDeadline: string;
  campaignDeadline: string;
  status: CampaignStatus;
  applicationsCount: number;
  sponsorshipDisclosureRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignApplicationItem {
  id: string;
  campaignId: string;
  creatorId: string;
  creatorUsername: string;
  creatorAvatarUrl?: string;
  proposedRateCents: number;
  pitchNote: string;
  portfolioSampleLinks: string[];
  status: ApplicationStatus;
  createdAt: string;
}

export interface CampaignDeliverableItem {
  id: string;
  contractId: string;
  title: string;
  description: string;
  reelId?: string;
  previewUrl?: string;
  hasSponsorshipDisclosure: boolean;
  feedbackNotes?: string;
  status: DeliverableStatus;
  submittedAt?: string;
  approvedAt?: string;
}

export interface DisputeRecordItem {
  id: string;
  contractId: string;
  initiatorId: string;
  reason: string;
  evidenceDescription: string;
  status: DisputeStatus;
  moderatorNotes?: string;
  resolvedAt?: string;
}

export interface PaymentReconciliationItem {
  id: string;
  contractId: string;
  paymentProvider: 'STRIPE_DIRECT_INVOICE' | 'EXTERNAL_DIRECT_TRANSFER';
  externalInvoiceId?: string;
  amountCents: number;
  currency: string;
  isPlatformCustodyAvoided: boolean; // Strict invariant: true
  reconciledAt: string;
}

export interface CampaignContractItem {
  id: string;
  campaignId: string;
  applicationId: string;
  brandId: string;
  brandName: string;
  creatorId: string;
  creatorUsername: string;
  agreedAmountCents: number;
  deliverableBrief: string;
  sponsorshipDisclosureText: string;
  status: ContractStatus;
  deliverables: CampaignDeliverableItem[];
  reconciliation?: PaymentReconciliationItem;
  dispute?: DisputeRecordItem;
  signedAt: string;
  completedAt?: string;
}

export interface MarketplaceDemandMetrics {
  totalBrandCampaignsCount: number;
  totalCreatorApplicationsCount: number;
  activeContractVolumeCents: number;
  topInterestsByDemand: Array<{ interestId: string; interestName: string; campaignCount: number }>;
  isMarketplaceEnabled: boolean;
}
