import { TText, LTextInput, useLocalizedAlert } from '../context/LanguageContext';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, Pressable, Image,
  KeyboardAvoidingView, Platform, Modal, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, sendMessage, sendAttachmentMessage, markChatAsRead, subscribeToChat, sendTypingEvent, deleteChat } from '../services/chatService';
import { uploadChatAttachment, getChatAttachmentUrl, downloadChatImage } from '../services/mediaUploadService';
import { takePhoto, pickChatAttachment } from '../utils/mediaPickerUtil';

// جميع عمليات المحادثة تمر عبر chatService للحفاظ على عقد قاعدة بيانات واحد.


const HEADER_HEIGHT = 64;

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : `اليوم، ${d.toLocaleDateString('ar', { day: 'numeric', month: 'long' })}`;
}

// يحوّل صف chat_messages الخام (من قاعدة البيانات) إلى الشكل الذي تتوقعه الواجهة
function normalizeMessage(row, currentUserId) {
  return { id: row.id, text: row.content || '', date: row.created_at, fromMe: row.sender_id === currentUserId, read: !!row.read, messageType: row.message_type || 'text', attachmentPath: row.attachment_path || null, attachmentName: row.attachment_name || null, attachmentMime: row.attachment_mime || null, attachmentSize: row.attachment_size || null, attachmentUrl: row.attachment_url || null };
}

