import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run, transaction } from '../db.js';
import { CreditPackage, PaymentTransaction } from '../types.js';
import { CreditService } from './creditService.js';
import { NotificationService } from './notificationService.js';

export interface CheckoutResult {
  sessionId: string;
  checkoutUrl: string;
  amountUsd: number;
  credits: number;
  idempotencyKey: string;
}

export interface WebhookEvent {
  externalTransactionId: string;
  idempotencyKey: string;
  packageId: string;
  userId: string;
  amountUsd: number;
  credits: number;
  status: 'SUCCEEDED' | 'FAILED';
}

export interface PaymentProvider {
  createCheckout(userId: string, pkg: CreditPackage, idempotencyKey: string): Promise<CheckoutResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhookPayload(body: any): WebhookEvent;
}

/**
 * Standard Production-Ready Test & Live Gateway implementation.
 * Validates HMAC SHA-256 signatures, prevents duplicate credits, and manages lifecycle.
 */
export class GatewayProvider implements PaymentProvider {
  private secretKey: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey || process.env.PAYMENT_WEBHOOK_SECRET || 'pairly_payment_webhook_secret_key_2026';
  }

  async createCheckout(userId: string, pkg: CreditPackage, idempotencyKey: string): Promise<CheckoutResult> {
    const sessionId = `cs_${uuidv4().replace(/-/g, '')}`;
    return {
      sessionId,
      checkoutUrl: `/checkout/${sessionId}?pkg=${pkg.id}&key=${idempotencyKey}`,
      amountUsd: pkg.price_usd,
      credits: pkg.credits,
      idempotencyKey,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const computed = crypto.createHmac('sha256', this.secretKey).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }

  parseWebhookPayload(body: any): WebhookEvent {
    return {
      externalTransactionId: body.externalTransactionId || body.id,
      idempotencyKey: body.idempotencyKey,
      packageId: body.packageId,
      userId: body.userId,
      amountUsd: Number(body.amountUsd),
      credits: Number(body.credits),
      status: body.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
    };
  }

  /**
   * Helper to generate a valid signature for simulated/verified webhooks.
   */
  generateSignature(rawBody: string): string {
    return crypto.createHmac('sha256', this.secretKey).update(rawBody).digest('hex');
  }
}

export class PaymentService {
  private static provider: PaymentProvider = new GatewayProvider();

  static setProvider(provider: PaymentProvider) {
    this.provider = provider;
  }

  static getProvider(): PaymentProvider {
    return this.provider;
  }

  /**
   * Initializes a checkout session for a credit package.
   */
  static async createCheckout(userId: string, packageId: string): Promise<CheckoutResult> {
    const pkg = queryOne<CreditPackage>('SELECT * FROM credit_packages WHERE id = ? AND is_active = 1', [packageId]);
    if (!pkg) {
      throw new Error('Selected credit package does not exist or is currently inactive.');
    }

    const idempotencyKey = `idemp_${uuidv4()}`;
    const result = await this.provider.createCheckout(userId, pkg, idempotencyKey);

    // Record pending transaction
    const txId = uuidv4();
    const now = new Date().toISOString();
    run(
      `INSERT INTO payment_transactions 
      (id, user_id, package_id, provider, external_transaction_id, amount_usd, credits_awarded, status, idempotency_key, created_at)
      VALUES (?, ?, ?, 'GATEWAY', ?, ?, ?, 'PENDING', ?, ?)`,
      [txId, userId, pkg.id, result.sessionId, pkg.price_usd, pkg.credits, idempotencyKey, now]
    );

    return result;
  }

  /**
   * Processes verified webhook event with idempotent duplicate payment protection.
   */
  static processWebhook(rawBody: string, signature: string, payload: any): { success: boolean; message: string } {
    // 1. Verify signature
    const isValid = this.provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new Error('Invalid payment webhook signature.');
    }

    const event = this.provider.parseWebhookPayload(payload);

    return transaction(() => {
      // 2. Check if this transaction or idempotency key has already been processed
      const existing = queryOne<PaymentTransaction>(
        'SELECT * FROM payment_transactions WHERE idempotency_key = ? OR external_transaction_id = ?',
        [event.idempotencyKey, event.externalTransactionId]
      );

      if (existing && existing.status === 'SUCCEEDED') {
        // Idempotent duplicate: return success without re-crediting!
        return { success: true, message: 'Transaction already successfully processed. No duplicate credits awarded.' };
      }

      if (event.status !== 'SUCCEEDED') {
        if (existing) {
          run('UPDATE payment_transactions SET status = ? WHERE id = ?', ['FAILED', existing.id]);
        }
        return { success: false, message: 'Payment failed at provider.' };
      }

      // 3. Update payment transaction status
      const now = new Date().toISOString();
      if (existing) {
        run('UPDATE payment_transactions SET status = ? WHERE id = ?', ['SUCCEEDED', existing.id]);
      } else {
        const txId = uuidv4();
        run(
          `INSERT INTO payment_transactions 
          (id, user_id, package_id, provider, external_transaction_id, amount_usd, credits_awarded, status, idempotency_key, created_at)
          VALUES (?, ?, ?, 'GATEWAY', ?, ?, ?, 'SUCCEEDED', ?, ?)`,
          [txId, event.userId, event.packageId, event.externalTransactionId, event.amountUsd, event.credits, event.idempotencyKey, now]
        );
      }

      // 4. Atomically award purchased credits to user's wallet
      CreditService.addCredits(
        event.userId,
        event.credits,
        'CREDIT_PURCHASE',
        true, // marked as purchased
        event.externalTransactionId,
        `Purchased ${event.credits} credits ($${event.amountUsd.toFixed(2)})`
      );

      // 5. Notify user
      NotificationService.create(
        event.userId,
        'CREDIT_PURCHASE',
        'Credits Added!',
        `Your payment of $${event.amountUsd.toFixed(2)} was successful. ${event.credits} credits have been added to your wallet.`
      );

      return { success: true, message: `Successfully allocated ${event.credits} credits.` };
    });
  }
}
