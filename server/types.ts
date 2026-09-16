export type UserRole = 'MEMBER' | 'MODERATOR' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'EMAIL_UNVERIFIED' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED';

export type Gender = 'FEMALE' | 'MALE' | 'NON_BINARY' | 'OTHER';

export type RelationshipIntention = 'LONG_TERM' | 'DATING' | 'CASUAL' | 'FRIENDSHIP' | 'MARRIAGE';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  date_of_birth: string; // YYYY-MM-DD
  age: number;
  gender: Gender;
  location: string;
  role: UserRole;
  status: AccountStatus;
  email_verified: boolean;
  verification_token?: string | null;
  reset_token?: string | null;
  reset_token_expires?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  interests?: string | null; // JSON string array
  relationship_intention?: RelationshipIntention | null;
  about_me?: string | null;
  profile_video_url?: string | null;
  is_online?: boolean;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreditWallet {
  user_id: string;
  balance: number;
  complimentary_balance: number;
  purchased_balance: number;
  updated_at: string;
}

export type TransactionType =
  | 'WELCOME_BONUS'
  | 'CREDIT_PURCHASE'
  | 'CHAT_USAGE'
  | 'STICKER_SENT'
  | 'PHOTO_SENT'
  | 'VIDEO_OPENED'
  | 'MAIL_SENT'
  | 'MAIL_OPENED'
  | 'GIFT_SENT'
  | 'REFUND'
  | 'ADMIN_ADJUSTMENT'
  | 'PROMOTIONAL_CREDIT';

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number; // positive for credit, negative for debit
  balance_before: number;
  balance_after: number;
  reference_id?: string | null;
  description: string;
  created_at: string;
}

export interface CreditPackage {
  id: string;
  credits: number;
  price_usd: number;
  is_active: boolean;
  created_at: string;
}

export interface Gift {
  id: string;
  name: string;
  icon_name: string; // Lucide icon or emoji
  credit_price: number;
  is_active: boolean;
  created_at: string;
}

export interface GiftTransaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  gift_name: string;
  credit_price: number;
  message?: string | null;
  created_at: string;
}

export interface Like {
  id: string;
  sender_id: string;
  target_id: string;
  created_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason?: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  media_type?: 'IMAGE' | 'VIDEO' | null;
  is_exclusive?: boolean;
  credit_price?: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
}

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string; // 'LIKE' | 'LOVE' | 'FIRE' | 'LAUGH'
  created_at: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url?: string | null;
  media_type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'STICKER' | 'GIFT' | null;
  is_paid?: boolean;
  credit_cost?: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  conversation_id: string;
  user_id: string;
  partner_id: string;
  started_at: string;
  last_billed_at: string;
  total_minutes_billed: number;
  total_credits_billed: number;
  is_active: boolean;
  ended_at?: string | null;
}

export interface MailThread {
  id: string;
  user1_id: string;
  user2_id: string;
  subject: string;
  message_count: number;
  photo_count: number;
  last_message_at: string;
  created_at: string;
}

export interface MailMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  content: string;
  media_url?: string | null;
  media_type?: 'IMAGE' | 'VIDEO' | null;
  is_opened: boolean;
  opened_at?: string | null;
  credit_cost_sent: number;
  credit_cost_opened: number;
  is_archived_sender: boolean;
  is_archived_recipient: boolean;
  created_at: string;
}

export type NotificationType =
  | 'NEW_MATCH'
  | 'NEW_MESSAGE'
  | 'NEW_MAIL'
  | 'COMMENT'
  | 'REACTION'
  | 'LIKE'
  | 'GIFT'
  | 'FOLLOW'
  | 'PROFILE_INTERACTION'
  | 'CREDIT_PURCHASE'
  | 'LOW_CREDIT_BALANCE'
  | 'SYSTEM_NOTIFICATION';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  content: string;
  reference_id?: string | null;
  reference_type?: string | null;
  is_read: boolean;
  created_at: string;
}

export type ReportStatus = 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  id: string;
  reporter_id: string;
  target_user_id: string;
  target_type: 'PROFILE' | 'POST' | 'MESSAGE' | 'MAIL' | 'OTHER';
  target_id?: string | null;
  reason: string;
  details?: string | null;
  status: ReportStatus;
  resolution_notes?: string | null;
  moderator_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModerationAction {
  id: string;
  moderator_id: string;
  target_user_id: string;
  action_type: 'WARN' | 'SUSPEND' | 'BAN' | 'RESTORE' | 'DELETE_CONTENT';
  reason: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  details: string; // JSON string
  ip_address?: string | null;
  created_at: string;
}

export interface PaymentTransaction {
  id: string;
  user_id: string;
  package_id: string;
  provider: string; // 'STRIPE' | 'PAYPAL' | 'TEST_GATEWAY'
  external_transaction_id: string;
  amount_usd: number;
  credits_awarded: number;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  idempotency_key: string;
  created_at: string;
}
