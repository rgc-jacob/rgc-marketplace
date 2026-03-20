import { useCallback, useEffect, useState } from 'react';
import { getCartCount, getCartLines, getCartSubtotal } from '../lib/cart';

export function useCart() {
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'rgc-marketplace:cart-v1') refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('rgc-cart', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('rgc-cart', refresh);
    };
  }, [refresh]);

  return {
    count: getCartCount(),
    lines: getCartLines(),
    subtotal: getCartSubtotal(),
    refresh,
  };
}
