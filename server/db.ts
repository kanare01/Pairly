import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pairly.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enforce foreign key constraints
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Run migrations
  await runMigrations(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized. Call getDb() first.');
  const stmt = dbInstance.prepare(sql);
  try {
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: any[] = []): { changes: number } {
  if (!dbInstance) throw new Error('Database not initialized. Call getDb() first.');
  dbInstance.run(sql, params);
  if (transactionDepth === 0) {
    saveDb();
  }
  return { changes: 1 };
}

let transactionDepth = 0;

export function transaction<T>(callback: () => T): T {
  if (!dbInstance) throw new Error('Database not initialized.');
  
  // If already in a transaction, run callback within existing transaction
  if (transactionDepth > 0) {
    return callback();
  }

  transactionDepth++;
  dbInstance.run('BEGIN TRANSACTION');
  try {
    const result = callback();
    dbInstance.run('COMMIT');
    saveDb();
    return result;
  } catch (err) {
    try {
      dbInstance.run('ROLLBACK');
    } catch {
      // Ignore if transaction already aborted
    }
    throw err;
  } finally {
    transactionDepth = 0;
  }
}

async function runMigrations(db: Database): Promise<void> {
  // Ensure schema_migrations table
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = query<{ version: number }>('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  // Migration 1: Full MVP Schema
  if (!appliedVersions.has(1)) {
    console.log('Running Migration 001_initial_schema...');
    db.run(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        age INTEGER NOT NULL CHECK (age >= 18),
        gender TEXT NOT NULL,
        location TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        email_verified INTEGER NOT NULL DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expires TEXT,
        avatar_url TEXT,
        bio TEXT,
        interests TEXT,
        relationship_intention TEXT,
        about_me TEXT,
        profile_video_url TEXT,
        is_online INTEGER DEFAULT 0,
        last_active_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_age ON users(age);
      CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
      CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

      -- Credit Wallets
      CREATE TABLE IF NOT EXISTS credit_wallets (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
        complimentary_balance INTEGER NOT NULL DEFAULT 0 CHECK (complimentary_balance >= 0),
        purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
        updated_at TEXT NOT NULL
      );

      -- Credit Transactions (Immutable audit trail)
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reference_id TEXT,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(type);

      -- Credit Packages
      CREATE TABLE IF NOT EXISTS credit_packages (
        id TEXT PRIMARY KEY,
        credits INTEGER NOT NULL,
        price_usd REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      -- Gifts Catalogue
      CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon_name TEXT NOT NULL,
        credit_price INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      -- Gift Transactions
      CREATE TABLE IF NOT EXISTS gift_transactions (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES users(id),
        receiver_id TEXT NOT NULL REFERENCES users(id),
        gift_id TEXT NOT NULL REFERENCES gifts(id),
        gift_name TEXT NOT NULL,
        credit_price INTEGER NOT NULL,
        message TEXT,
        created_at TEXT NOT NULL
      );

      -- Likes, Matches, Follows, Blocks
      CREATE TABLE IF NOT EXISTS likes (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(sender_id, target_id)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        user1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(user1_id, user2_id)
      );

      CREATE TABLE IF NOT EXISTS follows (
        id TEXT PRIMARY KEY,
        follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(follower_id, following_id)
      );

      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(blocker_id, blocked_id)
      );
      CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

      -- Posts & Interactions
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT,
        is_exclusive INTEGER DEFAULT 0,
        credit_price INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS post_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        parent_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS post_reactions (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(post_id, user_id)
      );

      -- Messaging & Chat
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversation_members (
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT NOT NULL,
        last_read_at TEXT,
        PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT,
        is_paid INTEGER DEFAULT 0,
        credit_cost INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        partner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        last_billed_at TEXT NOT NULL,
        total_minutes_billed INTEGER DEFAULT 0,
        total_credits_billed INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        ended_at TEXT
      );

      -- Mail System
      CREATE TABLE IF NOT EXISTS mail_threads (
        id TEXT PRIMARY KEY,
        user1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        photo_count INTEGER DEFAULT 0,
        last_message_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user1_id, user2_id)
      );

      CREATE TABLE IF NOT EXISTS mail_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES mail_threads(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT,
        is_opened INTEGER DEFAULT 0,
        opened_at TEXT,
        credit_cost_sent INTEGER DEFAULT 0,
        credit_cost_opened INTEGER DEFAULT 0,
        is_archived_sender INTEGER DEFAULT 0,
        is_archived_recipient INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mail_thread ON mail_messages(thread_id);

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        reference_id TEXT,
        reference_type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

      -- Payments & Webhook Idempotency
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        package_id TEXT NOT NULL REFERENCES credit_packages(id),
        provider TEXT NOT NULL,
        external_transaction_id TEXT UNIQUE NOT NULL,
        amount_usd REAL NOT NULL,
        credits_awarded INTEGER NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Reports & Moderation
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL,
        target_id TEXT,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        resolution_notes TEXT,
        moderator_id TEXT REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS moderation_actions (
        id TEXT PRIMARY KEY,
        moderator_id TEXT NOT NULL REFERENCES users(id),
        target_user_id TEXT NOT NULL REFERENCES users(id),
        action_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details TEXT NOT NULL,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );
    `);

    db.run(
      `INSERT INTO schema_migrations (version, name) VALUES (?, ?)`,
      [1, '001_initial_schema']
    );
    console.log('Migration 001_initial_schema applied successfully.');
  }
}
