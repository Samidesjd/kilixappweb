/**
 * 🛡️ Error Boundary - حدود معالجة الأخطاء
 * ─────────────────────────────────────────────────────
 * يمنع انهيار التطبيق الكامل عند حدوث خطأ غير متوقع
 * في أي مكان في شجرة المكونات
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    if (__DEV__) {
      console.error('❌ Error Boundary caught:', error);
      console.error('Stack:', errorInfo?.componentStack);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    if (this.props.onReload) {
      this.props.onReload();
    }
    this.handleReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onReload={this.handleReload}
          errorCount={this.state.errorCount}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * شاشة الخطأ الاحتياطية
 */
function ErrorFallback({
  error,
  errorInfo,
  onReset,
  onReload,
  errorCount,
}) {
  return (
    <SafeAreaView style={styles.container}>
      {/* الرأس */}
      <View style={styles.header}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>حدث خطأ غير متوقع</Text>
      </View>

      {/* الرسالة */}
      <View style={styles.content}>
        <Text style={styles.message}>
          للأسف، حدث شيء ما غير صحيح في التطبيق. يرجى المحاولة مرة أخرى.
        </Text>

        {/* عرض تفاصيل الخطأ في وضع التطوير فقط */}
        {__DEV__ && error && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorTitle}>📋 تفاصيل الخطأ:</Text>
            <Text style={styles.errorMessage} numberOfLines={5}>
              {error.toString()}
            </Text>

            {errorInfo?.componentStack && (
              <>
                <Text style={styles.errorTitle}>🔍 Stack:</Text>
                <Text
                  style={styles.errorStack}
                  numberOfLines={8}
                >
                  {errorInfo.componentStack}
                </Text>
              </>
            )}

            {errorCount > 1 && (
              <Text style={styles.warningText}>
                ⚠️ حدث هذا الخطأ {errorCount} مرات
              </Text>
            )}
          </View>
        )}
      </View>

      {/* الأزرار */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onReload}
        >
          <Text style={styles.buttonText}>🔄 إعادة محاولة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onReset}
        >
          <Text style={styles.secondaryButtonText}>العودة</Text>
        </TouchableOpacity>
      </View>

      {/* تنويه */}
      <Text style={styles.footer}>
        إذا استمرت المشكلة، يرجى الاتصال بفريق الدعم.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  emoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorDetails: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    padding: 12,
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f1d1d',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'Courier',
    lineHeight: 18,
    marginBottom: 12,
  },
  errorStack: {
    fontSize: 10,
    color: '#7f1d1d',
    fontFamily: 'Courier',
    lineHeight: 14,
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  footer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
});

export default ErrorBoundary;