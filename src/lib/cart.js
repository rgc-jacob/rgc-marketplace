const KEY = 'rgc-marketplace:cart-v1';

function bump() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rgc-cart'));
  }
}

/** @typedef {{ listingId: string, source: 'seller'|'reference', title: string, price: number, quantity: number, image?: string }} CartLine */

function readLines() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLines(lines) {
  localStorage.setItem(KEY, JSON.stringify(lines));
}

export function getCartLines() {
  return readLines();
}

export function getCartCount() {
  return readLines().reduce((n, l) => n + (l.quantity || 1), 0);
}

export function getCartSubtotal() {
  return readLines().reduce((sum, l) => sum + Number(l.price || 0) * (l.quantity || 1), 0);
}

/**
 * @param {Omit<CartLine, 'quantity'> & { quantity?: number }} line
 */
export function addToCart(line) {
  const lines = readLines();
  const qty = Math.max(1, line.quantity || 1);
  const idx = lines.findIndex((l) => l.listingId === line.listingId && l.source === line.source);
  if (idx >= 0) {
    lines[idx] = {
      ...lines[idx],
      quantity: (lines[idx].quantity || 1) + qty,
      price: line.price,
      title: line.title,
      image: line.image ?? lines[idx].image,
    };
  } else {
    lines.push({
      listingId: line.listingId,
      source: line.source,
      title: line.title,
      price: Number(line.price),
      quantity: qty,
      image: line.image,
    });
  }
  writeLines(lines);
  bump();
  return lines;
}

export function setLineQuantity(listingId, source, quantity) {
  let lines = readLines();
  const q = Math.max(0, Math.floor(Number(quantity)));
  const idx = lines.findIndex((l) => l.listingId === listingId && l.source === source);
  if (idx < 0) return lines;
  if (q <= 0) lines = lines.filter((_, i) => i !== idx);
  else lines[idx] = { ...lines[idx], quantity: q };
  writeLines(lines);
  bump();
  return lines;
}

export function removeFromCart(listingId, source) {
  const lines = readLines().filter((l) => !(l.listingId === listingId && l.source === source));
  writeLines(lines);
  bump();
  return lines;
}

export function clearCart() {
  writeLines([]);
  bump();
}
