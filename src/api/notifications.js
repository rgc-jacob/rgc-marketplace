import { supabase } from '../lib/supabase';

/**
 * @returns {Promise<{ ok: boolean, rows: Array, unreadCount: number, error: string|null }>}
 */
export async function getNotifications(limit = 20) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, rows: [], unreadCount: 0, error: 'Not signed in' };
  }

  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ]);

  if (listRes.error) {
    console.error('getNotifications', listRes.error);
    return { ok: false, rows: [], unreadCount: 0, error: listRes.error.message };
  }
  return { ok: true, rows: listRes.data || [], unreadCount: unreadRes.count ?? 0, error: null };
}

/**
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);

  if (error) {
    console.error('markNotificationRead', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/**
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function markAllNotificationsRead() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    console.error('markAllNotificationsRead', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}
