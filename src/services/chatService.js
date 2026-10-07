import { supabase } from '../config/supabaseConfig';

const getDisplayName = (row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() || 'مستخدم';
const chatChannels = new Map();

export async function getOrCreateChat(currentUserId, otherUserId, relatedOrderId = null) {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId) throw new Error('معرفات المحادثة غير صالحة');
  // The RPC uses auth.uid() as the caller identity; currentUserId is validated client-side only.
  const { data, error } = await supabase.rpc('get_or_create_chat', { p_other_user_id: otherUserId, p_related_order_id: relatedOrderId });
  if (error) throw error;
  return data;
}

export async function sendMessage(conversationId, senderId, text) {
  const content = String(text || '').trim();
  if (!conversationId || !senderId || !content) return { success: false, error: 'بيانات الرسالة غير مكتملة' };
  const { data, error } = await supabase.from('chat_messages').insert({ chat_id: conversationId, sender_id: senderId, content, message_type: 'text' }).select('*').single();
  if (error) return { success: false, error: error.message };

  // Broadcast gives the other open chat an immediate path; Postgres Realtime
  // remains the source of truth and also covers reconnects/offline delivery.
  await broadcastChatEvent(conversationId, 'chat_message', { message: data });
  return { success: true, data };
}

export async function sendAttachmentMessage(conversationId, senderId, attachment) {
  if (!conversationId || !senderId || !attachment?.path) {
    return { success: false, error: 'بيانات المرفق غير مكتملة' };
  }
  const content = String(attachment.name || 'مرفق').trim() || 'مرفق';
  const payload = {
    chat_id: conversationId,
    sender_id: senderId,
    content,
    message_type: attachment.kind || 'file',
    attachment_path: attachment.path,
    attachment_name: attachment.name || null,
    attachment_mime: attachment.mimeType || null,
    attachment_size: Number(attachment.size) || null,
  };
  const { data, error } = await supabase.from('chat_messages').insert(payload).select('*').single();
  if (error) return { success: false, error: error.message };
  await broadcastChatEvent(conversationId, 'chat_message', { message: data });
  return { success: true, data };
}

export async function getChatMessages(conversationId, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await supabase.from('chat_messages').select('id,chat_id,sender_id,content,read,created_at,message_type,attachment_path,attachment_name,attachment_mime,attachment_size').eq('chat_id', conversationId).order('created_at', { ascending: true }).range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return data || [];
}

