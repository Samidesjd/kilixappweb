import { showLocalizedAlert } from '../context/LanguageContext';
/**
 * 🛡️ معالج أخطاء شامل وآمن
 * ─────────────────────────────────────────────────────
 * يتعامل مع جميع أنواع الأخطاء في التطبيق:
 * - أخطاء الشبكة (Network)
 * - أخطاء الخادم (Server)
 * - أخطاء التحقق (Validation)
 * - أخطاء التطبيق (Application)
 */

import {} from 'react-native';

// ─────────────────────────────────────────────────────────
// 🔍 تصنيف الأخطاء
// ─────────────────────────────────────────────────────────

export const ERROR_TYPES = {
  NETWORK: 'NETWORK',           // بدون إنترنت، timeout
  SERVER: 'SERVER',             // خطأ 5xx من السيرفر
  VALIDATION: 'VALIDATION',     // خطأ 400 - بيانات خاطئة
  AUTHENTICATION: 'AUTHENTICATION', // خطأ 401/403
  NOT_FOUND: 'NOT_FOUND',       // خطأ 404
  CONFLICT: 'CONFLICT',         // خطأ 409
  RATE_LIMIT: 'RATE_LIMIT',     // خطأ 429
  UNKNOWN: 'UNKNOWN',           // خطأ غير معروف
};

/**
 * تصنيف الخطأ وتحديد نوعه
 * @param {Error} error - الخطأ المراد تصنيفه
 * @returns {string} نوع الخطأ
 */
