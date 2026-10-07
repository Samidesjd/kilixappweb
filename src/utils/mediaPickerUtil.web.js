const openFilePicker = (accept = 'image/*', multiple = false, capture = false) => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = accept; input.multiple = multiple;
  if (capture) input.setAttribute('capture', 'environment');
  input.onchange = () => resolve(Array.from(input.files || []));
  input.click();
});

const toAsset = (file) => ({ uri: URL.createObjectURL(file), fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, kind: file.type?.startsWith('video/') ? 'video' : 'image', duration: 0 });

export const requestMediaPermissions = async () => ({ granted: true });
export const pickImage = async () => { const files = await openFilePicker('image/*'); return files[0] ? toAsset(files[0]) : null; };
export const pickVideo = async () => { const files = await openFilePicker('video/*'); return files[0] ? toAsset(files[0]) : null; };
export const pickMultipleImages = async () => (await openFilePicker('image/*', true)).map(toAsset);
export const validateFileSize = async (uri, maxSizeInMB = 50) => ({ isValid: true, sizeMB: 0 });
export const formatFileSize = (bytes) => { if (!bytes) return '0 Bytes'; const k=1024, sizes=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return `${Math.round((bytes/Math.pow(k,i))*100)/100} ${sizes[i]}`; };
export const takePhoto = async () => { const files = await openFilePicker('image/*', false, true); return files[0] ? toAsset(files[0]) : null; };
export const pickChatAttachment = async () => { const files = await openFilePicker('image/*'); return files[0] ? toAsset(files[0]) : null; };
