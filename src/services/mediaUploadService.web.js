import { supabase } from '../config/supabaseConfig';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const BUCKET_NAME = 'media';

const getBrowserFile = async (fileUri, fallbackName = 'file') => {
  if (!fileUri) throw new Error('مسار الملف غير موجود');
  if (typeof fileUri !== 'string') return fileUri;
  const response = await fetch(fileUri);
  if (!response.ok) throw new Error('تعذر قراءة الملف المحدد');
  const blob = await response.blob();
  const name = fallbackName || fileUri.split('/').pop() || 'file';
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
};

const getMimeAndExtension = (file, fallbackType = 'image', providedMimeType = '') => {
  const mime = String(providedMimeType || file.type || '').toLowerCase();
  if (mime.startsWith('image/')) {
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { mime: mime || 'image/jpeg', ext };
  }
  if (mime.startsWith('video/')) {
    const ext = mime.includes('quicktime') ? 'mov' : mime.includes('webm') ? 'webm' : 'mp4';
    return { mime: mime || 'video/mp4', ext };
  }
  return fallbackType === 'video'
    ? { mime: 'video/mp4', ext: 'mp4' }
    : { mime: 'image/jpeg', ext: 'jpg' };
};

const uploadToBucket = async (bucket, path, file, mime) => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: mime,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
};

export const getFileSizeFromUri = async (fileUri) => {
  try { return Number((await getBrowserFile(fileUri)).size) || 0; } catch { return 0; }
};

export const uploadStoreLogo = async (fileUri, storeId, providedMimeType = '') => {
  const file = await getBrowserFile(fileUri);
  if (!file.size || file.size > MAX_IMAGE_SIZE) throw new Error('حجم صورة المتجر يتجاوز 10MB');
  const { mime, ext } = getMimeAndExtension(file, 'image', providedMimeType);
  if (!mime.startsWith('image/')) throw new Error('الملف المحدد ليس صورة');
  const path = `stores/${storeId}/avatar/store_${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
  await uploadToBucket('store-avatars', path, file, mime);
  return supabase.storage.from('store-avatars').getPublicUrl(path).data?.publicUrl || null;
};

export const uploadImage = async (fileUri, storeId, productId = null, providedMimeType = '') => {
  const file = await getBrowserFile(fileUri);
  if (!file.size || file.size > MAX_IMAGE_SIZE) throw new Error('حجم الصورة يتجاوز 10MB');
  const { mime, ext } = getMimeAndExtension(file, 'image', providedMimeType);
  if (!mime.startsWith('image/')) throw new Error('الملف المحدد ليس صورة');
  const path = `stores/${storeId}/products/${productId || 'new'}/images/image_${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
  await uploadToBucket(BUCKET_NAME, path, file, mime);
  return supabase.storage.from(BUCKET_NAME).getPublicUrl(path).data?.publicUrl || null;
};

export const uploadVideo = async (fileUri, storeId, productId = null, providedMimeType = '') => {
  const file = await getBrowserFile(fileUri);
  if (!file.size || file.size > MAX_VIDEO_SIZE) throw new Error('حجم الفيديو يتجاوز 100MB');
  const { mime, ext } = getMimeAndExtension(file, 'video', providedMimeType);
  if (!mime.startsWith('video/')) throw new Error('الملف المحدد ليس فيديو');
  const path = `stores/${storeId}/products/${productId || 'new'}/videos/video_${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
  await uploadToBucket(BUCKET_NAME, path, file, mime);
  return supabase.storage.from(BUCKET_NAME).getPublicUrl(path).data?.publicUrl || null;
};

const mapWithUploadConcurrency = async (items, worker, concurrency = 3) => {
  const results = new Array(items.length); let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) { const index = cursor++; if (index >= items.length) return; try { results[index] = await worker(items[index], index); } catch { results[index] = null; } }
  });
  await Promise.all(runners); return results;
};

export const uploadMultipleImages = async (uris, storeId, productId = null) => (await mapWithUploadConcurrency(uris || [], uri => uploadImage(uri, storeId, productId), 3)).filter(Boolean);
export const uploadMultipleVideos = async (uris, storeId, productId = null) => (await mapWithUploadConcurrency(uris || [], uri => uploadVideo(uri, storeId, productId), 2)).filter(Boolean);

export const uploadChatAttachment = async (fileUri, chatId, userId, providedMimeType = '', originalName = '', kind = 'file') => {
  if (!fileUri || !chatId || !userId) throw new Error('بيانات مرفق المحادثة غير مكتملة');
  const file = await getBrowserFile(fileUri, originalName || 'attachment');
  const max = kind === 'image' ? MAX_IMAGE_SIZE : kind === 'video' ? MAX_VIDEO_SIZE : 50 * 1024 * 1024;
  if (!file.size || file.size > max) throw new Error(`حجم الملف يتجاوز ${Math.round(max / 1024 / 1024)}MB`);
  const mime = String(providedMimeType || file.type || 'application/octet-stream').toLowerCase();
  const safeName = String(originalName || file.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'attachment';
  const ext = safeName.includes('.') ? safeName.split('.').pop() : (mime.split('/')[1] || 'bin');
  const path = `${chatId}/${userId}/${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
  await uploadToBucket('chat-media', path, file, mime);
  return { path, name: originalName || safeName, mimeType: mime, size: file.size, kind };
};

export const getChatAttachmentUrl = async (path, expiresIn = 3600) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
};

export const downloadChatImage = async (signedUrl, originalName = 'kilix_image', mimeType = 'image/jpeg') => {
  if (!signedUrl) throw new Error('رابط الصورة غير متوفر');
  if (!String(mimeType).toLowerCase().startsWith('image/')) throw new Error('يمكن تحميل الصور فقط.');
  const a = document.createElement('a');
  a.href = signedUrl; a.download = originalName || 'kilix_image'; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
  return signedUrl;
};

export const deleteMediaFile = async (publicUrl) => {
  try {
    if (!publicUrl) return false;
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const parts = publicUrl.split(marker); if (parts.length < 2) return false;
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([parts[1]]);
    return !error;
  } catch { return false; }
};

export const validateMediaFile = async (fileUri, fileType, mimeType = '') => {
  try {
    const file = await getBrowserFile(fileUri);
    const mime = String(mimeType || file.type || '').toLowerCase();
    const max = fileType === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const ok = fileType === 'image' ? mime.startsWith('image/') : mime.startsWith('video/');
    if (!ok) return { isValid: false, error: 'صيغة الملف غير مدعومة' };
    if (!file.size) return { isValid: false, error: 'الملف فارغ أو غير قابل للقراءة' };
    if (file.size > max) return { isValid: false, error: `حجم الملف يتجاوز ${max / 1024 / 1024}MB` };
    return { isValid: true };
  } catch { return { isValid: false, error: 'تعذر قراءة الملف من المتصفح' }; }
};

export const getMediaPublicUrl = (storagePath) => storagePath ? supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath).data?.publicUrl || null : null;