export function classifyError(error) {
  if (!error) return ERROR_TYPES.UNKNOWN;

  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || error?.status || 0;

  // ❌ أخطاء الشبكة
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('offline') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT'
  ) {
    return ERROR_TYPES.NETWORK;
  }

  // ❌ أخطاء التحقق (400)
  if (code === 400 || message.includes('validation')) {
    return ERROR_TYPES.VALIDATION;
  }

  // ❌ أخطاء المصادقة (401, 403)
  if (code === 401 || code === 403) {
    return ERROR_TYPES.AUTHENTICATION;
  }

  // ❌ خطأ غير موجود (404)
  if (code === 404) {
    return ERROR_TYPES.NOT_FOUND;
  }

  // ❌ تضارب (409)
  if (code === 409) {
    return ERROR_TYPES.CONFLICT;
  }

  // ⏱️ حد معدل الطلبات (429)
  if (code === 429) {
    return ERROR_TYPES.RATE_LIMIT;
  }

  // 🔥 أخطاء الخادم (5xx)
  if (code >= 500) {
    return ERROR_TYPES.SERVER;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * الحصول على رسالة خطأ عربية صديقة المستخدم
 * @param {Error} error - الخطأ
 * @param {string} context - سياق العملية (مثل 'جلب الطلبات')
 * @returns {string} رسالة خطأ عربية
 */
export function getUserFriendlyErrorMessage(error, context = '') {
  const errorType = classifyError(error);

  const messages = {
    [ERROR_TYPES.NETWORK]:
      'لا توجد اتصال بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.',
    [ERROR_TYPES.SERVER]:
      'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
    [ERROR_TYPES.VALIDATION]:
      'البيانات المُرسلة غير صحيحة. يرجى التحقق والمحاولة مرة أخرى.',
    [ERROR_TYPES.AUTHENTICATION]:
      'جلستك انتهت. يرجى تسجيل الدخول مرة أخرى.',
    [ERROR_TYPES.NOT_FOUND]:
      'المورد المطلوب غير موجود. يرجى المحاولة مرة أخرى.',
    [ERROR_TYPES.CONFLICT]:
      'هناك تضارب في البيانات. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
    [ERROR_TYPES.RATE_LIMIT]:
      'عدد الطلبات كثير جداً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.',
    [ERROR_TYPES.UNKNOWN]:
      'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.',
  };

  const baseMessage = messages[errorType] || messages[ERROR_TYPES.UNKNOWN];
  return context ? `${context}: ${baseMessage}` : baseMessage;
}

/**
 * يمكن إعادة محاولة الخطأ أم لا؟
 * @param {Error} error - الخطأ
 * @returns {boolean} هل يمكن إعادة محاولة
 */
export function isRetryableError(error) {
  const errorType = classifyError(error);

  // ✅ يمكن إعادة محاولة
  const retryable = [
    ERROR_TYPES.NETWORK,
    ERROR_TYPES.SERVER,
    ERROR_TYPES.RATE_LIMIT,
  ];

  return retryable.includes(errorType);
}

/**
 * 🔄 إعادة محاولة مع exponential backoff
 * @param {Function} fn - الدالة المراد تنفيذها
 * @param {number} maxRetries - عدد المحاولات (افتراضي: 3)
 * @param {number} initialDelay - التأخير الأولي بالميلي ثانية (افتراضي: 1000)
 * @returns {Promise<any>} النتيجة
 */
export async function retryWithBackoff(
  fn,
  maxRetries = 3,
  initialDelay = 1000
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // ❌ إذا كان الخطأ غير قابل للإعادة، توقف فوراً
      if (!isRetryableError(error)) {
        throw error;
      }

      // ⏳ إذا كانت هذه آخر محاولة، توقف
      if (attempt === maxRetries) {
        throw error;
      }

      // ⏱️ انتظر مع exponential backoff
      const delay = initialDelay * Math.pow(2, attempt - 1);
      if (__DEV__) {
        console.log(
          `[Retry] محاولة ${attempt}/${maxRetries} فشلت. الانتظار ${delay}ms...`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 🛡️ Wrapper آمن لاستدعاءات API
 * @param {Function} apiCall - دالة استدعاء API
 * @param {string} operationName - اسم العملية للتسجيل
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<{data: any, error: Error|null}>}
 */
export async function safeApiCall(
  apiCall,
  operationName = 'API Call',
  options = {}
) {
  const {
    maxRetries = 3,
    showAlert = false,
    logError = true,
  } = options;

  try {
    const data = await retryWithBackoff(apiCall, maxRetries);
    return { data, error: null };
  } catch (error) {
    const errorMessage = getUserFriendlyErrorMessage(error, operationName);

    if (logError) {
      console.error(`[${operationName}] Error:`, error);
    }

    if (showAlert) {
      showLocalizedAlert('خطأ', errorMessage, [
        { text: 'حسناً', onPress: () => {} },
      ]);
    }

    return { data: null, error };
  }
}

/**
 * 📝 تسجيل الخطأ في السيرفر
 * @param {string} context - السياق (مثل: 'DataContext.fetchOrders')
 * @param {Error} error - الخطأ
 * @param {Object} metadata - بيانات إضافية
 */
export async function logErrorToServer(
  context,
  error,
  metadata = {}
) {
  if (!__DEV__) {
    // يمكن إرسال إلى Sentry أو LogRocket هنا
    try {
      const errorData = {
        context,
        message: error?.message,
        stack: error?.stack,
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      // مثال: إرسال إلى خدمة logging مركزية
      // await fetch('https://your-logging-service.com/log', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData),
      // });
    } catch (err) {
      // تجاهل أخطاء التسجيل نفسه
      console.error('Failed to log error:', err);
    }
  }
}

/**
 * 🚨 عرض رسالة خطأ للمستخدم
 * @param {string} message - الرسالة
 * @param {string} title - العنوان (افتراضي: 'خطأ')
 */
export function showErrorAlert(
  message,
  title = 'خطأ'
) {
  showLocalizedAlert(title, message, [
    { text: 'حسناً', onPress: () => {} },
  ]);
}

/**
 * ⚡ معالج أخطاء سريع للـ catch blocks
 * @param {Error} error - الخطأ
 * @param {Object} options - الخيارات
 */
export function handleError(error, options = {}) {
  const {
    context = 'Unknown',
    showAlert = true,
    logToServer = false,
  } = options;

  const message = getUserFriendlyErrorMessage(error, context);

  if (logToServer) {
    logErrorToServer(context, error, options.metadata);
  }

  if (showAlert) {
    showErrorAlert(message);
  }

  if (__DEV__) {
    console.error(`[${context}]`, error);
  }

  return { message, error, retryable: isRetryableError(error) };
}

export default {
  ERROR_TYPES,
  classifyError,
  getUserFriendlyErrorMessage,
  isRetryableError,
  retryWithBackoff,
  safeApiCall,
  logErrorToServer,
  showErrorAlert,
  handleError,
};
