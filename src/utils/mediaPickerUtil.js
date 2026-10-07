import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

/**
 * Request permissions for media access
 */
export const requestMediaPermissions = async () => {
  try {
    // طلب إذن الوصول إلى مكتبة الصور
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return {
        granted: false,
        error: 'يتطلب إذن الوصول إلى معرض الصور. يرجى تفعيل الإذن من إعدادات التطبيق.',
      };
    }
    return { granted: true };
  } catch (error) {
    if (__DEV__) console.error('Error requesting media permissions:', error);
    return {
      granted: false,
      error: 'حدث خطأ أثناء طلب الإذن',
    };
  }
};

/**
 * Pick single image from device gallery
 * @returns {Promise<{uri: string, fileName: string, mimeType: string} | null>}
 */
export const pickImage = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // أو تمرير مصفوفة مباشرة,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        fileName: asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      };
    }

    return null;
  } catch (error) {
    if (__DEV__) console.error('Error picking image:', error);
    throw new Error('فشل في اختيار الصورة');
  }
};

/**
 * Pick single video from device gallery with size validation
 * @returns {Promise<{uri: string, fileName: string, mimeType: string, duration: number} | null>}
 */
export const pickVideo = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];

      // التحقق من حجم الملف
      const file = new File(asset.uri);
      const fileSizeInMB = (Number(file.size) || 0) / 1024 / 1024;

      if (fileSizeInMB > 50) {
        throw new Error(`حجم الفيديو (${fileSizeInMB.toFixed(2)}MB) يتجاوز الحد الأقصى (50MB)`);
      }

      return {
        uri: asset.uri,
        fileName: asset.uri.split('/').pop() || `video_${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        duration: asset.duration || 0,
      };
    }

    return null;
  } catch (error) {
    if (__DEV__) console.error('Error picking video:', error);
    throw error;
  }
};

/**
 * Pick multiple images from device gallery
 * @returns {Promise<Array<{uri: string, fileName: string, mimeType: string}>>}
 */
export const pickMultipleImages = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // أو تمرير مصفوفة مباشرة,
      allowsMultiple: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      return result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      }));
    }

    return [];
  } catch (error) {
    if (__DEV__) console.error('Error picking multiple images:', error);
    throw new Error('فشل في اختيار الصور');
  }
};

/**
 * Validate local file size
 * @param {string} fileUri - File URI
 * @param {number} maxSizeInMB - Maximum size in MB
 * @returns {Promise<{isValid: boolean, error?: string, sizeMB: number}>}
 */
export const validateFileSize = async (fileUri, maxSizeInMB = 50) => {
  try {
    const file = new File(fileUri);
    const sizeMB = (Number(file.size) || 0) / 1024 / 1024;

    if (sizeMB > maxSizeInMB) {
      return {
        isValid: false,
        sizeMB,
        error: `حجم الملف (${sizeMB.toFixed(2)}MB) يتجاوز الحد الأقصى (${maxSizeInMB}MB)`,
      };
    }

    return {
      isValid: true,
      sizeMB,
    };
  } catch (error) {
    if (__DEV__) console.error('Error validating file size:', error);
    return {
      isValid: false,
      sizeMB: 0,
      error: 'حدث خطأ أثناء التحقق من حجم الملف',
    };
  }
};

/**
 * Get readable file size string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string (e.g., "2.5MB")
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};


export const takePhoto = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('يتطلب إذن الكاميرا. يرجى تفعيل الإذن من إعدادات التطبيق.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  const size = Number(file.size) || 0;
  return { uri: asset.uri, fileName: asset.fileName || `photo_${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg', size, kind: 'image' };
};

export const pickChatAttachment = async () => {
  try {
    // محادثات Kilix تسمح بإرسال الصور فقط. الفيديو والملفات الأخرى غير متاحة هنا.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    const file = new File(asset.uri);
    const size = Number(file.size) || 0;
    const mime = String(asset.mimeType || file.type || 'image/jpeg').toLowerCase();

    if (!mime.startsWith('image/')) {
      throw new Error('يمكن إرسال الصور فقط في المحادثة.');
    }

    if (size > 10 * 1024 * 1024) {
      throw new Error('حجم الصورة يتجاوز الحد الأقصى 10MB');
    }

    return {
      uri: asset.uri,
      fileName: asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
      mimeType: mime,
      size,
      kind: 'image',
    };
  } catch (error) {
    if (__DEV__) console.error('Error picking chat image:', error);
    throw error;
  }
};
