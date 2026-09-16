export type UserRole = 'MEMBER' | 'MODERATOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER';
export type RelationshipIntention = 'LONG_TERM' | 'CASUAL' | 'DATING' | 'FRIENDS' | 'MARRIAGE' | 'NOT_SURE';

export interface User {
  id: string;
  email: string;
  display_name: string;
  date_of_birth: string;
  age: number;
  gender: Gender;
  location: string;
  bio?: string;
  avatar_url?: string;
  interests?: string;
  relationship_intention?: RelationshipIntention;
  about_me?: string;
  role: UserRole;
  status: UserStatus;
  email_verified?: number;
  is_online?: number;
  is_banned?: number;
  last_active_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreditWallet {
  user_id: string;
  balance: number;
  complimentary_balance: number;
  purchased_balance: number;
  updated_at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus_credits?: number;
  price_cents: number;
  price_usd?: number;
  is_popular?: boolean;
  is_active?: number;
  created_at?: string;
}

export type TransactionType =
  | 'WELCOME_BONUS'
  | 'PURCHASE'
  | 'CHAT_USAGE'
  | 'MAIL_SENT'
  | 'MAIL_OPENED'
  | 'STICKER_SENT'
  | 'GIFT_SENT'
  | 'VIDEO_OPENED'
  | 'POST_UNLOCKED'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND'
  | 'DAILY_LOGIN_BONUS';

export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type?: string;
  type?: TransactionType;
  amount: number;
  balance_before?: number;
  balance_after: number;
  reference_id?: string;
  description: string;
  created_at: string;
}

export interface Gift {
  id: string;
  name: string;
  icon_name: string;
  credit_price: number;
  is_active?: number;
  created_at?: string;
}

export interface GiftReceived {
  id: string;
  gift_id: string;
  sender_id: string;
  receiver_id: string;
  message?: string;
  created_at: string;
  gift: Gift;
  sender: User;
}

export interface BlockRecord {
  id: string;
  blocker_id: string;
  blocked_user_id: string;
  reason?: string;
  created_at: string;
  blocked_user?: User;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  partner: User;
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  is_read?: number;
  created_at: string;
}

export interface MailThread {
  id: string;
  user_id_1: string;
  user_id_2: string;
  user1_id?: string;
  user2_id?: string;
  subject: string;
  message_count?: number;
  photo_count?: number;
  last_message_at: string;
  created_at: string;
  partner: User;
  unread_count: number;
}

export interface MailAttachment {
  id: string;
  mail_id: string;
  url: string;
  media_type: string;
  created_at: string;
}

export interface MailMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  content?: string;
  credit_cost: number;
  attachments?: MailAttachment[];
  created_at: string;
  sender?: User;
  recipient?: User;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  is_exclusive: number | boolean;
  credit_price: number;
  created_at: string;
  updated_at?: string;
  user: User;
  likes_count: number;
  comments_count: number;
  user_liked?: boolean;
  is_unlocked?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  created_at: string;
  user: User;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  content?: string;
  reference_id?: string;
  is_read: boolean | number;
  created_at: string;
}

export type NotificationItem = AppNotification;

export interface ModerationReport {
  id: string;
  reporter_id: string;
  target_user_id: string;
  target_type: string;
  target_id?: string;
  reason: string;
  details?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  reporter?: User;
  target_user?: User;
}

export interface DashboardMetrics {
  totalUsers: number;
  onlineUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  totalCreditsCirculating: number;
  totalRevenueUsd: number;
  pendingReports: number;
}
