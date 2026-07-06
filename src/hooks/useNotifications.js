import { useCallback, useEffect, useState } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import { useAuth } from '../contexts/AuthContext';

const POLL_MS = 60_000;

/** Server-driven (another user's action can create a notification), so this hook
 * polls rather than relying purely on local events like useCart/useWatchlist do. */
export function useNotifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!user) {
      setRows([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    getNotifications(20)
      .then((res) => {
        setRows(res.rows);
        setUnreadCount(res.unreadCount);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  const markRead = useCallback(
    async (id) => {
      await markNotificationRead(id);
      refresh();
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    refresh();
  }, [refresh]);

  return { rows, unreadCount, loading, refresh, markRead, markAllRead };
}
