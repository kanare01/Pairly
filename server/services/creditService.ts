import { v4 as uuidv4 } from 'uuid';
import { queryOne, run, transaction } from '../db.js';
import { CreditWallet, CreditTransaction, TransactionType } from '../types.js';

export class CreditService {
  /**
   * Retrieves the wallet for a user.
   */
  static getWallet(userId: string): CreditWallet {
    let wallet = queryOne<CreditWallet>('SELECT * FROM credit_wallets WHERE user_id = ?', [userId]);
    if (!wallet) {
      // Auto-initialize wallet if missing (defensive)
      const now = new Date().toISOString();
      run(
        'INSERT INTO credit_wallets (user_id, balance, complimentary_balance, purchased_balance, updated_at) VALUES (?, 0, 0, 0, ?)',
        [userId, now]
      );
      wallet = {
        user_id: userId,
        balance: 0,
        complimentary_balance: 0,
        purchased_balance: 0,
        updated_at: now,
      };
    }
    return wallet;
  }

  /**
   * Spends credits atomically.
   * Priority rule: Consume complimentary credits first, then purchased credits.
   * Throws if balance is insufficient.
   */
  static spendCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    referenceId: string | null,
    description: string
  ): { wallet: CreditWallet; transaction: CreditTransaction } {
    if (amount <= 0) {
      throw new Error('Spend amount must be strictly greater than 0.');
    }

    return transaction(() => {
      const wallet = this.getWallet(userId);
      if (wallet.balance < amount) {
        throw new Error(`Insufficient credits. Required: ${amount}, Available: ${wallet.balance}.`);
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - amount;

      // Consume complimentary first, then purchased
      let compRemaining = wallet.complimentary_balance;
      let purchRemaining = wallet.purchased_balance;

      if (compRemaining >= amount) {
        compRemaining -= amount;
      } else {
        const excess = amount - compRemaining;
        compRemaining = 0;
        purchRemaining -= excess;
      }

      const now = new Date().toISOString();
      run(
        'UPDATE credit_wallets SET balance = ?, complimentary_balance = ?, purchased_balance = ?, updated_at = ? WHERE user_id = ?',
        [balanceAfter, compRemaining, purchRemaining, now, userId]
      );

      const txId = uuidv4();
      run(
        `INSERT INTO credit_transactions 
        (id, user_id, type, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, userId, type, -amount, balanceBefore, balanceAfter, referenceId, description, now]
      );

      const updatedWallet: CreditWallet = {
        user_id: userId,
        balance: balanceAfter,
        complimentary_balance: compRemaining,
        purchased_balance: purchRemaining,
        updated_at: now,
      };

      const creditTx: CreditTransaction = {
        id: txId,
        user_id: userId,
        type,
        amount: -amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: referenceId,
        description,
        created_at: now,
      };

      return { wallet: updatedWallet, transaction: creditTx };
    });
  }

  /**
   * Adds credits atomically (e.g. Purchase, Welcome bonus, Admin adjustment, Refund).
   */
  static addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    isPurchased: boolean,
    referenceId: string | null,
    description: string
  ): { wallet: CreditWallet; transaction: CreditTransaction } {
    if (amount <= 0) {
      throw new Error('Credit addition amount must be strictly positive.');
    }

    return transaction(() => {
      const wallet = this.getWallet(userId);
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      const compBalance = isPurchased ? wallet.complimentary_balance : wallet.complimentary_balance + amount;
      const purchBalance = isPurchased ? wallet.purchased_balance + amount : wallet.purchased_balance;

      const now = new Date().toISOString();
      run(
        'UPDATE credit_wallets SET balance = ?, complimentary_balance = ?, purchased_balance = ?, updated_at = ? WHERE user_id = ?',
        [balanceAfter, compBalance, purchBalance, now, userId]
      );

      const txId = uuidv4();
      run(
        `INSERT INTO credit_transactions 
        (id, user_id, type, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, userId, type, amount, balanceBefore, balanceAfter, referenceId, description, now]
      );

      const updatedWallet: CreditWallet = {
        user_id: userId,
        balance: balanceAfter,
        complimentary_balance: compBalance,
        purchased_balance: purchBalance,
        updated_at: now,
      };

      const creditTx: CreditTransaction = {
        id: txId,
        user_id: userId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: referenceId,
        description,
        created_at: now,
      };

      return { wallet: updatedWallet, transaction: creditTx };
    });
  }
}