export default function ChatScreen({ route, navigation }) {
  const showLocalizedAlert = useLocalizedAlert();
  // ✅ استدعاء الخطاف هنا - داخل component مباشرة
  const insets = useSafeAreaInsets();

  const { conversationId, otherUserId: routeOtherUserId, title: routeTitle, chat: routeChat } = route.params || {};
  const { conversations = [] } = useData();
  const { user } = useAuth();
  const currentUserId = user?.auth_id || null;

  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [imageViewer, setImageViewer] = useState(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const listRef = useRef(null);

  const conversation = useMemo(() => {
    const existing = conversations.find((c) => c?.id === conversationId);
    if (existing) return existing;
    if (!conversationId) return null;
    const otherId = routeOtherUserId || routeChat?.participant_1_id || routeChat?.participant_2_id || null;
    const fallbackName = routeTitle || routeChat?.name || 'المحادثة';
    return {
      id: conversationId,
      otherUserId: otherId,
      name: fallbackName,
      initial: String(fallbackName).trim().slice(0, 1) || '?',
      tag: null,
      tagColorKey: 'default',
    };
  }, [conversations, conversationId, routeOtherUserId, routeTitle, routeChat]);

  const hydrateAttachments = useCallback(async (items) => {
    const needs = (items || []).filter((m) => m?.attachmentPath && !m.attachmentUrl);
    if (!needs.length) return items || [];
    const urls = await Promise.all(needs.map((m) => getChatAttachmentUrl(m.attachmentPath).catch(() => null)));
    const map = new Map(needs.map((m, i) => [m.id, urls[i]]));
    return (items || []).map((m) => map.has(m.id) ? { ...m, attachmentUrl: map.get(m.id) } : m);
  }, []);

  // ── تحميل الرسائل الحقيقية + القراءة + Realtime عبر خدمة موحّدة ─────────
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await getChatMessages(conversationId);
      setMessages(await hydrateAttachments((data || []).map((row) => normalizeMessage(row, currentUserId))));
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] loadMessages error:', error?.message || error);
    }
  }, [conversationId, currentUserId, hydrateAttachments]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    try {
      const result = await markChatAsRead(conversationId, currentUserId);
      if (!result?.success && __DEV__) console.warn('[ChatScreen] markAsRead error:', result?.error);
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] markAsRead error:', error?.message || error);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!conversationId) return undefined;
    void loadMessages();
    void markAsRead();

    const unsubscribe = subscribeToChat(
      conversationId,
      (payload) => {
        if (payload?.eventType === 'INSERT' && payload?.new) {
          const incoming = normalizeMessage(payload.new, currentUserId);
          // Add the row immediately. A background reload hydrates attachment URLs
          // and reconciles any missed realtime event without requiring a refresh.
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (payload.new.sender_id !== currentUserId) void markAsRead();
          void loadMessages();
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        } else {
          void loadMessages();
        }
      },
      (typing) => {
        if (typing?.userId && typing.userId !== currentUserId) {
          setOtherUserTyping(!!typing.isTyping);
        }
      },
    );

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void sendTypingEvent(conversationId, currentUserId, false);
      setOtherUserTyping(false);
      unsubscribe?.();
    };
  }, [conversationId, currentUserId, loadMessages, markAsRead]);

  const handleTyping = useCallback((value) => {
    setText(value);
    if (!conversationId || !currentUserId) return;
    void sendTypingEvent(conversationId, currentUserId, value.trim().length > 0);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (value.trim().length > 0) {
      typingTimerRef.current = setTimeout(() => {
        void sendTypingEvent(conversationId, currentUserId, false);
      }, 1200);
    }
  }, [conversationId, currentUserId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId || !currentUserId || sending) return;

    setText('');
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    void sendTypingEvent(conversationId, currentUserId, false);
    setSending(true);
    try {
      const result = await sendMessage(conversationId, currentUserId, trimmed);
      if (!result?.success) {
        throw new Error(result?.error || 'تعذّر إرسال الرسالة');
      }
      const data = result.data;
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, normalizeMessage(data, currentUserId)];
        });
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] handleSend error:', error?.message || error);
      showLocalizedAlert('تعذّر الإرسال', 'لم تُرسَل رسالتك، يرجى المحاولة مرة أخرى.');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const openImageViewer = useCallback((message) => {
    if (!message?.attachmentUrl) return;
    setImageViewer({
      url: message.attachmentUrl,
      name: message.attachmentName || `kilix_image_${Date.now()}.jpg`,
      mime: message.attachmentMime || 'image/jpeg',
    });
  }, []);

  const handleDownloadImage = useCallback(async () => {
    if (!imageViewer?.url || downloadingImage) return;
    setDownloadingImage(true);
    try {
      await downloadChatImage(imageViewer.url, imageViewer.name, imageViewer.mime);
      showLocalizedAlert('تم تحميل الصورة', 'تم حفظ الصورة في معرض الصور.');
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] image download error:', error?.message || error);
      showLocalizedAlert('تعذّر تحميل الصورة', error?.message || 'حاول مرة أخرى.');
    } finally {
      setDownloadingImage(false);
    }
  }, [imageViewer, downloadingImage, showLocalizedAlert]);

  const handleAttachment = async (source) => {
    if (!conversationId || !currentUserId || sending) return;
    setSending(true);
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickChatAttachment();
      if (!picked) return;
      const uploaded = await uploadChatAttachment(picked.uri, conversationId, currentUserId, picked.mimeType, picked.fileName, picked.kind || 'file');
      const result = await sendAttachmentMessage(conversationId, currentUserId, uploaded);
      if (!result?.success) throw new Error(result?.error || 'تعذّر إرسال المرفق');
      await loadMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] attachment error:', error?.message || error);
      showLocalizedAlert('تعذّر إرسال المرفق', error?.message || 'حاول مرة أخرى.');
    } finally { setSending(false); }
  };

  const dayLabel = messages.length > 0 && messages[0]?.date
    ? formatDayLabel(messages[0].date)
    : '';

  // keyboardVerticalOffset: نعوّض ارتفاع الهيدر + safe-area العلوي على iOS فقط
  // Android يستخدم behavior="height" دون الحاجة لـ offset
  const keyboardOffset = Platform.OS === 'ios' ? HEADER_HEIGHT + insets.top : 0;

  // ✅ الفحص الشرطي بعد كل الخطافات (Hooks) وليس قبلها، لاحترام قواعد الـ Hooks
  if (!conversation) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── الهيدر الثابت ───────────────────────────────────────────────── */}
      <View style={styles.chatHeader}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <MaterialIcons name="arrow-forward" size={24} color={colors.charcoalText} />
        </Pressable>
        <View style={styles.headerAvatar}>
          <TText style={styles.headerAvatarText}>{conversation?.initial || '?'}</TText>
        </View>
        <View style={{ flex: 1 }}>
          <TText style={styles.chatHeaderName} numberOfLines={1}>{conversation?.name || ''}</TText>
          {conversation?.tag ? (
            <View style={styles.headerTag}>
              <TText style={styles.headerTagText}>{conversation.tag}</TText>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
          <MaterialIcons name="more-vert" size={22} color={colors.charcoalText} />
        </Pressable>
      </View>

      {/* ── القائمة المنبثقة (Modal) ─────────────────────────────────────── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.dropdown, { top: insets.top + HEADER_HEIGHT }]}>
            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuOpen(false); setPinned((value) => !value); showLocalizedAlert(pinned ? 'تم إلغاء تثبيت المحادثة' : 'تم تثبيت المحادثة'); }}
            >
              <TText style={styles.dropdownText}>تثبيت المحادثة</TText>
              <MaterialIcons name="push-pin" size={18} color={colors.charcoalText} />
            </Pressable>
            <Pressable
              style={styles.dropdownItem}
              onPress={async () => {
                setMenuOpen(false);
                try {
                  await Share.share({ message: `محادثة مع ${conversation?.name || 'المستخدم'}` });
                } catch (error) {
                  if (__DEV__) console.warn('[ChatScreen] share error:', error?.message || error);
                }
              }}
            >
              <TText style={styles.dropdownText}>مشاركة المحادثة</TText>
              <MaterialIcons name="share" size={18} color={colors.charcoalText} />
            </Pressable>
            <View style={styles.dropdownDivider} />
            <Pressable
              style={styles.dropdownItem}
              onPress={() => {
                setMenuOpen(false);
                showLocalizedAlert('حذف المحادثة', 'هل أنت متأكد؟', [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const result = await deleteChat(conversationId);
                        if (!result?.success) throw new Error(result?.error || 'تعذّر حذف المحادثة');
                        navigation.goBack();
                      } catch (error) {
                        showLocalizedAlert('تعذر حذف المحادثة', error?.message || 'حاول مرة أخرى.');
                      }
                    },
                  },
                ]);
              }}
            >
              <TText style={[styles.dropdownText, { color: colors.error }]}>حذف المحادثة</TText>
              <MaterialIcons name="delete" size={18} color={colors.error} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!imageViewer}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setImageViewer(null)}
      >
        <View style={styles.imageViewerBackdrop}>
          <SafeAreaView style={styles.imageViewerSafeArea}>
            <View style={styles.imageViewerTopBar}>
              <Pressable
                style={styles.imageViewerAction}
                onPress={handleDownloadImage}
                disabled={downloadingImage}
                hitSlop={10}
              >
                <MaterialIcons
                  name={downloadingImage ? 'hourglass-top' : 'download'}
                  size={24}
                  color={colors.white}
                />
              </Pressable>
              <Pressable
                style={styles.imageViewerAction}
                onPress={() => setImageViewer(null)}
                hitSlop={10}
              >
                <MaterialIcons name="close" size={28} color={colors.white} />
              </Pressable>
            </View>
            {imageViewer?.url ? (
              <Pressable style={styles.imageViewerContent} onPress={() => setImageViewer(null)}>
                <Image
                  source={{ uri: imageViewer.url }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                />
              </Pressable>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── حاوية الكيبورد ───────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {/* قائمة الرسائل — flex:1 لتأخذ كل المساحة المتاحة فوق inputRow */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i, index) => i?.id || index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View>
              {otherUserTyping ? (
                <View style={styles.typingRow}>
                  <View style={styles.typingBubble}>
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                  </View>
                  <TText style={styles.typingText}>{conversation?.name || 'المستخدم'} يكتب...</TText>
                </View>
              ) : null}
              {dayLabel ? (
              <View style={styles.dayChip}>
                <TText style={styles.dayChipText}>{dayLabel}</TText>
              </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            if (!item) return null;
            return (
              <View style={[styles.bubbleRow, item.fromMe && styles.bubbleRowMine]}>
                {!item.fromMe ? (
                  <View style={styles.miniAvatar}>
                    <TText style={styles.miniAvatarText}>{conversation?.initial || '?'}</TText>
                  </View>
                ) : null}
                <View style={{ maxWidth: '80%' }}>
                  <View style={[styles.bubble, item.fromMe ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {item.messageType === 'image' && item.attachmentUrl ? (
                      <Pressable onPress={() => openImageViewer(item)}>
                        <Image source={{ uri: item.attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
                      </Pressable>
                    ) : item.messageType === 'text' ? (
                      <TText style={[styles.bubbleText, item.fromMe && { color: colors.white }]}>{item.text || ''}</TText>
                    ) : null}
                  </View>
                  <View style={[styles.bubbleMetaRow, item.fromMe && styles.bubbleMetaRowMine]}>
                    <TText style={styles.bubbleTime}>{formatTime(item.date)}</TText>
                    {item.fromMe && item.read ? (
                      <MaterialIcons name="done-all" size={12} color={colors.orangeVibrant} />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* ── شريط الإدخال السفلي ──────────────────────────────────────────── */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
            <MaterialIcons name="send" size={20} color={colors.white} />
          </Pressable>
          <LTextInput
            style={styles.messageInput}
            placeholder="اكتب رسالة..."
            textAlign="right"
            placeholderTextColor={colors.outline}
            value={text}
            onChangeText={handleTyping}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            multiline
            maxHeight={120}
          />
          <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => handleAttachment('camera')} disabled={sending}>
            <MaterialIcons name="photo-camera" size={22} color={colors.charcoalText} />
          </Pressable>
          <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => handleAttachment('file')} disabled={sending}>
            <MaterialIcons name="photo-library" size={22} color={colors.charcoalText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  flex1:            { flex: 1 },
  chatHeader:       { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, height: HEADER_HEIGHT, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  headerAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyDeep },
  headerAvatarText: { color: colors.white, fontWeight: '800' },
  chatHeaderName:   { color: colors.charcoalText, fontFamily: 'Cairo_700Bold', fontSize: 14, textAlign: 'right' },
  headerTag:        { backgroundColor: colors.orangeVibrant, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-end', marginTop: 2 },
  headerTagText:    { color: colors.white, fontSize: 9, fontWeight: '700' },
  menuBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  dropdown: {
    position: 'absolute',
    left: spacing.md,
    width: 200,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: 4,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  dropdownItem:     { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dropdownText:     { ...typography.bodySm, color: colors.charcoalText, flex: 1, textAlign: 'right' },
  dropdownDivider:  { height: 1, backgroundColor: colors.surfaceContainerLow, marginVertical: 2 },
  messagesList:     { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  typingRow:         { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', gap: spacing.sm, marginBottom: spacing.xs },
  typingBubble:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 7 },
  typingDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.outline },
  typingText:       { fontSize: 11, color: colors.outline },
  dayChip:          { alignSelf: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.md },
  dayChipText:      { fontSize: 10, fontWeight: '700', color: colors.outline },
  bubbleRow:        { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: spacing.sm, alignSelf: 'flex-end' },
  bubbleRowMine:    { flexDirection: 'row', alignSelf: 'flex-start' },
  miniAvatar:       { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText:   { color: colors.white, fontSize: 11, fontWeight: '700' },
  bubble:           { padding: spacing.md, borderRadius: radius.lg },
  bubbleTheirs:     { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceContainerLow },
  bubbleMine:       { backgroundColor: colors.orangeVibrant },
  bubbleText:       { ...typography.bodySm, color: colors.charcoalText, textAlign: 'right', lineHeight: 20 },
  bubbleMetaRow:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 2 },
  bubbleMetaRowMine:{ flexDirection: 'row' },
  bubbleTime:       { fontSize: 10, color: colors.outline },
  inputRow:         { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.surfaceContainerLow },
  messageInput:     { flex: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10 },
  sendBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeVibrant, alignItems: 'center', justifyContent: 'center' },
  iconBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  attachmentImage:  { width: 220, height: 180, borderRadius: radius.md },
  imageViewerBackdrop: { flex: 1, backgroundColor: '#000' },
  imageViewerSafeArea: { flex: 1 },
  imageViewerTopBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  imageViewerAction: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  imageViewerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageViewerImage: { width: '100%', height: '100%' },
  fileName:         { ...typography.bodySm, color: colors.charcoalText, textAlign: 'right', flex: 1 },
  fileHint:         { fontSize: 10, color: colors.outline, textAlign: 'right', marginTop: 2 },
});