export async function getUserChats(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { data: chats, error } = await supabase
    .from('chats')
    .select('id,participant_1_id,participant_2_id,related_order_id,last_message_at,created_at,updated_at')
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  if (!chats?.length) return [];

  const chatIds = chats.map((chat) => chat.id);
  const otherIds = [...new Set(chats.map((c) => c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id))];
  const relatedOrderIds = [...new Set(chats.map((c) => c.related_order_id).filter(Boolean))];

  const [{ data: profiles, error: profilesError }, { data: stores, error: storesError }, { data: ownStores, error: ownStoresError }, { data: relatedOrders, error: relatedOrdersError }, { data: unreadRows, error: unreadError }, { data: recentMessages, error: recentMessagesError }] = await Promise.all([
    supabase.from('public_profiles').select('auth_id,user_code,first_name,last_name,avatar_url').in('auth_id', otherIds),
    supabase.from('stores').select('owner_id,store_name,logo_url').in('owner_id', otherIds),
    supabase.from('stores').select('id,owner_id').eq('owner_id', userId),
    relatedOrderIds.length
      ? supabase.from('orders').select('id,store_id,user_id').in('id', relatedOrderIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('chat_messages').select('chat_id').in('chat_id', chatIds).eq('read', false).neq('sender_id', userId),
    // Bound this batch so a large account never downloads an unbounded message history.
    // Chats with no message in this window still render correctly using last_message_at.
    supabase.from('chat_messages').select('chat_id,content,created_at').in('chat_id', chatIds).order('created_at', { ascending: false }).limit(Math.min(safeLimit * 20, 1000)),
  ]);
  if (profilesError) throw profilesError;
  if (storesError) throw storesError;
  if (ownStoresError) throw ownStoresError;
  if (relatedOrdersError) throw relatedOrdersError;
  if (unreadError) throw unreadError;
  if (recentMessagesError) throw recentMessagesError;

  const profilesMap = new Map((profiles || []).map((p) => [p.auth_id, p]));
  const storesMap = new Map((stores || []).map((st) => [st.owner_id, st]));
  const ownStoreIds = new Set((ownStores || []).map((st) => st.id));
  const ordersMap = new Map((relatedOrders || []).map((o) => [o.id, o]));
  const unreadMap = new Map();
  for (const row of unreadRows || []) unreadMap.set(row.chat_id, (unreadMap.get(row.chat_id) || 0) + 1);
  const latestMap = new Map();
  for (const row of recentMessages || []) {
    if (!latestMap.has(row.chat_id)) latestMap.set(row.chat_id, row);
  }

  return chats.map((chat) => {
    const otherId = chat.participant_1_id === userId ? chat.participant_2_id : chat.participant_1_id;
    const profile = profilesMap.get(otherId);
    const otherStore = storesMap.get(otherId);
    const relatedOrder = chat.related_order_id ? ordersMap.get(chat.related_order_id) : null;
    const currentUserIsMerchantForOrder = !!relatedOrder && ownStoreIds.has(relatedOrder.store_id) && relatedOrder.user_id === otherId;
    const displayName = currentUserIsMerchantForOrder
      ? getDisplayName(profile)
      : (otherStore?.store_name?.trim() || getDisplayName(profile));
    const avatarUrl = currentUserIsMerchantForOrder
      ? (profile?.avatar_url || otherStore?.logo_url || null)
      : (otherStore?.logo_url || profile?.avatar_url || null);
    const latest = latestMap.get(chat.id);

    return {
      id: chat.id,
      otherUserId: otherId,
      relatedOrderId: chat.related_order_id,
      name: displayName,
      avatarUrl,
      initial: displayName.slice(0, 1),
      color: '#1A237E',
      tag: null,
      tagColorKey: 'default',
      lastMessage: latest?.content || '',
      lastMessageDate: latest?.created_at || chat.last_message_at || chat.updated_at || chat.created_at,
      unread: unreadMap.get(chat.id) || 0,
    };
  });
}

export async function markMessageAsRead(messageId, userId) {
  const { error } = await supabase.from('chat_messages').update({ read: true }).eq('id', messageId).neq('sender_id', userId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function markChatAsRead(chatId, userId) {
  const { error } = await supabase.from('chat_messages').update({ read: true }).eq('chat_id', chatId).neq('sender_id', userId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteChat(conversationId) {
  const { error } = await supabase.from('chats').delete().eq('id', conversationId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function findChatWithUser(currentUserId, otherUserId) {
  const { data, error } = await supabase.from('chats').select('*').or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${otherUserId}),and(participant_1_id.eq.${otherUserId},participant_2_id.eq.${currentUserId})`).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getUnreadMessageCount(userId) {
  const { data: chats, error } = await supabase.from('chats').select('id').or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);
  if (error) throw error;
  const ids = (chats || []).map((c) => c.id);
  if (!ids.length) return 0;
  const { count, error: countError } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).in('chat_id', ids).neq('sender_id', userId).eq('read', false);
  if (countError) throw countError;
  return count || 0;
}

export function subscribeToChat(conversationId, callback, onTyping, onStatus) {
  if (!conversationId) return () => {};

  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chat_messages',
      filter: `chat_id=eq.${conversationId}`,
    }, callback)
    .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      if (payload?.message) callback({ eventType: 'INSERT', new: payload.message, source: 'broadcast' });
    })
    .on('broadcast', { event: 'chat_typing' }, ({ payload }) => {
      if (typeof onTyping === 'function') onTyping(payload || {});
    })
    .subscribe((status, error) => {
      if (__DEV__) {
        if (status === 'SUBSCRIBED') console.log(`[ChatRealtime] subscribed: ${conversationId}`);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn(`[ChatRealtime] ${status}:`, error?.message || error || conversationId);
      }
      if (typeof onStatus === 'function') onStatus(status, error);
    });

  chatChannels.set(conversationId, channel);

  return () => {
    if (chatChannels.get(conversationId) === channel) chatChannels.delete(conversationId);
    void supabase.removeChannel(channel);
  };
}

function broadcastChatEvent(conversationId, event, payload) {
  if (!conversationId) return;
  const channel = chatChannels.get(conversationId);
  if (!channel) return;
  void channel.send({ type: 'broadcast', event, payload }).catch((error) => {
    // DB insert already succeeded; Broadcast is only an acceleration path.
    if (__DEV__) console.warn('[ChatRealtime] broadcast failed:', error?.message || error);
  });
}

export function sendTypingEvent(conversationId, userId, isTyping) {
  if (!conversationId || !userId) return;
  broadcastChatEvent(conversationId, 'chat_typing', { userId, isTyping: !!isTyping });
}

export function subscribeToUserChats(userId, callback) {
  if (!userId) return () => {};
  const channel = supabase.channel(`user-chats:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, callback)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
