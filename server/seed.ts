import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from './db.js';
import { CreditPackage, Gift } from './types.js';

export async function seedDatabase(): Promise<void> {
  // 1. System Reference Configuration: Credit Packages (Store Catalog)
  const packages = [
    { credits: 20, price: 9.99 },
    { credits: 30, price: 15.00 },
    { credits: 40, price: 20.00 },
    { credits: 65, price: 32.00 },
    { credits: 100, price: 50.00 },
    { credits: 135, price: 67.00 },
    { credits: 150, price: 75.00 },
    { credits: 200, price: 100.00 },
    { credits: 250, price: 125.00 },
    { credits: 500, price: 250.00 },
  ];

  for (const pkg of packages) {
    const existing = queryOne<CreditPackage>('SELECT id FROM credit_packages WHERE credits = ?', [pkg.credits]);
    if (!existing) {
      run(
        'INSERT INTO credit_packages (id, credits, price_usd, is_active, created_at) VALUES (?, ?, ?, 1, ?)',
        [uuidv4(), pkg.credits, pkg.price, new Date().toISOString()]
      );
    }
  }

  // 2. System Reference Configuration: Virtual Gifts (Catalog)
  const gifts = [
    { name: 'Rose', icon: 'Flower2', price: 5 },
    { name: 'Heart', icon: 'Heart', price: 10 },
    { name: 'Flowers', icon: 'Sparkles', price: 20 },
    { name: 'Gift Box', icon: 'Gift', price: 50 },
    { name: 'Premium Diamond', icon: 'Gem', price: 100 },
  ];

  for (const g of gifts) {
    const existing = queryOne<Gift>('SELECT id FROM gifts WHERE name = ?', [g.name]);
    if (!existing) {
      run(
        'INSERT INTO gifts (id, name, icon_name, credit_price, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        [uuidv4(), g.name, g.icon, g.price, new Date().toISOString()]
      );
    }
  }

  // No demo users, sample profiles, or fake business records are seeded.
  // The system starts in a clean state and relies entirely on genuine user registration and input.
}

