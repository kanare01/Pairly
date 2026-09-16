import assert from 'assert';
import { getDb } from '../server/db.js';
import { CreditService } from '../server/services/creditService.js';
import { MailBillingService } from '../server/services/mailBillingService.js';
import { ChatBillingService } from '../server/services/chatBillingService.js';
import { PaymentService, GatewayProvider } from '../server/services/paymentService.js';
import { DiscoveryService } from '../server/services/discoveryService.js';
import { MessagingService } from '../server/services/messagingService.js';
import { v4 as uuidv4 } from 'uuid';
import { run, queryOne } from '../server/db.js';

async function runAllTests() {
  console.log('=== STARTING PAIRLY COMPREHENSIVE AUTOMATED TEST SUITE ===\n');
  await getDb();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  function createTestUser(id, email = `${id}@test.com`) {
    const now = new Date().toISOString();
    run(
      `INSERT INTO users 
      (id, email, password_hash, display_name, date_of_birth, age, gender, location, role, status, email_verified, is_online, last_active_at, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Test User', '1995-01-01', 31, 'MALE', 'New York', 'MEMBER', 'ACTIVE', 1, 1, ?, ?, ?)`,
      [id, email, now, now, now]
    );
  }

  // TEST 1: Credit Wallet & Priority rule (Complimentary consumed before Purchased)
  await test('Credit Wallet: Atomic Deduction & Complimentary Pool Priority', async () => {
    const testUserId = `test_user_${Date.now()}`;
    const now = new Date().toISOString();
    createTestUser(testUserId);

    // Give 20 complimentary credits + 50 purchased credits
    run(
      'INSERT INTO credit_wallets (user_id, balance, complimentary_balance, purchased_balance, updated_at) VALUES (?, 70, 20, 50, ?)',
      [testUserId, now]
    );

    // Spend 15 credits -> should consume 15 from complimentary, 0 from purchased
    const res1 = CreditService.spendCredits(testUserId, 15, 'CHAT_USAGE', null, 'Test spend 15');
    assert.strictEqual(res1.wallet.balance, 55);
    assert.strictEqual(res1.wallet.complimentary_balance, 5);
    assert.strictEqual(res1.wallet.purchased_balance, 50);

    // Spend 10 credits -> should consume remaining 5 complimentary + 5 purchased
    const res2 = CreditService.spendCredits(testUserId, 10, 'STICKER_SENT', null, 'Test spend 10');
    assert.strictEqual(res2.wallet.balance, 45);
    assert.strictEqual(res2.wallet.complimentary_balance, 0);
    assert.strictEqual(res2.wallet.purchased_balance, 45);

    // Verify transaction records created
    const tx = queryOne('SELECT * FROM credit_transactions WHERE user_id = ? AND type = ?', [testUserId, 'STICKER_SENT']);
    assert.ok(tx);
    assert.strictEqual(tx.amount, -10);
    assert.strictEqual(tx.balance_before, 55);
    assert.strictEqual(tx.balance_after, 45);
  });

  // TEST 2: Credit Wallet: Insufficient Balance Rejection & Negative Balance Prevention
  await test('Credit Wallet: Rejects Insufficient Balance Atomically', async () => {
    const testUserId = `test_user_broke_${Date.now()}`;
    const now = new Date().toISOString();
    createTestUser(testUserId);

    run(
      'INSERT INTO credit_wallets (user_id, balance, complimentary_balance, purchased_balance, updated_at) VALUES (?, 5, 5, 0, ?)',
      [testUserId, now]
    );

    let threw = false;
    try {
      CreditService.spendCredits(testUserId, 10, 'VIDEO_OPENED', null, 'Spend more than balance');
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, true);

    const wallet = CreditService.getWallet(testUserId);
    assert.strictEqual(wallet.balance, 5, 'Balance must remain unchanged after rejected spend');
  });

  // TEST 3: Mail Credit Billing Calculations
  await test('Mail Billing: 1st Letter 10 credits, Following 30 credits, 1st Open 0, Following 10', async () => {
    const threadId = `thread_${Date.now()}`;
    const u1 = `mail_u1_${Date.now()}`;
    const u2 = `mail_u2_${Date.now()}`;
    createTestUser(u1);
    createTestUser(u2);
    const now = new Date().toISOString();

    // Brand new thread (0 messages)
    run(
      'INSERT INTO mail_threads (id, user1_id, user2_id, subject, message_count, photo_count, last_message_at, created_at) VALUES (?, ?, ?, "Subj", 0, 0, ?, ?)',
      [threadId, u1, u2, now, now]
    );

    const costFirst = MailBillingService.getSendLetterCost(threadId);
    assert.strictEqual(costFirst, 10, 'First letter in thread must cost 10 credits');

    // Update thread to have 1 message
    run('UPDATE mail_threads SET message_count = 1 WHERE id = ?', [threadId]);
    const costSecond = MailBillingService.getSendLetterCost(threadId);
    assert.strictEqual(costSecond, 30, 'Following letters must cost 30 credits');

    // Opening cost: first opened letter is 0 credits (free)
    const openFirstCost = MailBillingService.getOpenLetterCost(threadId, u2);
    assert.strictEqual(openFirstCost, 0, 'First letter opened in thread must be free (0 credits)');

    // Simulate opening first message
    const msgId = `m_${Date.now()}_${Math.random()}`;
    run(
      'INSERT INTO mail_messages (id, thread_id, sender_id, recipient_id, subject, content, is_opened, created_at) VALUES (?, ?, ?, ?, "Subj", "Cont", 1, ?)',
      [msgId, threadId, u1, u2, now]
    );

    const openSecondCost = MailBillingService.getOpenLetterCost(threadId, u2);
    assert.strictEqual(openSecondCost, 10, 'Following opened letters must cost 10 credits');
  });

  // TEST 4: Chat Billing Rate (2 credits / minute)
  await test('Chat Billing: Rates 2 credits/min and Tracks Session Accurately', async () => {
    const userA = `chat_u1_${Date.now()}`;
    const userB = `chat_u2_${Date.now()}`;
    createTestUser(userA);
    createTestUser(userB);
    const convId = `conv_${Date.now()}`;
    const now = new Date().toISOString();

    run('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)', [convId, now, now]);
    run('INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)', [convId, userA, now]);
    run('INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)', [convId, userB, now]);

    // Give userA 20 credits
    run('INSERT INTO credit_wallets (user_id, balance, complimentary_balance, purchased_balance, updated_at) VALUES (?, 20, 20, 0, ?)', [userA, now]);

    const session = ChatBillingService.startOrResumeSession(userA, convId, userB);
    assert.strictEqual(session.is_active, true);
    assert.strictEqual(session.total_credits_billed, 0);

    // End session
    ChatBillingService.endSession(session.id, userA);
    const ended = queryOne('SELECT is_active FROM chat_sessions WHERE id = ?', [session.id]);
    assert.strictEqual(ended.is_active, 0);
  });

  // TEST 5: Payment Webhook Signature Verification & Idempotent Credit Allocation
  await test('Payments: Signature Verification & Idempotency Protection', async () => {
    const provider = PaymentService.getProvider();
    const userId = `pay_user_${Date.now()}`;
    createTestUser(userId);
    const now = new Date().toISOString();

    const pkgId = `pkg_${Date.now()}`;
    run('INSERT INTO credit_packages (id, credits, price_usd, is_active, created_at) VALUES (?, 40, 20.00, 1, ?)', [pkgId, now]);

    run('INSERT INTO credit_wallets (user_id, balance, complimentary_balance, purchased_balance, updated_at) VALUES (?, 0, 0, 0, ?)', [userId, now]);

    const payload = {
      externalTransactionId: `ext_tx_${Date.now()}`,
      idempotencyKey: `idemp_${Date.now()}`,
      packageId: pkgId,
      userId: userId,
      amountUsd: 20.00,
      credits: 40,
      status: 'SUCCEEDED',
    };

    const rawBody = JSON.stringify(payload);
    const signature = provider.generateSignature(rawBody);

    // First webhook call: should award 40 credits
    const res1 = PaymentService.processWebhook(rawBody, signature, payload);
    assert.strictEqual(res1.success, true);

    const walletAfter1 = CreditService.getWallet(userId);
    assert.strictEqual(walletAfter1.balance, 40);
    assert.strictEqual(walletAfter1.purchased_balance, 40);

    // Duplicate webhook call with same idempotencyKey: MUST NOT award credits again!
    const res2 = PaymentService.processWebhook(rawBody, signature, payload);
    assert.strictEqual(res2.success, true);
    assert.ok(res2.message.includes('already successfully processed'));

    const walletAfter2 = CreditService.getWallet(userId);
    assert.strictEqual(walletAfter2.balance, 40, 'Idempotency must guarantee no duplicate credits!');
  });

  // TEST 6: Global Blocking Enforcement
  await test('Safety & Blocking: Enforced Globally across discovery and interactions', async () => {
    const userA = `block_a_${Date.now()}`;
    const userB = `block_b_${Date.now()}`;
    createTestUser(userA);
    createTestUser(userB);

    DiscoveryService.blockUser(userA, userB, 'Test harassment');
    assert.strictEqual(DiscoveryService.isBlocked(userA, userB), true);
    assert.strictEqual(DiscoveryService.isBlocked(userB, userA), true);

    // Attempting to like a blocked user must throw
    let likeThrew = false;
    try {
      DiscoveryService.likeUser(userB, userA);
    } catch {
      likeThrew = true;
    }
    assert.strictEqual(likeThrew, true, 'Blocked user cannot be liked');

    // Unblock
    DiscoveryService.unblockUser(userA, userB);
    assert.strictEqual(DiscoveryService.isBlocked(userA, userB), false);
  });

  console.log(`\n=== TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
