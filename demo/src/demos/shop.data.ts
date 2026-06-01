/**
 * Deterministic product-catalog data. Shared across React, Vue, and Angular demos.
 */
import { pick, rand, randInt } from '../lib/random';

export const SHOP_TOTAL = 50_000;

export interface Product {
  index: number;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  emoji: string;
  gradient: string;
  inStock: boolean;
  prime: boolean;
}

const ADJ = ['Wireless', 'Ergonomic', 'Premium', 'Compact', 'Pro', 'Ultra', 'Smart', 'Eco', 'Vintage', 'Rugged'];
const NOUN = ['Headphones', 'Keyboard', 'Mouse', 'Monitor', 'Webcam', 'Desk Lamp', 'Backpack', 'Water Bottle', 'Notebook', 'Charger'];
const CATS = ['Electronics', 'Home & Office', 'Accessories', 'Outdoors', 'Audio', 'Computing'];
const EMOJI = ['🎧', '⌨️', '🖱️', '🖥️', '📷', '💡', '🎒', '🍶', '📓', '🔌'];
const GRADS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#30cfd0,#330867)',
];

export function makeProduct(index: number): Product {
  const n = index % NOUN.length;
  return {
    index,
    name: `${pick(ADJ, index, 1)} ${NOUN[n]}`,
    category: pick(CATS, index, 2),
    price: Math.round((rand(index, 3) * 280 + 9.99) * 100) / 100,
    rating: Math.round((3 + rand(index, 4) * 2) * 10) / 10,
    reviews: randInt(index, 12, 9800, 5),
    emoji: EMOJI[n],
    gradient: GRADS[index % GRADS.length],
    inStock: index % 11 !== 0,
    prime: index % 3 === 0,
  };
}

export function stars(rating: number): string {
  const full = Math.round(rating);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}
