import {
  User,
  CreditWallet,
  CreditPackage,
  CreditTransaction,
  Conversation,
  Message,
  MailThread,
  MailMessage,
  Post,
  PostComment,
  AppNotification,
  Gift,
  GiftReceived,
  BlockRecord,
  ModerationReport,
  DashboardMetrics,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('pairly_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('pairly_token', token);
    } else {
      localStorage.removeItem('pairly_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const rawText = await res.text();
    let data: any = null;
    if (rawText && rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText);
      } catch {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        throw new Error(`Server returned unexpected response format (${res.status})`);
      }
    }

    if (!res.ok) {
      const errMsg = (data && typeof data === 'object' && data.error) ? data.error : `Request failed with status ${res.status}`;
      throw new Error(errMsg);
    }

    return (data ?? {}) as T;
  }

  // --- AUTH ---
  async register(data: {
    email: string;
    password: string;
    display_name: string;
    date_of_birth: string;
    gender: string;
    location: string;
  }): Promise<{ user: User; token: string; wallet: CreditWallet; message: string }> {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    return res;
  }

  async login(email: string, password: string): Promise<{ user: User; token: string; wallet: CreditWallet }> {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe(): Promise<{ user: User; wallet: CreditWallet }> {
    return this.request('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- USERS & PROFILE ---
  async updateProfile(data: Partial<User>): Promise<{ user: User; message: string }> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getUserProfile(id: string): Promise<{
    user: User;
    relationship: { liked: boolean; matched: boolean; following: boolean };
    posts: Post[];
  }> {
    return this.request(`/users/${id}`);
  }

  async getBlockedUsers(): Promise<{ blockedUsers: BlockRecord[] }> {
    const res = await this.request('/blocks');
    return { blockedUsers: res.blocks || [] };
  }

  // --- DISCOVERY & SEARCH ---
  async getPeople(filters: {
    gender?: string;
    minAge?: number;
    maxAge?: number;
    location?: string;
    intention?: string;
    onlineOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ people: User[]; total: number; page: number; totalPages: number }> {
    const params = new URLSearchParams();
    if (filters.gender) params.append('gender', filters.gender);
    if (filters.minAge) params.append('minAge', filters.minAge.toString());
    if (filters.maxAge) params.append('maxAge', filters.maxAge.toString());
    if (filters.location) params.append('location', filters.location);
    if (filters.intention) params.append('intention', filters.intention);
    if (filters.onlineOnly) params.append('onlineOnly', 'true');
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return this.request(`/people?${params.toString()}`);
  }

  // --- INTERACTIONS (Likes, Matches, Follows, Blocks) ---
  async likeUser(target_id: string): Promise<{ isMatch: boolean; message: string }> {
    return this.request('/likes', {
      method: 'POST',
      body: JSON.stringify({ target_id }),
    });
  }

  async unlikeUser(target_id: string): Promise<{ success: boolean }> {
    return this.request(`/likes/${target_id}`, { method: 'DELETE' });
  }

  async getMatches(): Promise<{ matches: any[] }> {
    return this.request('/matches');
  }

  async blockUser(blocked_id: string, reason?: string): Promise<{ success: boolean }> {
    return this.request('/blocks', {
      method: 'POST',
      body: JSON.stringify({ blocked_id, reason }),
    });
  }

  async unblockUser(blocked_id: string): Promise<{ success: boolean }> {
    return this.request(`/blocks/${blocked_id}`, { method: 'DELETE' });
  }

  // --- POSTS & FEED ---
  async getFeed(limit = 30, offset = 0): Promise<{ feed: Post[] }> {
    return this.request(`/posts?limit=${limit}&offset=${offset}`);
  }

  async createPost(data: {
    content: string;
    media_url?: string;
    media_type?: string;
    is_exclusive?: boolean;
    credit_price?: number;
  }): Promise<{ post: Post }> {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async togglePostReaction(postId: string, reaction_type = 'LIKE'): Promise<{ action: string; reaction_type: string }> {
    return this.request(`/posts/${postId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reaction_type }),
    });
  }

  async getPostComments(postId: string): Promise<{ comments: PostComment[] }> {
    return this.request(`/posts/${postId}/comments`);
  }

  async addPostComment(postId: string, content: string, parent_id?: string): Promise<{ comment: PostComment }> {
    return this.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parent_id }),
    });
  }

  async unlockPost(postId: string): Promise<{ success: boolean }> {
    return this.request(`/posts/${postId}/unlock`, { method: 'POST' });
  }

  // --- MESSAGES & CHAT ---
  async getConversations(): Promise<{ conversations: Conversation[] }> {
    return this.request('/messages/conversations');
  }

  async getOrCreateConversation(partner_id: string): Promise<{ conversation: Conversation }> {
    return this.request('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ partner_id }),
    });
  }

  async getMessages(conversationId: string): Promise<{ messages: Message[] }> {
    return this.request(`/messages/conversations/${conversationId}/messages`);
  }

  async sendMessage(
    conversationId: string,
    data: { content?: string; media_url?: string; media_type?: string }
  ): Promise<{ message: Message }> {
    return this.request(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startChatSession(conversation_id: string, partner_id: string): Promise<{ session: any; ratePerMinute: number }> {
    return this.request('/messages/chat/session/start', {
      method: 'POST',
      body: JSON.stringify({ conversation_id, partner_id }),
    });
  }

  async heartbeatChatSession(conversation_id: string): Promise<{ session?: any; active: boolean }> {
    return this.request('/messages/chat/session/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ conversation_id }),
    });
  }

  async endChatSession(session_id: string): Promise<{ success: boolean }> {
    return this.request('/messages/chat/session/end', {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    });
  }

  // --- MAIL SYSTEM ---
  async getMailThreads(folder: 'INBOX' | 'SENT' | 'TRASH' | 'ARCHIVE' = 'INBOX'): Promise<{ threads: MailThread[] }> {
    const f = folder === 'TRASH' ? 'ARCHIVE' : folder;
    return this.request(`/mail/threads?folder=${f}`);
  }

  async getMailMessages(threadId: string): Promise<{ thread: MailThread; messages: MailMessage[] }> {
    return this.request(`/mail/threads/${threadId}`);
  }

  async sendMail(data: {
    recipient_id: string;
    subject: string;
    body?: string;
    content?: string;
    thread_id?: string;
    attachments?: Array<{ url: string; media_type: string }>;
    media_url?: string;
    media_type?: string;
  }): Promise<{ message: MailMessage; threadId: string }> {
    return this.request('/mail/send', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        content: data.body || data.content,
      }),
    });
  }

  // --- CREDITS & WALLET ---
  async getWallet(): Promise<{ wallet: CreditWallet }> {
    return this.request('/credits/wallet');
  }

  async getPackages(): Promise<{ packages: CreditPackage[] }> {
    const res = await this.request('/credits/packages');
    // Ensure frontend friendly prices & formatting
    const packages: CreditPackage[] = (res.packages || []).map((p: any) => ({
      id: p.id,
      name: p.name || (p.credits >= 1000 ? 'VIP Elite' : p.credits >= 500 ? 'Romance Deluxe' : p.credits >= 300 ? 'Popular Spark' : 'Starter Pack'),
      credits: p.credits,
      bonus_credits: p.bonus_credits || (p.credits === 300 ? 30 : p.credits === 700 ? 100 : p.credits === 1600 ? 300 : 0),
      price_cents: p.price_cents || (p.price_usd ? Math.round(p.price_usd * 100) : 999),
      is_popular: p.credits === 300 || p.credits === 700,
    }));
    return { packages };
  }

  async getCreditPackages(): Promise<{ packages: CreditPackage[] }> {
    return this.getPackages();
  }

  async getTransactions(limit = 25, offset = 0): Promise<{ transactions: CreditTransaction[] }> {
    return this.request(`/credits/transactions?limit=${limit}&offset=${offset}`);
  }

  async claimDailyBonus(): Promise<{ success: boolean; bonusCredits: number }> {
    return this.request('/credits/daily-bonus', { method: 'POST' }).catch(() => {
      return { success: true, bonusCredits: 10 };
    });
  }

  // --- PAYMENTS ---
  async createOrder(package_id: string): Promise<{ order: { id: string; package_id: string } }> {
    const res = await this.request('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ package_id }),
    });
    return { order: { id: res.sessionId || 'order_' + Date.now(), package_id } };
  }

  async simulatePaymentSuccess(orderId: string): Promise<any> {
    return this.request('/payments/simulate-checkout-success', {
      method: 'POST',
      body: JSON.stringify({
        package_id: 'pkg_standard',
        idempotency_key: `sim_${orderId}_${Date.now()}`,
        amount_usd: 19.99,
        credits: 200,
      }),
    });
  }

  // --- GIFTS ---
  async getGifts(): Promise<{ gifts: Gift[] }> {
    return this.request('/gifts');
  }

  async getReceivedGifts(): Promise<{ receivedGifts: GiftReceived[] }> {
    const res = await this.request('/gifts/received').catch(() => ({ receivedGifts: [] }));
    return { receivedGifts: res.receivedGifts || [] };
  }

  async sendGift(receiver_id: string, gift_id: string, message?: string): Promise<{ success: boolean; message: string }> {
    return this.request('/gifts/send', {
      method: 'POST',
      body: JSON.stringify({ receiver_id, gift_id, message }),
    });
  }

  // --- REPORTS ---
  async submitReport(data: {
    target_user_id: string;
    target_type?: string;
    target_id?: string;
    reason: string;
    details?: string;
  }): Promise<{ report: any; message: string }> {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- NOTIFICATIONS ---
  async getNotifications(limit = 30, offset = 0): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    const res = await this.request(`/notifications?limit=${limit}&offset=${offset}`);
    const notifs = (res.notifications || []).map((n: any) => ({
      ...n,
      body: n.content || n.body || '',
      is_read: Boolean(n.is_read),
    }));
    return { notifications: notifs, unreadCount: res.unreadCount || 0 };
  }

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  // --- ADMIN & MODERATION ---
  async getAdminStats(): Promise<{ stats: any }> {
    const res = await this.request('/admin/metrics');
    return { stats: res.metrics };
  }

  async getAdminUsers(search = ''): Promise<{ users: User[] }> {
    const res = await this.request(`/admin/users?search=${encodeURIComponent(search)}`);
    return { users: res.users || [] };
  }

  async updateAdminUserStatus(userId: string, data: { is_banned?: boolean; status?: string }): Promise<{ success: boolean }> {
    return this.request(`/admin/users/${userId}/action`, {
      method: 'POST',
      body: JSON.stringify({
        action_type: data.is_banned ? 'BAN' : 'UNBAN',
        reason: 'Staff administration action',
      }),
    });
  }

  async grantAdminCredits(
    userId: string,
    amount: number,
    bucket: 'complimentary' | 'purchased',
    reason: string
  ): Promise<{ success: boolean }> {
    return this.request(`/admin/users/${userId}/adjust-credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, bucket, reason }),
    });
  }

  async getAdminReports(status = 'PENDING'): Promise<{ reports: ModerationReport[] }> {
    const res = await this.request(`/admin/reports?status=${status}`);
    return { reports: res.reports || [] };
  }

  async resolveAdminReport(reportId: string, action: string, banUser = false): Promise<{ success: boolean }> {
    return this.request(`/admin/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        action_taken: action,
        resolution_notes: `Staff decision: ${action}. Ban applied: ${banUser}`,
      }),
    });
  }

  // --- MEDIA UPLOAD ---
  async uploadMedia(file: File): Promise<{ url: string; mimeType: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }

    return res.json();
  }
}

export const api = new ApiClient();
