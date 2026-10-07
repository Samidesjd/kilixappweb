const openFilePicker = (accept = 'image/*', multiple = false, capture = false) => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  if (capture) input.setAttribute('capture', 'environment');
  input.onchange = () => resolve(Array.from(input.files || []));
  input.click();
});

const toAsset = (file) => ({
  uri: URL.createObjectURL(file),
  fileName: file.name,
  mimeType: file.type || 'application/octet-stream',
  size: file.size,
  kind: file.type?.startsWith('video/') ? 'video' : 'image',
  duration: 0,
});

export const requestMediaPermissions = async () => ({ granted: true });
export const pickImage = async () => { const files = await openFilePicker('image/*'); return files[0] ? toAsset(files[0]) : null; };
export const pickVideo = async () => { const files = await openFilePicker('video/*'); return files[0] ? toAsset(files[0]) : null; };
export const pickMultipleImages = async () => (await openFilePicker('image/*', true)).map(toAsset);

export const validateFileSize = async (uri, maxSizeInMB = 50) => {
  try {
    if (!uri) return { isValid: false, sizeMB: 0, error: 'الملف غير موجود' };
    const file = typeof uri === 'string'
      ? await fetch(uri).then(async (response) => {
          if (!response.ok) throw new Error('تعذر قراءة الملف');
          return response.blob();
        })
      : uri;
    const size = Number(file?.size) || 0;
    if (!size) return { isValid: false, sizeMB: 0, error: 'الملف فارغ أو غير قابل للقراءة' };
    const sizeMB = size / (1024 * 1024);
    if (sizeMB > maxSizeInMB) return { isValid: false, sizeMB, error: `حجم الملف يتجاوز ${maxSizeInMB}MB` };
    return { isValid: true, sizeMB };
  } catch {
    return { isValid: false, sizeMB: 0, error: 'تعذر قراءة حجم الملف' };
  }
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

export const takePhoto = async () => {
  const files = await openFilePicker('image/*', false, true);
  return files[0] ? toAsset(files[0]) : null;
};

export const pickChatAttachment = async () => {
  const files = await openFilePicker('image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt');
  return files[0] ? toAsset(files[0]) : null;
};
