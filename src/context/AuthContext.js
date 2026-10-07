import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabaseConfig';
import { secureStorage as SecureStore } from '../utils/secureStorage';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { FunctionsHttpError } from '@supabase/supabase-js';

const AuthContext = createContext(null);

const normalizePhone = (value) => String(value || '').replace(/\s+/g, '');
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userStore, setUserStore] = useState(null);

  const [pendingContact, setPendingContact] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [otpResendSeconds] = useState(60);

  const validateEmail = useCallback((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()), []);
  const validateAlgerianPhone = useCallback((phone) => /^(0|\+213)[1-9]\d{8}$/.test(normalizePhone(phone)), []);
  const validatePassword = useCallback((password) => {
    if (String(password || '').length < 6) return { isValid: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    return { isValid: true, message: 'كلمة المرور صالحة' };
  }, []);

  const loadProfileByAuthId = useCallback(async (authId) => {
    if (!authId || !isUuid(authId)) return null;
    const { data, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();
    if (profileError) throw profileError;
    setUser(data || null);

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', authId)
      .maybeSingle();
    if (storeError) throw storeError;
    setUserStore(storeData || null);
    return data || null;
  }, []);

  const hydrateSession = useCallback(async (nextSession) => {
    setSession(nextSession || null);
    if (!nextSession?.user?.id) {
      setUser(null);
      setUserStore(null);
      await SecureStore.deleteItemAsync('auth_token').catch(() => {});
      return null;
    }
    const profile = await loadProfileByAuthId(nextSession.user.id);
    await SecureStore.setItemAsync('auth_token', nextSession.access_token || '').catch(() => {});
    return profile;
  }, [loadProfileByAuthId]);

  const signUp = useCallback(async (email, password, firstName, lastName, phone) => {
    try {
      setLoading(true);
      setError(null);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedPhone = normalizePhone(phone);
      if (!validateEmail(normalizedEmail)) throw new Error('البريد الإلكتروني غير صحيح');
      if (!validatePassword(password).isValid) throw new Error(validatePassword(password).message);
      if (!firstName?.trim() || !lastName?.trim()) throw new Error('الاسم واللقب مطلوبان');
      if (!validateAlgerianPhone(normalizedPhone)) throw new Error('رقم الهاتف غير صحيح');

      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: normalizedPhone,
            account_type: 'buyer',
            country: 'DZ',
          },
        },
      });
      if (authError) throw authError;
      if (!data.user) throw new Error('تعذر إنشاء الحساب');

      setPendingContact({ type: 'email', value: normalizedEmail });
      setPendingMode('register');
      if (data.session) {
        await hydrateSession(data.session);
        setPendingContact(null);
        setPendingMode(null);
        return { success: true, user: data.user, needsConfirmation: false };
      }
      return { success: true, user: null, needsConfirmation: true, message: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لإكمال التسجيل.' };
    } catch (err) {
      setError(err?.message || 'فشل إنشاء الحساب');
      return { success: false, message: err?.message || 'فشل إنشاء الحساب' };
    } finally {
      setLoading(false);
    }
  }, [hydrateSession, validateAlgerianPhone, validateEmail, validatePassword]);

  const signIn = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!validateEmail(normalizedEmail)) throw new Error('البريد الإلكتروني غير صحيح');
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) {
        const rawMessage = String(authError.message || '');
        if (rawMessage.toLowerCase().includes('invalid login credentials')) {
          return { success: false, message: 'كلمة المرور خاطئة' };
        }
        throw authError;
      }
      const profile = await hydrateSession(data.session);
      if (!profile) throw new Error('تعذر تحميل ملف الحساب');
      return { success: true, user: profile, store: userStore };
    } catch (err) {
      setError(err?.message || 'فشل تسجيل الدخول');
      return { success: false, message: err?.message || 'فشل تسجيل الدخول' };
    } finally {
      setLoading(false);
    }
  }, [hydrateSession, validateEmail, userStore]);

  const deleteAccount = useCallback(async () => {
    try {
      if (!session?.user?.id || user?.isGuest) throw new Error('المستخدم غير مسجل دخول');
      setLoading(true);
      setError(null);
      const { data: result, error: functionError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {},
      });
      if (functionError) {
        if (functionError instanceof FunctionsHttpError) {
          let payload = null;
          try { payload = await functionError.context.json(); } catch {}
          throw new Error(payload?.message || payload?.code || functionError.message);
        }
        throw functionError;
      }
      if (!result?.success) {
        const detail = result?.stage || result?.code;
        throw new Error(detail ? `${result?.message || 'تعذر حذف الحساب'} (${detail})` : (result?.message || 'تعذر حذف الحساب'));
      }
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      await SecureStore.deleteItemAsync('auth_token').catch(() => {});
      // RPC deletes auth.users, which causes the Supabase session to become invalid.
      // Clear local state immediately as well so no personal data remains visible in the app.
      setUser(null);
      setSession(null);
      setUserStore(null);
      return { success: true };
    } catch (err) {
      setError(err?.message || 'تعذر حذف الحساب');
      return { success: false, message: err?.message || 'تعذر حذف الحساب' };
    } finally {
      setLoading(false);
    }
  }, [session, user]);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null); setSession(null); setUserStore(null);
      await SecureStore.deleteItemAsync('auth_token').catch(() => {});
      return { success: true };
    } catch (err) {
      setError(err?.message || 'تعذر تسجيل الخروج');
      return { success: false, message: err?.message || 'تعذر تسجيل الخروج' };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    try {
      if (!validateEmail(email)) throw new Error('البريد الإلكتروني غير صحيح');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(String(email).trim().toLowerCase());
      if (resetError) throw resetError;
      return { success: true };
    } catch (err) {
      setError(err?.message || 'تعذر إرسال رابط الاستعادة');
      return { success: false, message: err?.message || 'تعذر إرسال رابط الاستعادة' };
    }
  }, [validateEmail]);

  const updateUserProfile = useCallback(async (updates = {}) => {
    try {
      if (!user) throw new Error('المستخدم غير مسجل دخول');
      const source = updates && typeof updates === 'object' ? updates : {};
      const mapped = {};
      for (const key of ['email','first_name','last_name','phone','country','wilaya','commune','address','account_type','avatar_url']) {
        if (Object.prototype.hasOwnProperty.call(source, key)) mapped[key] = source[key];
      }
      if (Object.prototype.hasOwnProperty.call(source, 'firstName')) mapped.first_name = source.firstName;
      if (Object.prototype.hasOwnProperty.call(source, 'lastName')) mapped.last_name = source.lastName;
      if (Object.prototype.hasOwnProperty.call(source, 'phone')) mapped.phone = source.phone;
      if (Object.prototype.hasOwnProperty.call(source, 'name')) {
        const parts = String(source.name || '').trim().split(/\s+/);
        mapped.first_name = parts.shift() || '';
        mapped.last_name = parts.join(' ');
      }
      if (Object.prototype.hasOwnProperty.call(source, 'state')) mapped.wilaya = source.state;
      if (Object.prototype.hasOwnProperty.call(source, 'state_name')) mapped.wilaya = source.state_name;
      if (Object.prototype.hasOwnProperty.call(source, 'avatarUrl')) mapped.avatar_url = source.avatarUrl;
      delete mapped.auth_id;
      delete mapped.user_code;
      delete mapped.id;
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update(mapped)
        .eq('auth_id', user.auth_id)
        .select('*')
        .single();
      if (updateError) throw updateError;
      setUser(updated);
      return { success: true, user: updated };
    } catch (err) {
      setError(err?.message || 'تعذر تحديث الملف الشخصي');
      return { success: false, message: err?.message || 'تعذر تحديث الملف الشخصي' };
    }
  }, [user]);

  const updateUserAvatar = useCallback(async (fileBytesOrBlob) => {
    try {
      if (!user) throw new Error('المستخدم غير مسجل دخول');
      const path = `${user.auth_id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, fileBytesOrBlob, {
        contentType: 'image/jpeg', upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path);
      return updateUserProfile({ avatar_url: publicUrl.publicUrl });
    } catch (err) {
      setError(err?.message || 'تعذر تحديث الصورة');
      return { success: false, message: err?.message || 'تعذر تحديث الصورة' };
    }
  }, [updateUserProfile, user]);

  const getUserStore = useCallback(async () => {
    if (!user?.auth_id) return null;
    const { data, error: storeError } = await supabase.from('stores').select('*').eq('owner_id', user.auth_id).maybeSingle();
    if (storeError) throw storeError;
    setUserStore(data || null);
    return data || null;
  }, [user]);

  const verifyOtp = useCallback(async (token) => {
    try {
      if (!pendingContact?.value) throw new Error('لا يوجد رمز تحقق معلّق');
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingContact.value,
        token,
        type: 'email',
      });
      if (verifyError) throw verifyError;
      await hydrateSession(data.session);
      setPendingContact(null); setPendingMode(null);
      return true;
    } catch (err) {
      setError(err?.message || 'رمز التحقق غير صحيح');
      return false;
    }
  }, [hydrateSession, pendingContact]);

  const resendOtp = useCallback(async () => {
    try {
      if (!pendingContact?.value) throw new Error('لا يوجد بريد للتحقق');
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: pendingContact.value });
      if (resendError) throw resendError;
      return { success: true };
    } catch (err) {
      setError(err?.message || 'تعذر إعادة إرسال الرمز');
      return { success: false, message: err?.message || 'تعذر إعادة إرسال الرمز' };
    }
  }, [pendingContact]);

  const cancelOtp = useCallback(() => {
    setPendingContact(null); setPendingMode(null);
    setError(null);
  }, []);
  const clearAuthError = useCallback(() => setError(null), []);

  const continueAsGuest = useCallback(() => {
    setUser({ isGuest: true, auth_id: null, user_code: null });
    setSession(null);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const redirectTo = makeRedirectUri({ scheme: 'kilix' });
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error('تعذر إنشاء رابط تسجيل الدخول عبر Google');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        return { success: false, message: 'تم إلغاء تسجيل الدخول عبر Google' };
      }

      const callbackUrl = result.url;
      const queryStart = callbackUrl.indexOf('?');
      const hashStart = callbackUrl.indexOf('#');
      const queryText = queryStart >= 0 ? callbackUrl.slice(queryStart + 1, hashStart >= 0 ? hashStart : callbackUrl.length) : '';
      const hashText = hashStart >= 0 ? callbackUrl.slice(hashStart + 1) : '';
      const parseParams = (text) => {
        const out = {};
        text.split('&').forEach((part) => {
          if (!part) return;
          const [k, ...rest] = part.split('=');
          out[decodeURIComponent(k || '')] = decodeURIComponent(rest.join('=') || '');
        });
        return out;
      };
      const query = parseParams(queryText);
      const hash = parseParams(hashText);

      if (query.code) {
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(query.code);
        if (exchangeError) throw exchangeError;
        if (!exchanged?.session) throw new Error('تعذر إنشاء جلسة الحساب');
        await hydrateSession(exchanged.session);
        return { success: true, user: exchanged.user || exchanged.session.user };
      }

      if (hash.access_token && hash.refresh_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: hash.access_token,
          refresh_token: hash.refresh_token,
        });
        if (sessionError) throw sessionError;
        if (!sessionData?.session) throw new Error('تعذر تثبيت جلسة الحساب');
        await hydrateSession(sessionData.session);
        return { success: true, user: sessionData.user || sessionData.session.user };
      }

      throw new Error('لم تصل بيانات جلسة Google');
    } catch (err) {
      setError(err?.message || 'تعذر تسجيل الدخول عبر Google');
      return { success: false, message: err?.message || 'تعذر تسجيل الدخول عبر Google' };
    } finally {
      setLoading(false);
    }
  }, [hydrateSession]);

  useEffect(() => {
    let mounted = true;
    let authSubscription;
    (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (mounted && data.session) await hydrateSession(data.session);
      } catch (err) {
        if (mounted) setError(err?.message || 'تعذر تحميل جلسة الحساب');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const result = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
      if (nextSession?.user?.id) {
        void loadProfileByAuthId(nextSession.user.id).catch((err) => setError(err?.message || 'تعذر تحميل الحساب'));
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setUserStore(null);
      }
    });
    authSubscription = result.data?.subscription;
    return () => { mounted = false; authSubscription?.unsubscribe?.(); };
  }, [hydrateSession, loadProfileByAuthId]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    authLoading: loading,
    error,
    authError: error,
    userStore,
    isAuthenticated: !!session?.user && !user?.isGuest,
    initializing: loading,
    pendingContact,
    pendingMode,
    otpResendSeconds,
    signUp,
    signup: signUp,
    signIn,
    login: signIn,
    signOut,
    logout: signOut,
    deleteAccount,
    resetPassword,
    loadUserProfile: () => loadProfileByAuthId(session?.user?.id),
    updateUserProfile,
    updateProfile: updateUserProfile,
    updateUserAvatar,
    getUserStore,
    verifyOtp,
    resendOtp,
    cancelOtp,
    clearAuthError,
    continueAsGuest,
    loginWithGoogle,
    validateEmail,
    validateAlgerianPhone,
    validatePassword,
  }), [cancelOtp, clearAuthError, continueAsGuest, deleteAccount, error, getUserStore, loadProfileByAuthId, loginWithGoogle, loading, otpResendSeconds, pendingContact, pendingMode, resetPassword, resendOtp, session, signIn, signOut, signUp, updateUserAvatar, updateUserProfile, user, userStore, validateAlgerianPhone, validateEmail, validatePassword, verifyOtp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
