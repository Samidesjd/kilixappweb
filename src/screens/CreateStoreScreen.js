import { TText, LTextInput, useLocalizedAlert, useLanguage } from '../context/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { createStoreService, getStoreByOwner, updateStoreService } from '../services/storeService';
import { createProduct, updateProduct, deleteProduct, getProducts, getProductCount } from '../services/productService';
import { getBillingSummary, getPaymentHistory, recordPayment, BILLING_THRESHOLD } from '../services/billingService';
import { merchantUpdateOrderStatus, getStoreOrders } from '../services/orderService';
import { setupTableListener } from '../services/Realtimeservice';
import { ORDER_STATUS } from '../constants/orderStatus';
import { pickImage, pickVideo, requestMediaPermissions, formatFileSize } from '../utils/mediaPickerUtil';
import { uploadImage, uploadVideo, uploadStoreLogo, validateMediaFile } from '../services/mediaUploadService';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Modal,
  Share,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const colors = {
  backgroundLight: '#F5F5F5',
  white: '#FFFFFF',
  charcoalText: '#1A1A1A',
  borderLight: '#E0E0E0',
  orangeVibrant: '#FF6B00',
  navyDeep: '#1A237E',
  outline: '#757575',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#E65100',
};

const PRODUCT_CATEGORY_OPTIONS = [
  { key: 'electronics', label: 'إلكترونيات' },
  { key: 'clothing', label: 'نسيج وملابس' },
  { key: 'home', label: 'أدوات منزلية' },
  { key: 'construction', label: 'بناء وإنشاء' },
  { key: 'other', label: 'أخرى' },
];

// خيارات نوع المنتج الظاهرة للتاجر. المفاتيح الجديدة مستقلة عن تصنيفات المتجر
// حتى لا نخلط بين نوع المنتج (template) وتصنيف المنتج (category).
const PRODUCT_TEMPLATES = [
  { key: 'women', label: 'للنساء' },
  { key: 'electronics', label: 'الإلكترونيات' },
  { key: 'fashion_accessories', label: 'إكسسوارات للأزياء' },
  { key: 'jewelry', label: 'المجوهرات' },
  { key: 'clothing_shoes', label: 'ملابس و أحذية' },
  { key: 'toys_hobbies', label: 'ألعاب وهوايات' },
  { key: 'security_protection', label: 'الأمن و الحماية' },
  { key: 'mothers_kids', label: 'الأمهات و الأطفال' },
  { key: 'beauty_health', label: 'الجمال والصحة' },
  { key: 'cars', label: 'للسيارات' },
];

const NEW_SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'];
const NEW_RAM_OPTIONS = ['4GB', '6GB', '8GB', '12GB', '16GB', '24GB', '32GB', '64GB'];
const NEW_STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '1TB SSD', '2TB', '4TB'];
const NEW_COLOR_OPTIONS = ['أبيض', 'أسود', 'أزرق', 'أزرق داكن', 'رمادي', 'فضي', 'ذهبي', 'أسود عسكري', 'أحمر', 'أحمر خمري', 'أخضر', 'أصفر', 'برتقالي', 'وردي', 'بنفسجي', 'بني', 'بيج', 'فيروزي', 'أزرق سماوي'];

// أسماء الأنواع القديمة تبقى مفهومة عند فتح منتج سبق إنشاؤه قبل هذا التعديل.
const LEGACY_TEMPLATE_LABELS = {
  clothing: 'أزياء وملابس',
  computer: 'حواسيب وأجهزة',
  phone: 'هواتف ذكية',
  watch: 'ساعات وإكسسوارات',
  home: 'أجهزة منزلية',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
};

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};

const screenWidth = Dimensions.get('window').width;

// روابط تحديث التطبيق الرسمية. Android يعتمد على package المشروع الحالي.
const ANDROID_APP_STORE_URL = 'https://play.google.com/store/search?q=Kilix&c=apps';
// يجب استبدال هذا الرابط بمعرّف تطبيق Kilix الفعلي في App Store عند نشر نسخة iOS.
const IOS_APP_STORE_URL = 'https://apps.apple.com/us/search?term=Kilix';

export default function CreateStoreScreen({ navigation }) {
  // ==================== جميع الـ States ====================
  
  const [currentScreen, setCurrentScreen] = useState('setup_store');
  const [checkingStore, setCheckingStore] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const localizedAlert = useLocalizedAlert();
  const { t } = useLanguage();

  // Store Setup States
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('wholesaler');
  const [storeProductsType, setStoreProductsType] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeLogoUri, setStoreLogoUri] = useState(null);
  const [uploadingStoreLogo, setUploadingStoreLogo] = useState(false);
  const [currency, setCurrency] = useState('دج');
  const [storeDocId, setStoreDocId] = useState(null);
  const [storeCode, setStoreCode] = useState('');

  // Products States
  const [products, setProducts] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const productOffsetRef = useRef(0);
  const productLoadingRef = useRef(false);

  // Orders States
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Refs for cleanup
  const ordersMapRef = useRef({});

  // Subscription & Usage States
  const [maxLimit, setMaxLimit] = useState(BILLING_THRESHOLD);
  const [currentUsage, setCurrentUsage] = useState(0); // accumulated fee
  const [outstandingFee, setOutstandingFee] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const openUpdateRequired = () => {
    setUpdateRequiredModalVisible(true);
  };

  const openUpdatePlatformChooser = () => {
    setUpdateRequiredModalVisible(false);
    setUpdatePlatformModalVisible(true);
  };

  const openStoreLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        alert('تعذر فتح متجر التطبيقات. يرجى المحاولة مرة أخرى.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] update store link error:', error);
      alert('تعذر فتح متجر التطبيقات.');
    } finally {
      setUpdatePlatformModalVisible(false);
    }
  };

  // Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [updateRequiredModalVisible, setUpdateRequiredModalVisible] = useState(false);
  const [updatePlatformModalVisible, setUpdatePlatformModalVisible] = useState(false);
  const [feeDetailsVisible, setFeeDetailsVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [confirmDeleteModalVisible, setConfirmDeleteModalVisible] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState(null);

  // New Product Form States
  const [newTemplate, setNewTemplate] = useState('clothing');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRam, setNewRam] = useState([]);
  const [newStorage, setNewStorage] = useState([]);
  const [newSizes, setNewSizes] = useState([]);
  const [newColors, setNewColors] = useState([]);
  const [customOptionModal, setCustomOptionModal] = useState({ visible: false, type: null, value: '' });
  const [newImages, setNewImages] = useState([]);
  const [newVideos, setNewVideos] = useState([]);
  const [newMinOrderQuantity, setNewMinOrderQuantity] = useState('1');
  const [newMaxOrderQuantity, setNewMaxOrderQuantity] = useState('1000000');
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('electronics');
  const [savingProduct, setSavingProduct] = useState(false);

  // Edit Product Form States
  const [editTemplate, setEditTemplate] = useState('clothing');
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRam, setEditRam] = useState([]);
  const [editStorage, setEditStorage] = useState([]);
  const [editSizes, setEditSizes] = useState([]);
  const [editColors, setEditColors] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editVideos, setEditVideos] = useState([]);
  const [editMinOrderQuantity, setEditMinOrderQuantity] = useState('1');
  const [editMaxOrderQuantity, setEditMaxOrderQuantity] = useState('1000000');
  const [editDropdownOpen, setEditDropdownOpen] = useState(false);
  const [editCategory, setEditCategory] = useState('electronics');

  // Media Upload States
  const [uploadingNewImages, setUploadingNewImages] = useState(false);
  const [uploadingNewVideos, setUploadingNewVideos] = useState(false);
  const [uploadingEditImages, setUploadingEditImages] = useState(false);
  const [uploadingEditVideos, setUploadingEditVideos] = useState(false);

  // Status Labels
  const ORDER_STATUS_LABELS = {
    [ORDER_STATUS.PENDING]: 'قيد الانتظار',
    [ORDER_STATUS.SHIPPING]: 'قيد الشحن',
    [ORDER_STATUS.DELIVERED]: 'تم الاستلام',
    [ORDER_STATUS.COMPLETED]: 'مكتمل',
    [ORDER_STATUS.OUT_OF_STOCK]: 'نفد المخزون',
    [ORDER_STATUS.CANCELLED]: 'ملغاة',
  };

  const mapMerchantOrder = (order) => ({
    id: order.id,
    customerId: order.customerId || null,
    customerName: order.customerName || '',
    phone: order.phone || '',
    status: ORDER_STATUS_LABELS[order.status] || order.status || 'قيد الانتظار',
    rawStatus: order.status || ORDER_STATUS.PENDING,
    title: order.title || '',
    quantity: Number(order.qty) || 0,
    total: Number(order.total) || 0,
    unitPrice: Number(order.unitPrice) || 0,
    currency: order.currency || 'دج',
    deliveryType: order.deliveryType || '',
    wilaya: order.wilaya || '',
    commune: order.commune || '',
    streetAddress: order.streetAddress || '',
    notes: order.notes || '',
    details: Array.isArray(order.details) ? order.details : [],
    created_at: order.date,
  });

  const formatOrderOptionValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) return value.join('، ');
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  };

  const getDeliveryTypeLabel = (deliveryType) => {
    if (deliveryType === 'office') return 'مكتب التوصيل';
    if (deliveryType === 'home') return 'البيت';
    return deliveryType || 'غير محدد';
  };

  function mapSupabaseProductDoc(product) {
    return {
      id: product.id,
      name: product.title || '',
      price: typeof product.price === 'number' ? String(product.price) : (product.price || ''),
      template: product.template || 'clothing',
      category: product.category || 'electronics',
      desc: product.description || '',
      description: product.description || '',
      ram: Array.isArray(product.ram) ? product.ram : [],
      storage: Array.isArray(product.storage) ? product.storage : [],
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      colors: Array.isArray(product.colors) ? product.colors : [],
      min_order_quantity: Number(product.min_order_quantity) || 1,
      max_order_quantity: Number(product.max_order_quantity) || 1000000,
      images: Array.isArray(product.images) ? product.images : [],
      videos: Array.isArray(product.videos) ? product.videos : [],
    };
  }

  const loadProductPage = async ({ reset = false, showLoader = true } = {}) => {
    if (!storeDocId) return;
    const offset = reset ? 0 : productOffsetRef.current;
    if (!reset && (productLoadingRef.current || loadingMoreProducts || !hasMoreProducts)) return;
    productLoadingRef.current = true;
    if (showLoader) setLoadingProducts(true);
    else setLoadingMoreProducts(true);
    try {
      const [rows, total] = await Promise.all([
        getProducts({ storeId: storeDocId, includeInactive: false, limit: 50, offset }),
        getProductCount({ storeId: storeDocId, includeInactive: false }),
      ]);
      const mapped = rows.map(mapSupabaseProductDoc);
      if (reset) {
        productOffsetRef.current = mapped.length;
        setProducts(mapped);
      } else {
        productOffsetRef.current += mapped.length;
        setProducts((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...mapped.filter((item) => !seen.has(item.id))];
        });
      }
      setProductCount(total);
      setHasMoreProducts(offset + mapped.length < total);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] products load error:', error);
      if (reset) setProducts([]);
    } finally {
      if (showLoader) setLoadingProducts(false);
      else setLoadingMoreProducts(false);
      productLoadingRef.current = false;
    }
  };

  // ==================== Effects ====================

  // فحص وجود المتجر عند فتح التطبيق
  useEffect(() => {
    const checkExistingStore = async () => {
      const userId = user?.auth_id;
      if (!userId) {
        setCheckingStore(false);
        return;
      }

      try {
        const storeData = await getStoreByOwner(userId);
        if (storeData) {
          setStoreDocId(storeData.id);
          setStoreCode(storeData.store_code || '');
          setStoreName(storeData.store_name || '');
          setStoreProductsType(storeData.products_type || '');
          setStoreDesc(storeData.description || '');
          setStoreType(storeData.merchant_type || 'wholesaler');
          setCurrentScreen('orders');
        }
      } catch (error) {
        console.log('Error checking store on start:', error);
      } finally {
        setCheckingStore(false);
      }
    };

    checkExistingStore();
  }, [user]);

  // جلب الاستحقاق المالي الحقيقي من قاعدة البيانات. لا توجد قيم تجريبية.
  useEffect(() => {
    if (!storeDocId) {
      setCurrentUsage(0);
      setOutstandingFee(0);
      setPaymentHistory([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]);
        if (!active) return;
        setCurrentUsage(Number(summary.accumulated_fee) || 0);
        setOutstandingFee(Number(summary.outstanding_fee) || 0);
        setMaxLimit(Number(summary.payment_threshold) || BILLING_THRESHOLD);
        setPaymentHistory(history || []);
      } catch (error) {
        if (__DEV__) console.error('[CreateStoreScreen] billing load error:', error);
        if (active) { setCurrentUsage(0); setOutstandingFee(0); setPaymentHistory([]); }
      }
    })();
    return () => { active = false; };
  }, [storeDocId]);

  // الاشتراك في طلبات المتجر - Real-time
  useEffect(() => {
    const currentStoreId = storeDocId;
    if (!currentStoreId) { setOrders([]); setLoadingOrders(false); return; }
    let active = true;
    const refreshOrders = async () => {
      try {
        setLoadingOrders(true);
        const rows = await getStoreOrders(currentStoreId);
        if (!active) return;
        const mapped = rows.map(mapMerchantOrder);
        setOrders(mapped);
        ordersMapRef.current = Object.fromEntries(mapped.map((row) => [row.id, row]));
      } catch (error) {
        if (__DEV__) console.error('[CreateStoreScreen] orders load error:', error);
        if (active) setOrders([]);
      } finally { if (active) setLoadingOrders(false); }
    };
    void refreshOrders();
    const unsubscribe = setupTableListener('orders', currentStoreId, refreshOrders);
    return () => { active = false; unsubscribe(); };
  }, [storeDocId]);

  // الاشتراك في منتجات المتجر - Real-time
  useEffect(() => {
    const currentStoreId = storeDocId;
    if (!currentStoreId) { setProducts([]); setLoadingProducts(false); return; }
    let active = true;
    const refreshProductsRealtime = async () => {
      if (!active) return;
      await loadProductPage({ reset: true, showLoader: false });
    };
    void loadProductPage({ reset: true, showLoader: true });
    const unsubscribe = setupTableListener('products', currentStoreId, refreshProductsRealtime);
    return () => { active = false; unsubscribe(); };
  }, [storeDocId]);

  // ==================== Helper Functions ====================


  const getTemplateBadgeText = (tmpl) => {
    const template = PRODUCT_TEMPLATES.find((t) => t.key === tmpl);
    if (template) return template.label;
    return LEGACY_TEMPLATE_LABELS[tmpl] || 'عام';
  };

  // ==================== Orders Management ====================

  const updateOrderStatus = async (orderId, newStatus, statusLabel) => {
    try {
      await merchantUpdateOrderStatus(orderId, newStatus);
      alert(`تم تحديث الطلبية إلى: ${statusLabel}`);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] order update error:', error);
      alert(error?.message || 'تعذّر تحديث الطلبية.');
    }
  };

  const handleConfirmOrder = (orderId) => {
    updateOrderStatus(orderId, ORDER_STATUS.SHIPPING, 'قيد الشحن');
  };

  const handleOutOfStockOrder = (orderId) => {
    updateOrderStatus(orderId, 'out_of_stock', 'نفد المخزون');
  };


  // ==================== Products Management ====================

  const openCustomOptionModal = (type) => setCustomOptionModal({ visible: true, type, value: '' });
  const closeCustomOptionModal = () => setCustomOptionModal({ visible: false, type: null, value: '' });
  const handleAddCustomOption = () => {
    const value = String(customOptionModal.value || '').trim();
    if (!value) return;
    const isEdit = String(customOptionModal.type || '').startsWith('edit-');
    const isSize = customOptionModal.type === 'size' || customOptionModal.type === 'edit-size';
    const isRam = customOptionModal.type === 'ram' || customOptionModal.type === 'edit-ram';
    const isStorage = customOptionModal.type === 'storage' || customOptionModal.type === 'edit-storage';
    const current = isEdit ? (isSize ? editSizes : isRam ? editRam : isStorage ? editStorage : editColors) : (isSize ? newSizes : isRam ? newRam : isStorage ? newStorage : newColors);
    const setter = isEdit ? (isSize ? setEditSizes : isRam ? setEditRam : isStorage ? setEditStorage : setEditColors) : (isSize ? setNewSizes : isRam ? setNewRam : isStorage ? setNewStorage : setNewColors);
    if (!current.some((item) => String(item).trim().toLowerCase() === value.toLowerCase())) {
      setter([...current, value]);
    }
    closeCustomOptionModal();
  };

  // Keep custom values visible in the selector immediately after adding them.
  // Fixed options are shown first, followed by any custom values already selected.
  const getVisibleOptions = (fixedOptions, selectedValues) => {
    const selected = Array.isArray(selectedValues) ? selectedValues : [];
    return [...fixedOptions, ...selected.filter((value) => !fixedOptions.some((fixed) => String(fixed).trim().toLowerCase() === String(value).trim().toLowerCase()))];
  };

  const handleAddNewProduct = async () => {
    if (!newName.trim() || !newPrice.trim() || !newDesc.trim()) { alert('يرجى إدخال اسم المنتج والسعر والوصف.'); return; }
    if (!storeDocId) { alert('يجب إنشاء المتجر أولاً.'); return; }
    const minOrder = Number(newMinOrderQuantity);
    const maxOrder = Number(newMaxOrderQuantity);
    if (!Number.isInteger(minOrder) || minOrder < 1 || !Number.isInteger(maxOrder) || maxOrder < minOrder) { alert('الحد الأدنى والحد الأقصى للطلب غير صالحين.'); return; }
    setSavingProduct(true);
    try {
      await createProduct(storeDocId, {
        title: newName.trim(), price: Number(newPrice), description: newDesc.trim(), category: newCategory, template: newTemplate,
        images: newImages, videos: newVideos, ram: newRam, storage: newStorage, sizes: newSizes, colors: newColors,
        min_order_quantity: Number(newMinOrderQuantity), max_order_quantity: Number(newMaxOrderQuantity),
      });
      setNewName(''); setNewPrice(''); setNewDesc(''); setNewCategory('electronics'); setNewTemplate('clothing');
      setNewRam([]); setNewStorage([]); setNewSizes([]); setNewColors([]); setNewImages([]); setNewVideos([]); setNewMinOrderQuantity('1'); setNewMaxOrderQuantity('1000000'); setAddModalVisible(false); setSuccessModalVisible(true);
    } catch (error) {
      if (__DEV__) console.error('Error publishing product:', error);
      alert(error.message || 'حدث خطأ أثناء نشر المنتج.');
    } finally { setSavingProduct(false); }
  };

  const handleSaveEditedProduct = async () => {
    if (!selectedProduct) return;
    const minOrder = Number(editMinOrderQuantity);
    const maxOrder = Number(editMaxOrderQuantity);
    if (!Number.isInteger(minOrder) || minOrder < 1 || !Number.isInteger(maxOrder) || maxOrder < minOrder) {
      alert('الحد الأدنى والحد الأقصى للطلب غير صالحين.');
      return;
    }
    try {
      await updateProduct(selectedProduct.id, { title: editName.trim(), price: Number(editPrice), description: editDesc.trim(), category: editCategory, template: editTemplate, images: editImages, videos: editVideos, ram: editRam, storage: editStorage, sizes: editSizes, colors: editColors, min_order_quantity: Number(editMinOrderQuantity), max_order_quantity: Number(editMaxOrderQuantity) });
      setEditModalVisible(false); setSelectedProduct(null); alert('تم تعديل المنتج بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error updating product:', error);
      alert(error.message || 'تعذّر حفظ التعديلات.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts((current) => current.filter((product) => product.id !== productId));
      setProductCount((count) => Math.max(0, count - 1));

      setConfirmDeleteModalVisible(false); setDeleteProductId(null); alert('تم حذف المنتج وإزالته من إدارة المخزن والعرض بنجاح.');
    } catch (error) {
      if (__DEV__) console.error('Error deleting product:', error);
      alert(error.message || 'تعذّر حذف المنتج.');
    }
  };

  const openEditModal = (item) => {
    setSelectedProduct(item);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditTemplate(item.template || 'clothing');
    setEditDesc(item.desc || '');
    setEditCategory(item.category || 'electronics');
    setEditRam(item.ram || []);
    setEditStorage(item.storage || []);
    setEditSizes(item.sizes || []);
    setEditColors(item.colors || []);
    setEditMinOrderQuantity(String(item.min_order_quantity || 1));
    setEditMaxOrderQuantity(String(item.max_order_quantity || 1000000));
    setEditImages(item.images || []);
    setEditVideos(item.videos || []);
    setEditModalVisible(true);
  };

  const handleShareProduct = async (item) => {
    try {
      await Share.share({
        message: `شاهد هذا المنتج المميز من متجري: ${item.name} - السعر: ${item.price} ${currency}. اطلبه الآن عبر التطبيق!`,
        title: item.name,
      });
    } catch (error) {
      alert('حدث خطأ أثناء محاولة المشاركة');
    }
  };

  // ==================== Media Upload ====================

  const handlePickAndUploadNewImages = async () => {
    try {
      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingNewImages(true);

      const imageData = await pickImage();
      if (!imageData) {
        setUploadingNewImages(false);
        return;
      }

      const validation = await validateMediaFile(imageData.uri, 'image', imageData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingNewImages(false);
        return;
      }

      const downloadURL = await uploadImage(imageData.uri, currentStoreId, null, imageData.mimeType);
      setNewImages([...newImages, downloadURL]);
      alert('تم رفع الصورة بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading new image:', error);
      alert(error.message || 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingNewImages(false);
    }
  };

  const handlePickAndUploadNewVideo = async () => {
    try {
      if (newVideos.length >= 1) {
        alert('يمكنك رفع فيديو واحد فقط لكل منتج.');
        return;
      }

      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingNewVideos(true);

      const videoData = await pickVideo();
      if (!videoData) {
        setUploadingNewVideos(false);
        return;
      }

      const validation = await validateMediaFile(videoData.uri, 'video', videoData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingNewVideos(false);
        return;
      }

      const downloadURL = await uploadVideo(videoData.uri, currentStoreId, null, videoData.mimeType);
      setNewVideos([downloadURL]);
      alert('تم رفع الفيديو بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading new video:', error);
      alert(error.message || 'فشل رفع الفيديو. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingNewVideos(false);
    }
  };

  const handlePickAndUploadEditImages = async () => {
    try {
      if (!selectedProduct) return;

      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingEditImages(true);

      const imageData = await pickImage();
      if (!imageData) {
        setUploadingEditImages(false);
        return;
      }

      const validation = await validateMediaFile(imageData.uri, 'image', imageData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingEditImages(false);
        return;
      }

      const downloadURL = await uploadImage(imageData.uri, currentStoreId, selectedProduct.id, imageData.mimeType);
      setEditImages([...editImages, downloadURL]);
      alert('تم رفع الصورة بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading edit image:', error);
      alert(error.message || 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingEditImages(false);
    }
  };

  const handlePickAndUploadEditVideo = async () => {
    try {
      if (!selectedProduct) return;

      if (editVideos.length >= 1) {
        alert('يمكنك رفع فيديو واحد فقط لكل منتج.');
        return;
      }

      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingEditVideos(true);

      const videoData = await pickVideo();
      if (!videoData) {
        setUploadingEditVideos(false);
        return;
      }

      const validation = await validateMediaFile(videoData.uri, 'video', videoData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingEditVideos(false);
        return;
      }

      const downloadURL = await uploadVideo(videoData.uri, currentStoreId, selectedProduct.id, videoData.mimeType);
      setEditVideos([downloadURL]);
      alert('تم رفع الفيديو بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading edit video:', error);
      alert(error.message || 'فشل رفع الفيديو. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingEditVideos(false);
    }
  };

  // ==================== Store Setup ====================

  const handlePickStoreLogo = async () => {
    try {
      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        localizedAlert('', permissionResult.error);
        return;
      }
      const imageData = await pickImage();
      if (!imageData?.uri) return;
      const validation = await validateMediaFile(imageData.uri, 'image', imageData.mimeType);
      if (!validation.isValid) {
        localizedAlert('', validation.error);
        return;
      }
      setStoreLogoUri(imageData.uri);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] store logo picker error:', error);
      localizedAlert('', error?.message || 'تعذر اختيار صورة المتجر.');
    }
  };

  const handleSaveStoreToDatabase = async () => {
    if (!storeName.trim() || !storeProductsType.trim()) { localizedAlert('', 'يرجى إدخال اسم المتجر ونوع المنتجات على الأقل.'); return; }
    const ownerId = user?.auth_id;
    if (!ownerId) { localizedAlert('', 'خطأ: لم يتم التعرف على المستخدم الحالي.'); return; }
    setLoading(true);
    try {
      const result = await createStoreService(ownerId, { storeName: storeName.trim(), productsType: storeProductsType.trim(), description: storeDesc.trim(), merchantType: storeType });
      if (!result.success) throw new Error(result.message);
      setStoreDocId(result.storeId);
      setStoreCode(result.storeCode);

      let logoWarning = '';
      if (storeLogoUri) {
        setUploadingStoreLogo(true);
        try {
          const logoUrl = await uploadStoreLogo(storeLogoUri, result.storeId);
          await updateStoreService(result.storeId, { logo_url: logoUrl });
        } catch (logoError) {
          logoWarning = '\n⚠️ تم إنشاء المتجر، لكن تعذر رفع صورة المتجر. يمكنك المحاولة لاحقاً.';
          if (__DEV__) console.error('[CreateStoreScreen] store logo upload error:', logoError);
        } finally {
          setUploadingStoreLogo(false);
        }
      }

      setStoreLogoUri(null);
      localizedAlert('', `✅ تم إنشاء متجرك بنجاح!\n📌 معرف البحث: ${result.storeCode}${logoWarning}`);
      setCurrentScreen('orders');
    } catch (error) {
      if (__DEV__) console.error('Error saving store:', error);
      localizedAlert('', error.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات.');
    } finally { setLoading(false); }
  };

  const handleBackNavigation = () => {
    if (currentScreen === 'inventory') {
      setCurrentScreen('orders');
    } else if (currentScreen === 'history') {
      setCurrentScreen('inventory');
    } else if (currentScreen === 'orders') {
      navigation.navigate('Main', { screen: 'حسابي' });
    } else {
      setCurrentScreen('setup_store');
    }
  };

  const refreshOrders = async () => {
    if (!storeDocId) return;
    try { setLoadingOrders(true); const rows = await getStoreOrders(storeDocId); const mapped = rows.map(mapMerchantOrder); setOrders(mapped); } catch (error) { if (__DEV__) console.error('[CreateStoreScreen] orders refresh error:', error); } finally { setLoadingOrders(false); }
  };
  const refreshProducts = async () => {
    await loadProductPage({ reset: true, showLoader: true });
  };

  const loadMoreProducts = async () => {
    await loadProductPage({ reset: false, showLoader: false });
  };
  const refreshBilling = async () => {
    if (!storeDocId) return;
    try { const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]); setCurrentUsage(Number(summary.accumulated_fee) || 0); setOutstandingFee(Number(summary.outstanding_fee) || 0); setMaxLimit(Number(summary.payment_threshold) || BILLING_THRESHOLD); setPaymentHistory(history || []); } catch (error) { if (__DEV__) console.error('[CreateStoreScreen] billing refresh error:', error); }
  };

  // ==================== Render Logic ====================

  if (checkingStore) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={colors.orangeVibrant} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen !== 'setup_store' && (
        <View style={styles.header}>
          <Pressable style={styles.headerIconBtn} onPress={handleBackNavigation}>
            <MaterialIcons name="arrow-forward" size={26} color={colors.charcoalText} />
          </Pressable>

          <TText style={styles.headerTitle}>{storeName}</TText>

          <Pressable style={styles.headerIconBtn} onPress={() => setDrawerOpen(!drawerOpen)}>
            <MaterialIcons name="menu" size={26} color={colors.charcoalText} />
          </Pressable>
        </View>
      )}

      {drawerOpen && (
        <View style={styles.drawer}>
          {[
            { key: 'orders', label: 'إدارة الطلبات', icon: 'shopping-bag' },
            { key: 'inventory', label: 'إدارة المخزون', icon: 'inventory' },
            { key: 'history', label: 'السجل', icon: 'history' },
          ].map((item) => (
            <Pressable
              key={item.key}
              style={styles.drawerItem}
              onPress={() => {
                setCurrentScreen(item.key);
                setDrawerOpen(false);
              }}
            >
              <MaterialIcons name={item.icon} size={20} color={colors.navyDeep} />
              <TText style={styles.drawerText}>{item.label}</TText>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flex: 1, padding: spacing.md }}>
        
        {currentScreen === 'setup_store' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
            <View style={styles.welcomeWrap}>
              <View style={styles.welcomeIconCircle}>
                <MaterialIcons name="store" size={48} color={colors.orangeVibrant} />
              </View>
              <TText style={styles.welcomeTitle}>إنشاء متجرك الجديد</TText>
              <TText style={styles.welcomeSub}>
                أدخل تفاصيل متجرك أدناه للبدء في إدارة الطلبات والمخزون بكل احترافية.
              </TText>

              <View style={[styles.card, { width: '100%', alignItems: 'stretch' }]}>
                <TText style={styles.sectionHeader}>بيانات المتجر الأساسية</TText>
                
                <TText style={styles.label}>صورة بروفايل المتجر (اختيارية)</TText>
                <View style={styles.storeLogoSetupCard}>
                  <View style={styles.storeLogoPreview}>
                    {storeLogoUri ? (
                      <Image source={{ uri: storeLogoUri }} style={styles.storeLogoPreviewImage} />
                    ) : (
                      <MaterialIcons name="storefront" size={38} color={colors.orangeVibrant} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <TText style={styles.storeLogoHint}>ستظهر هذه الصورة للمستخدمين في صفحة المنتج وصفحة تفاصيل المتجر.</TText>
                    <Pressable style={styles.uploadBtn} onPress={handlePickStoreLogo} disabled={uploadingStoreLogo}>
                      <MaterialIcons name="add-a-photo" size={18} color={colors.charcoalText} />
                      <TText style={styles.uploadBtnText}>{storeLogoUri ? 'تغيير الصورة' : 'رفع صورة بروفايل'}</TText>
                    </Pressable>
                  </View>
                </View>

                <TText style={styles.label}>اسم المتجر</TText>
                <LTextInput
                  style={styles.input}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="أدخل اسم المتجر"
                  placeholderTextColor={colors.outline}
                />

                <TText style={styles.label}>نوع المنتجات التي يبيعها المتجر</TText>
                <LTextInput
                  style={styles.input}
                  value={storeProductsType}
                  onChangeText={setStoreProductsType}
                  placeholder="مثال: أزياء وملابس، هواتف ذكية..."
                  placeholderTextColor={colors.outline}
                />

                <TText style={styles.label}>نوع النشاط التجاري</TText>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Pressable
                    style={[styles.uploadBtn, { flex: 1 }, storeType === 'wholesaler' && { borderColor: colors.orangeVibrant, backgroundColor: '#FFF3E0' }]}
                    onPress={() => setStoreType('wholesaler')}
                  >
                    <TText style={[styles.uploadBtnText, storeType === 'wholesaler' && { color: colors.orangeVibrant }]}>بائع جملة</TText>
                  </Pressable>
                  <Pressable
                    style={[styles.uploadBtn, { flex: 1 }, storeType === 'factory' && { borderColor: colors.orangeVibrant, backgroundColor: '#FFF3E0' }]}
                    onPress={() => setStoreType('factory')}
                  >
                    <TText style={[styles.uploadBtnText, storeType === 'factory' && { color: colors.orangeVibrant }]}>مصنع</TText>
                  </Pressable>
                </View>

                <TText style={styles.label}>وصف للمتجر</TText>
                <LTextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  value={storeDesc}
                  onChangeText={setStoreDesc}
                  placeholder="اكتب وصفاً موجزاً عن متجرك..."
                  placeholderTextColor={colors.outline}
                />

                <Pressable 
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]} 
                  onPress={handleSaveStoreToDatabase}
                  disabled={loading || uploadingStoreLogo}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <TText style={styles.primaryBtnText}>استمرار</TText>
                      <MaterialIcons name="arrow-forward" size={18} color={colors.white} />
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {currentScreen === 'orders' && (
          <View style={{ flex: 1 }}>
            <TText style={styles.sectionHeader}>{t(`إدارة ومتابعة الطلبات (${orders.length})`)}</TText>
            
            {loadingOrders ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.orangeVibrant} />
              </View>
            ) : orders.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialIcons name="shopping-bag" size={48} color={colors.borderLight} />
                <TText style={{ marginTop: spacing.md, color: colors.outline }}>لا توجد طلبات حالياً</TText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={loadingOrders} onRefresh={refreshOrders} />} >
                {orders.map((order) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <TText style={styles.orderId}>{order.id}</TText>
                      <TText style={[
                        styles.orderStatus, 
                        order.rawStatus === ORDER_STATUS.COMPLETED ? styles.statusGreen : 
                        order.status === 'نفد المخزون' ? styles.statusRed : styles.statusOrange
                      ]}>
                        {order.status}
                      </TText>
                    </View>
                    <TText style={styles.customerName}>الزبون: {order.customerName}</TText>
                    <TText style={styles.orderSubText}>رقم الهاتف: {order.phone}</TText>

                    <View style={[styles.orderActionRow, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs }]}>
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        {order.rawStatus === ORDER_STATUS.PENDING && (
                          <Pressable style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => handleConfirmOrder(order.id)}>
                            <MaterialIcons name="check" size={16} color={colors.white} />
                            <TText style={styles.actionBtnText}>تأكيد</TText>
                          </Pressable>
                        )}
                        
                        {order.rawStatus === ORDER_STATUS.PENDING && (
                          <Pressable style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={() => handleOutOfStockOrder(order.id)}>
                            <MaterialIcons name="inventory" size={16} color={colors.white} />
                            <TText style={styles.actionBtnText}>نفد</TText>
                          </Pressable>
                        )}
                      </View>

                      <Pressable style={styles.actionBtn} onPress={() => setSelectedOrder(order)}>
                        <MaterialIcons name="visibility" size={16} color={colors.white} />
                        <TText style={styles.actionBtnText}>التفاصيل</TText>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {currentScreen === 'inventory' && (
          <View style={{ flex: 1 }}>
            <TText style={styles.sectionHeader}>{t(`إدارة المخزون والمنتجات (${productCount})`)}</TText>
            
            {loadingProducts ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.orangeVibrant} />
              </View>
            ) : products.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialIcons name="inventory" size={48} color={colors.borderLight} />
                <TText style={{ marginTop: spacing.md, color: colors.outline }}>لا توجد منتجات حالياً</TText>
              </View>
            ) : (
              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={loadingProducts} onRefresh={refreshProducts} />}
                onEndReached={loadMoreProducts}
                onEndReachedThreshold={0.55}
                ListFooterComponent={loadingMoreProducts ? <View style={{ paddingVertical: 18 }}><ActivityIndicator size="small" color={colors.orangeVibrant} /></View> : null}
                renderItem={({ item }) => (
                  <View key={item.id} style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <TText style={styles.orderId} numberOfLines={1}>{item.id}</TText>
                      <TText style={styles.productBadge}>{getTemplateBadgeText(item.template)}</TText>
                    </View>
                    <TText style={styles.customerName}>{item.name}</TText>
                    <TText style={styles.orderSubText}>السعر: <TText style={styles.boldText}>{item.price} {currency}</TText></TText>
                    
                    {item.desc ? <TText style={[styles.orderSubText, { marginTop: 4 }]} numberOfLines={2}>{item.desc}</TText> : null}

                    <View style={[styles.orderActionRow, { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }]}>
                      <Pressable style={[styles.actionBtn, { backgroundColor: colors.orangeVibrant }]} onPress={() => handleShareProduct(item)}>
                        <MaterialIcons name="share" size={16} color={colors.white} />
                        <TText style={styles.actionBtnText}>مشاركة</TText>
                      </Pressable>

                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        <Pressable style={styles.actionBtn} onPress={() => openEditModal(item)}>
                          <MaterialIcons name="edit" size={16} color={colors.white} />
                          <TText style={styles.actionBtnText}>تعديل</TText>
                        </Pressable>
                        <Pressable 
                          style={[styles.actionBtn, { backgroundColor: colors.error }]} 
                          onPress={() => {
                            setDeleteProductId(item.id);
                            setConfirmDeleteModalVisible(true);
                          }}
                        >
                          <MaterialIcons name="delete" size={16} color={colors.white} />
                          <TText style={styles.actionBtnText}>حذف</TText>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              />
            )}

            <Pressable style={styles.floatingAddBtn} onPress={() => {
              setNewName('');
              setNewPrice('');
              setNewDesc('');
              setNewCategory('electronics');
              setNewTemplate('clothing');
              setNewRam([]);
              setNewStorage([]);
              setNewSizes([]);
              setNewColors([]);
              setNewMinOrderQuantity('1');
              setNewMaxOrderQuantity('1000000');
              setNewImages([]);
              setNewVideos([]);
              setAddModalVisible(true);
            }}>
              <MaterialIcons name="add" size={22} color={colors.white} />
              <TText style={styles.floatingAddBtnText}>إضافة منتج</TText>
            </Pressable>
          </View>
        )}

        {currentScreen === 'history' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={loadingOrders} onRefresh={refreshOrders} />} >
            <TText style={styles.sectionHeader}>{t(`سجل المعاملات والطلبات (${orders.length})`)}</TText>
            <TText style={styles.cardSub}>اضغط على أي معاملة لعرض التفاصيل الكاملة.</TText>

            {orders.length === 0 ? (
              <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl }}>
                <MaterialIcons name="history" size={48} color={colors.borderLight} />
                <TText style={{ marginTop: spacing.md, color: colors.outline }}>لا توجد معاملات حالياً</TText>
              </View>
            ) : (
              orders.map((order) => (
                <Pressable 
                  key={order.id} 
                  style={styles.historyCard}
                  onPress={() => setSelectedOrder(order)}
                >
                  <View style={styles.historyRow}>
                    <TText style={styles.historyId}>{order.id} - {order.customerName}</TText>
                    <TText style={[
                      styles.orderStatus, 
                      order.rawStatus === ORDER_STATUS.COMPLETED ? styles.statusGreen : 
                      order.status === 'نفد المخزون' ? styles.statusRed : styles.statusOrange
                    ]}>
                      {order.status}
                    </TText>
                  </View>
                  <View style={styles.historyDetailsRow}>
                    <TText style={styles.historyText}>الهاتف: {order.phone}</TText>
                    <TText style={[styles.historyText, { color: colors.orangeVibrant, fontWeight: 'bold' }]}>عرض التفاصيل</TText>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* ==================== Modals ==================== */}

      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TText style={styles.modalTitle}>تعديل بيانات المنتج</TText>

              <TText style={styles.label}>نموذج المنتج</TText>
              <Pressable style={styles.dropdownSelector} onPress={() => setEditDropdownOpen(!editDropdownOpen)}>
                <TText style={styles.dropdownText}>{getTemplateBadgeText(editTemplate)}</TText>
                <MaterialIcons name="arrow-drop-down" size={24} color={colors.charcoalText} />
              </Pressable>
              {editDropdownOpen && (
                <View style={styles.dropdownList}>
                  {PRODUCT_TEMPLATES.map((item) => (
                    <Pressable
                      key={item.key}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setEditTemplate(item.key);
                        setEditDropdownOpen(false);
                      }}
                    >
                      <TText style={styles.dropdownItemText}>{item.label}</TText>
                    </Pressable>
                  ))}
                </View>
              )}

              <TText style={styles.label}>اسم المنتج</TText>
              <LTextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="اسم المنتج"
                placeholderTextColor={colors.outline}
              />

              <TText style={styles.label}>السعر الأساسي (دج)</TText>
              <LTextInput
                style={styles.input}
                keyboardType="numeric"
                value={editPrice}
                onChangeText={setEditPrice}
                placeholder="0"
                placeholderTextColor={colors.outline}
              />

              <TText style={styles.label}>وصف المنتج</TText>
              <LTextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="وصف المنتج"
                placeholderTextColor={colors.outline}
              />

              <TText style={styles.label}>تصنيف المنتج</TText>
              <View style={styles.chipsRow}>
                {PRODUCT_CATEGORY_OPTIONS.map((c) => {
                  const selected = editCategory === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setEditCategory(c.key)}
                    >
                      <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{c.label}</TText>
                    </Pressable>
                  );
                })}
              </View>

              {(editTemplate === 'computer' || editTemplate === 'phone' || editTemplate === 'electronics') && (
                <>
                  <TText style={styles.label}>خيارات الرام (RAM)</TText>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_RAM_OPTIONS, editRam).map((r) => {
                      const selected = editRam.includes(r);
                      return (
                        <Pressable
                          key={r}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setEditRam(editRam.filter((x) => x !== r));
                            else setEditRam([...editRam, r]);
                          }}
                        >
                          <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{r}</TText>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('ram')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <TText style={styles.addOptionText}>إضافة RAM مخصص</TText>
                  </Pressable>

                  <TText style={styles.label}>سعات التخزين</TText>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_STORAGE_OPTIONS, newStorage).map((s) => {
                      const selected = editStorage.includes(s);
                      return (
                        <Pressable
                          key={s}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setEditStorage(editStorage.filter((x) => x !== s));
                            else setEditStorage([...editStorage, s]);
                          }}
                        >
                          <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</TText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('edit-storage')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <TText style={styles.addOptionText}>إضافة تخزين مخصص</TText>
                  </Pressable>
                </>
              )}

              {(editTemplate === 'clothing' || editTemplate === 'women' || editTemplate === 'clothing_shoes' || editTemplate === 'mothers_kids') && (
                <>
                  <TText style={styles.label}>الأحجام المتوفرة</TText>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_SIZE_OPTIONS, editSizes).map((sz) => {
                      const selected = editSizes.includes(sz);
                      return (
                        <Pressable
                          key={sz}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setEditSizes(editSizes.filter((x) => x !== sz));
                            else setEditSizes([...editSizes, sz]);
                          }}
                        >
                          <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{sz}</TText>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('edit-size')}>
                      <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                      <TText style={styles.addOptionText}>إضافة مقاس</TText>
                    </Pressable>
                  </View>
                </>
              )}

              <TText style={styles.label}>الألوان المتوفرة</TText>
              <View style={styles.chipsRow}>
                {getVisibleOptions(NEW_COLOR_OPTIONS, editColors).map((c) => {
                  const selected = editColors.includes(c);
                  return (
                    <Pressable
                      key={c}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => {
                        if (selected) setEditColors(editColors.filter((x) => x !== c));
                        else setEditColors([...editColors, c]);
                      }}
                    >
                      <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</TText>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('edit-color')}>
                  <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                  <TText style={styles.addOptionText}>إضافة لون</TText>
                </Pressable>
              </View>

              <TText style={[styles.label, { marginTop: spacing.md }]}>الحد الأدنى للطلب</TText>
              <LTextInput
                style={styles.input}
                placeholder="مثال: 1"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={editMinOrderQuantity}
                onChangeText={setEditMinOrderQuantity}
              />

              <TText style={styles.label}>الحد الأقصى للطلب</TText>
              <LTextInput
                style={styles.input}
                placeholder="مثال: 100"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={editMaxOrderQuantity}
                onChangeText={setEditMaxOrderQuantity}
              />

              <TText style={[styles.label, { marginTop: spacing.md }]}>رفع الصور والفيديوهات</TText>
              <View style={styles.mediaContainer}>
                {editImages.map((img, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="image" size={24} color={colors.orangeVibrant} />
                    <TText style={styles.mediaThumbText}>{`صورة ${idx + 1}`}</TText>
                    <Pressable onPress={() => setEditImages(editImages.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
                {editVideos.map((vid, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="videocam" size={24} color={colors.navyDeep} />
                    <TText style={styles.mediaThumbText}>{`فيديو ${idx + 1}`}</TText>
                    <Pressable onPress={() => setEditVideos(editVideos.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <Pressable 
                  style={[styles.uploadBtn, { flex: 1 }, uploadingEditImages && { opacity: 0.6 }]} 
                  onPress={handlePickAndUploadEditImages}
                  disabled={uploadingEditImages}
                >
                  <MaterialIcons name="add-photo-alternate" size={18} color={colors.orangeVibrant} />
                  <TText style={styles.uploadBtnText}>{uploadingEditImages ? 'جارٍ الرفع...' : 'رفع صورة'}</TText>
                </Pressable>
                <View style={[styles.uploadBtn, { flex: 1, opacity: 0.6 }]} >
                  <MaterialIcons name="video-call" size={18} color={colors.navyDeep} />
                  <TText style={styles.uploadBtnText}>الفيديوهات — متاح قريبًا</TText>
                </View>
              </View>

              <Pressable style={styles.primaryBtn} onPress={handleSaveEditedProduct}>
                <TText style={styles.primaryBtnText}>حفظ التعديلات</TText>
              </Pressable>

              <Pressable style={styles.closeModalBtn} onPress={() => {
                setEditModalVisible(false);
                setSelectedProduct(null);
              }}>
                <TText style={styles.closeModalText}>إلغاء</TText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={addModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TText style={styles.modalTitle}>إضافة منتج جديد</TText>

              <TText style={styles.label}>نموذج المنتج</TText>
              <Pressable style={styles.dropdownSelector} onPress={() => setNewDropdownOpen(!newDropdownOpen)}>
                <TText style={styles.dropdownText}>{getTemplateBadgeText(newTemplate)}</TText>
                <MaterialIcons name="arrow-drop-down" size={24} color={colors.charcoalText} />
              </Pressable>
              {newDropdownOpen && (
                <View style={styles.dropdownList}>
                  {PRODUCT_TEMPLATES.map((item) => (
                    <Pressable
                      key={item.key}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setNewTemplate(item.key);
                        setNewDropdownOpen(false);
                      }}
                    >
                      <TText style={styles.dropdownItemText}>{item.label}</TText>
                    </Pressable>
                  ))}
                </View>
              )}

              <TText style={styles.label}>اسم المنتج</TText>
              <LTextInput
                style={styles.input}
                placeholder="أدخل اسم المنتج"
                placeholderTextColor={colors.outline}
                value={newName}
                onChangeText={setNewName}
              />

              <TText style={styles.label}>السعر الأساسي (دج)</TText>
              <LTextInput
                style={styles.input}
                placeholder="مثال: 3500"
                placeholderTextColor={colors.outline}
                keyboardType="numeric"
                value={newPrice}
                onChangeText={setNewPrice}
              />

              <TText style={styles.label}>وصف المنتج (اختياري)</TText>
              <LTextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="تفاصيل إضافية عن المنتج..."
                placeholderTextColor={colors.outline}
                multiline
                value={newDesc}
                onChangeText={setNewDesc}
              />

              <TText style={styles.label}>تصنيف المنتج</TText>
              <View style={styles.chipsRow}>
                {PRODUCT_CATEGORY_OPTIONS.map((c) => {
                  const selected = newCategory === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setNewCategory(c.key)}
                    >
                      <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{c.label}</TText>
                    </Pressable>
                  );
                })}
              </View>

              {(newTemplate === 'computer' || newTemplate === 'phone' || newTemplate === 'electronics') && (
                <>
                  <TText style={styles.label}>خيارات الرام (RAM)</TText>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_RAM_OPTIONS, newRam).map((r) => {
                      const selected = newRam.includes(r);
                      return (
                        <Pressable
                          key={r}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setNewRam(newRam.filter((x) => x !== r));
                            else setNewRam([...newRam, r]);
                          }}
                        >
                          <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{r}</TText>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('ram')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <TText style={styles.addOptionText}>إضافة RAM مخصص</TText>
                  </Pressable>

                  <TText style={styles.label}>سعات التخزين</TText>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_STORAGE_OPTIONS, newStorage).map((s) => {
                      const selected = newStorage.includes(s);
                      return (
                        <Pressable
                          key={s}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setNewStorage(newStorage.filter((x) => x !== s));
                            else setNewStorage([...newStorage, s]);
                          }}
                        >
                          <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</TText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('storage')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <TText style={styles.addOptionText}>إضافة تخزين مخصص</TText>
                  </Pressable>
                </>
              )}

              {(newTemplate === 'clothing' || newTemplate === 'women' || newTemplate === 'clothing_shoes' || newTemplate === 'mothers_kids') && (
                <>
                  <TText style={styles.label}>الأحجام المتوفرة</TText>
              <View style={styles.chipsRow}>
                {getVisibleOptions(NEW_SIZE_OPTIONS, newSizes).map((sz) => {
                  const selected = newSizes.includes(sz);
                  return (
                    <Pressable key={sz} style={[styles.chip, selected && styles.chipSelected]} onPress={() => {
                      if (selected) setNewSizes(newSizes.filter((x) => x !== sz));
                      else setNewSizes([...newSizes, sz]);
                    }}>
                      <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{sz}</TText>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('size')}>
                  <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                  <TText style={styles.addOptionText}>إضافة مقاس</TText>
                </Pressable>
              </View>
                </>
              )}

              <TText style={styles.label}>الألوان المتوفرة</TText>
              <View style={styles.chipsRow}>
                {getVisibleOptions(NEW_COLOR_OPTIONS, newColors).map((c) => {
                  const selected = newColors.includes(c);
                  return (
                    <Pressable key={c} style={[styles.chip, selected && styles.chipSelected]} onPress={() => {
                      if (selected) setNewColors(newColors.filter((x) => x !== c));
                      else setNewColors([...newColors, c]);
                    }}>
                      <TText style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</TText>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('color')}>
                  <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                  <TText style={styles.addOptionText}>إضافة لون</TText>
                </Pressable>
              </View>

              <TText style={[styles.label, { marginTop: spacing.md }]}>الحد الأدنى للطلب</TText>
              <LTextInput
                style={styles.input}
                placeholder="مثال: 1"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={newMinOrderQuantity}
                onChangeText={setNewMinOrderQuantity}
              />

              <TText style={styles.label}>الحد الأقصى للطلب</TText>
              <LTextInput
                style={styles.input}
                placeholder="مثال: 100"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={newMaxOrderQuantity}
                onChangeText={setNewMaxOrderQuantity}
              />

              <TText style={[styles.label, { marginTop: spacing.md }]}>رفع الصور والفيديوهات</TText>
              <View style={styles.mediaContainer}>
                {newImages.map((img, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="image" size={24} color={colors.orangeVibrant} />
                    <TText style={styles.mediaThumbText}>{`صورة ${idx + 1}`}</TText>
                    <Pressable onPress={() => setNewImages(newImages.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
                {newVideos.map((vid, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="videocam" size={24} color={colors.navyDeep} />
                    <TText style={styles.mediaThumbText}>{`فيديو ${idx + 1}`}</TText>
                    <Pressable onPress={() => setNewVideos(newVideos.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <Pressable 
                  style={[styles.uploadBtn, { flex: 1 }, uploadingNewImages && { opacity: 0.6 }]} 
                  onPress={handlePickAndUploadNewImages}
                  disabled={uploadingNewImages}
                >
                  <MaterialIcons name="add-photo-alternate" size={18} color={colors.orangeVibrant} />
                  <TText style={styles.uploadBtnText}>{uploadingNewImages ? 'جارٍ الرفع...' : 'رفع صورة'}</TText>
                </Pressable>
                <View style={[styles.uploadBtn, { flex: 1, opacity: 0.6 }]} >
                  <MaterialIcons name="video-call" size={18} color={colors.navyDeep} />
                  <TText style={styles.uploadBtnText}>الفيديوهات — متاح قريبًا</TText>
                </View>
              </View>

              <Pressable
                style={[styles.primaryBtn, savingProduct && { opacity: 0.6 }]}
                onPress={handleAddNewProduct}
                disabled={savingProduct}
              >
                <TText style={styles.primaryBtnText}>{savingProduct ? 'جارٍ النشر...' : 'حفظ المنتج'}</TText>
              </Pressable>

              <Pressable style={styles.closeModalBtn} onPress={() => setAddModalVisible(false)}>
                <TText style={styles.closeModalText}>إلغاء</TText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

            <Modal visible={customOptionModal.visible} animationType="fade" transparent={true} onRequestClose={closeCustomOptionModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.optionModalContent}>
            <TText style={styles.modalTitle}>إضافة {(['size','edit-size'].includes(customOptionModal.type) ? 'مقاس' : ['ram','edit-ram'].includes(customOptionModal.type) ? 'RAM' : ['storage','edit-storage'].includes(customOptionModal.type) ? 'سعة تخزين' : 'لون')} جديد</TText>
            <LTextInput
              style={styles.input}
              placeholder={(['size','edit-size'].includes(customOptionModal.type) ? 'مثال: 6XL أو 56' : ['ram','edit-ram'].includes(customOptionModal.type) ? 'مثال: 128GB' : ['storage','edit-storage'].includes(customOptionModal.type) ? 'مثال: 2TB' : 'مثال: تركوازي فاتح')}
              placeholderTextColor={colors.outline}
              value={customOptionModal.value}
              onChangeText={(value) => setCustomOptionModal((prev) => ({ ...prev, value }))}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={handleAddCustomOption}>
                <TText style={styles.primaryBtnText}>إضافة</TText>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.outline }]} onPress={closeCustomOptionModal}>
                <TText style={styles.primaryBtnText}>إلغاء</TText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={feeDetailsVisible} animationType="fade" transparent={true} onRequestClose={() => setFeeDetailsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.feeDetailsModal}>
            <View style={styles.feeDetailsHeader}>
              <MaterialIcons name="percent" size={24} color={colors.orangeVibrant} />
              <TText style={styles.modalTitle}>كيفية حساب الرسوم</TText>
            </View>

            <TText style={styles.feeDetailsIntro}>
              تُحسب الرسوم بنسبة 0.3% من قيمة المنتجات التي تم بيعها فقط.
            </TText>

            <View style={styles.feeFormulaBox}>
              <TText style={styles.feeFormulaTitle}>طريقة الحساب</TText>
              <TText style={styles.feeFormulaText}>قيمة المنتجات × 0.003 = الرسوم</TText>
            </View>

            <View style={styles.feeExampleBox}>
              <TText style={styles.feeExampleTitle}>مثال 1</TText>
              <TText style={styles.feeExampleText}>
                قيمة المنتجات المباعة: <TText style={styles.boldText}>100,000 دج</TText>
              </TText>
              <TText style={styles.feeExampleText}>
                أي <TText style={styles.boldText}>10,000,000 سنتيم</TText>
              </TText>
              <TText style={styles.feeExampleText}>
                الرسوم: <TText style={styles.boldText}>300 دج</TText> = <TText style={styles.boldText}>30,000 سنتيم</TText>
              </TText>
            </View>

            <View style={styles.feeExampleBox}>
              <TText style={styles.feeExampleTitle}>مثال 2</TText>
              <TText style={styles.feeExampleText}>
                قيمة المنتجات المباعة: <TText style={styles.boldText}>200,000 دج</TText>
              </TText>
              <TText style={styles.feeExampleText}>
                أي <TText style={styles.boldText}>20,000,000 سنتيم</TText>
              </TText>
              <TText style={styles.feeExampleText}>
                الرسوم: <TText style={styles.boldText}>600 دج</TText> = <TText style={styles.boldText}>60,000 سنتيم</TText>
              </TText>
            </View>

            <View style={styles.feeExampleBox}>
              <TText style={styles.feeExampleTitle}>مثال 3</TText>
              <TText style={styles.feeExampleText}>
                قيمة المنتجات المباعة: <TText style={styles.boldText}>1,000,000 دج</TText>
              </TText>
              <TText style={styles.feeExampleText}>
                أي <TText style={styles.boldText}>100,000,000 سنتيم</TText>
              </TText>
              <TText style={styles.feeExampleText}>
                الرسوم: <TText style={styles.boldText}>3,000 دج</TText> = <TText style={styles.boldText}>300,000 سنتيم</TText>
              </TText>
            </View>

            <TText style={styles.feeDetailsNote}>
              يتم احتساب الرسوم بنفس النسبة دائمًا: <TText style={styles.boldText}>0.3%</TText> من قيمة المنتجات المباعة.
            </TText>

            <Pressable style={styles.closeModalBtn} onPress={() => setFeeDetailsVisible(false)}>
              <TText style={styles.closeModalText}>إغلاق</TText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={updateRequiredModalVisible} animationType="fade" transparent={true} onRequestClose={() => setUpdateRequiredModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF3E8', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="system-update" size={30} color={colors.orangeVibrant} />
              </View>
            </View>
            <TText style={[styles.modalTitle, { textAlign: 'center' }]}>قم بتحديث التطبيق</TText>
            <TText style={[styles.cardSub, { textAlign: 'center', lineHeight: 22 }]}>قم بتحديث التطبيق للاستمرار في الاستفادة من الخدمات وإتمام الدفع.</TText>
            <Pressable style={[styles.primaryBtn, { marginTop: spacing.md }]} onPress={openUpdatePlatformChooser}>
              <MaterialIcons name="system-update-alt" size={18} color={colors.white} />
              <TText style={styles.primaryBtnText}>تحديث التطبيق</TText>
            </Pressable>
            <Pressable style={styles.closeModalBtn} onPress={() => setUpdateRequiredModalVisible(false)}>
              <TText style={styles.closeModalText}>إلغاء</TText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={updatePlatformModalVisible} animationType="fade" transparent={true} onRequestClose={() => setUpdatePlatformModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TText style={[styles.modalTitle, { textAlign: 'center' }]}>اختر نوع جهازك</TText>
            <TText style={[styles.cardSub, { textAlign: 'center', lineHeight: 22 }]}>سيتم نقلك مباشرة إلى صفحة Kilix في متجر التطبيقات.</TText>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Pressable style={styles.dropdownSelector} onPress={() => openStoreLink(ANDROID_APP_STORE_URL)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialIcons name="android" size={22} color="#3DDC84" />
                  <TText style={styles.dropdownText}>Android - Google Play</TText>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
              <Pressable style={styles.dropdownSelector} onPress={() => openStoreLink(IOS_APP_STORE_URL)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialIcons name="phone-iphone" size={22} color={colors.charcoalText} />
                  <TText style={styles.dropdownText}>iPhone - App Store</TText>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
            </View>
            <Pressable style={styles.closeModalBtn} onPress={() => setUpdatePlatformModalVisible(false)}>
              <TText style={styles.closeModalText}>إلغاء</TText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={invoiceModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TText style={styles.modalTitle}>دفع الرصيد المستحق</TText>
            <TText style={styles.cardSub}>
              اختر وسيلة الدفع المناسبة لإتمام التسوية.
            </TText>
            <View style={{ marginVertical: spacing.md, gap: spacing.sm }}>
              <Pressable style={[styles.dropdownSelector, (paymentLoading || outstandingFee < BILLING_THRESHOLD) && { opacity: 0.5 }]} disabled={paymentLoading || outstandingFee < BILLING_THRESHOLD} onPress={async () => {
                try {
                  if (outstandingFee < BILLING_THRESHOLD) return;
                  openUpdateRequired();
                  return;

                  const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]);
                  setCurrentUsage(Number(summary.accumulated_fee) || 0);
                  setOutstandingFee(Number(summary.outstanding_fee) || 0);
                  setPaymentHistory(history || []);
                  setInvoiceModalVisible(false);
                  alert('تم تسجيل الدفعة في سجل المدفوعات.');
                } catch (error) { alert(error?.message || 'تعذر تسجيل الدفعة.'); }
                finally { setPaymentLoading(false); }
              }}>
                <TText style={styles.dropdownText}>بريدي موب (BaridiMob)</TText>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
              <Pressable style={[styles.dropdownSelector, (paymentLoading || outstandingFee < BILLING_THRESHOLD) && { opacity: 0.5 }]} disabled={paymentLoading || outstandingFee < BILLING_THRESHOLD} onPress={async () => {
                try {
                  if (outstandingFee < BILLING_THRESHOLD) return;
                  openUpdateRequired();
                  return;

                  const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]);
                  setCurrentUsage(Number(summary.accumulated_fee) || 0);
                  setOutstandingFee(Number(summary.outstanding_fee) || 0);
                  setPaymentHistory(history || []);
                  setInvoiceModalVisible(false);
                  alert('تم تسجيل الدفعة في سجل المدفوعات.');
                } catch (error) { alert(error?.message || 'تعذر تسجيل الدفعة.'); }
                finally { setPaymentLoading(false); }
              }}>
                <TText style={styles.dropdownText}>البطاقة الذهبية (Dahabia)</TText>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
            </View>
            <Pressable style={styles.closeModalBtn} onPress={() => setInvoiceModalVisible(false)}>
              <TText style={styles.closeModalText}>إلغاء</TText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmDeleteModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={[styles.deleteIconCircle, { backgroundColor: '#FFEBEE' }]}>
              <MaterialIcons name="warning" size={36} color={colors.error} />
            </View>
            <TText style={styles.deleteModalTitle}>حذف المنتج؟</TText>
            <TText style={styles.deleteModalSub}>
              هل أنت متأكد من رغبتك في حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.
            </TText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.error }]} onPress={() => {
                handleDeleteProduct(deleteProductId);
              }}>
                <TText style={styles.primaryBtnText}>حذف</TText>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.outline }]} onPress={() => setConfirmDeleteModalVisible(false)}>
                <TText style={styles.primaryBtnText}>إلغاء</TText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={successModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={[styles.deleteIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="check-circle" size={36} color={colors.success} />
            </View>
            <TText style={styles.deleteModalTitle}>تمت إضافة المنتج بنجاح</TText>
            <TText style={styles.deleteModalSub}>
              أصبح منتجك الجديد متاحاً الآن في المخزون وجاهزاً لاستقبال الطلبات.
            </TText>
            <Pressable style={[styles.primaryBtn, { marginTop: spacing.lg }]} onPress={() => setSuccessModalVisible(false)}>
              <TText style={styles.primaryBtnText}>حسناً</TText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedOrder !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.sm }}>
                <TText style={styles.modalTitle}>تفاصيل الطلبية {selectedOrder.id}</TText>

                <TText style={styles.detailText}>الاسم: <TText style={styles.boldText}>{selectedOrder.customerName || 'غير متوفر'}</TText></TText>
                <TText style={styles.detailText}>رقم الهاتف: <TText style={styles.boldText}>{selectedOrder.phone || 'غير متوفر'}</TText></TText>
                <TText style={styles.detailText}>الولاية: <TText style={styles.boldText}>{selectedOrder.wilaya || 'غير متوفرة'}</TText></TText>
                <TText style={styles.detailText}>البلدية: <TText style={styles.boldText}>{selectedOrder.commune || 'غير متوفرة'}</TText></TText>
                <TText style={styles.detailText}>طريقة التوصيل: <TText style={styles.boldText}>{getDeliveryTypeLabel(selectedOrder.deliveryType)}</TText></TText>
                {selectedOrder.deliveryType === 'home' ? (
                  <TText style={styles.detailText}>عنوان البيت: <TText style={styles.boldText}>{selectedOrder.streetAddress || 'غير متوفر'}</TText></TText>
                ) : (
                  <TText style={styles.detailText}>نقطة التسليم: <TText style={styles.boldText}>مكتب التوصيل في البلدية المحددة</TText></TText>
                )}
                <TText style={styles.detailText}>الملاحظة: <TText style={styles.boldText}>{selectedOrder.notes || 'لا توجد ملاحظة'}</TText></TText>
                <TText style={styles.detailText}>الحالة: <TText style={styles.boldText}>{selectedOrder.status}</TText></TText>
                <TText style={styles.detailText}>المجموع: <TText style={styles.boldText}>{selectedOrder.total || 0} {selectedOrder.currency || 'دج'}</TText></TText>
                <TText style={styles.detailText}>إجمالي الكمية: <TText style={styles.boldText}>{selectedOrder.quantity || 0}</TText></TText>

                <TText style={[styles.label, { marginTop: spacing.md }]}>المجموعات المطلوبة ({selectedOrder.details?.length || 0}):</TText>
                {selectedOrder.details && selectedOrder.details.length > 0 ? (
                  selectedOrder.details.map((item, idx) => {
                    const optionEntries = Object.entries(item.options || {}).filter(([, value]) => formatOrderOptionValue(value));
                    return (
                      <View key={`${selectedOrder.id}-group-${idx}`} style={styles.orderGroupCard}>
                        <View style={styles.orderGroupHeader}>
                          <TText style={styles.orderGroupTitle}>المجموعة {idx + 1}</TText>
                          <TText style={styles.orderGroupQuantity}>الكمية: {item.quantity || 0}</TText>
                        </View>
                        <TText style={styles.boldText}>{item.title || selectedOrder.title || 'المنتج'}</TText>
                        {optionEntries.length > 0 ? (
                          <View style={{ marginTop: spacing.xs }}>
                            {optionEntries.map(([key, value]) => (
                              <TText key={`${selectedOrder.id}-${idx}-${key}`} style={styles.orderSubText}>
                                {key}: <TText style={styles.boldText}>{formatOrderOptionValue(value)}</TText>
                              </TText>
                            ))}
                          </View>
                        ) : (
                          <TText style={[styles.orderSubText, { marginTop: spacing.xs }]}>بدون خيارات إضافية</TText>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <TText style={styles.orderSubText}>لا توجد تفاصيل مجموعات محفوظة لهذه الطلبية.</TText>
                )}

                <Pressable
                  style={[styles.primaryBtn, { marginTop: spacing.lg }]}
                  onPress={() => setSelectedOrder(null)}
                >
                  <TText style={styles.primaryBtnText}>إغلاق</TText>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerIconBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.charcoalText,
    textAlign: 'center',
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 60,
    right: spacing.md,
    width: 240,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    zIndex: 100,
    ...cardShadow,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  drawerText: {
    fontSize: 14,
    color: colors.charcoalText,
    fontWeight: '500',
  },
  welcomeWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  welcomeIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.charcoalText,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeSub: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.orangeVibrant,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.xs,
    width: '100%',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.charcoalText,
  },
  cardSub: {
    fontSize: 13,
    color: colors.outline,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.navyDeep,
    flex: 1,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOrange: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },
  statusGreen: {
    backgroundColor: '#E8F5E9',
    color: colors.success,
  },
  statusRed: {
    backgroundColor: '#FFEBEE',
    color: colors.error,
  },
  customerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: 2,
  },
  orderSubText: {
    fontSize: 13,
    color: colors.outline,
  },
  orderActionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyDeep,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    gap: 4,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  orderGroupCard: {
    backgroundColor: '#F8F9FA',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  orderGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  orderGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoalText,
  },
  orderGroupQuantity: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.orangeVibrant,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.charcoalText,
    flex: 1,
  },
  historyDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  historyText: {
    fontSize: 12,
    color: colors.outline,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  boldText: {
    fontWeight: 'bold',
    color: colors.charcoalText,
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: colors.orangeVibrant,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.xs,
    ...cardShadow,
    zIndex: 10,
  },
  floatingAddBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.orangeVibrant,
    borderRadius: radius.pill,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressTextValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.charcoalText,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.outline,
  },
  feeNoticeCard: {
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#FFD9B3',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  feeNoticeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  feeNoticeTextWrap: {
    flex: 1,
  },
  feeNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    marginBottom: 4,
  },
  feeNoticeText: {
    fontSize: 14,
    color: colors.charcoalText,
    lineHeight: 21,
  },
  feeDetailsBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  feeDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orangeVibrant,
  },
  feeDetailsModal: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    ...cardShadow,
  },
  feeDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  feeDetailsIntro: {
    fontSize: 14,
    color: colors.charcoalText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  feeFormulaBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  feeFormulaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    marginBottom: 6,
    textAlign: 'center',
  },
  feeFormulaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.orangeVibrant,
    textAlign: 'center',
  },
  feeExampleBox: {
    backgroundColor: '#FFF8F1',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  feeExampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.orangeVibrant,
    marginBottom: 6,
  },
  feeExampleText: {
    fontSize: 13,
    color: colors.charcoalText,
    lineHeight: 21,
  },
  feeDetailsNote: {
    fontSize: 12,
    color: colors.outline,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
    ...cardShadow,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.charcoalText,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.charcoalText,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  dropdownText: {
    fontSize: 14,
    color: colors.charcoalText,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  dropdownItem: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.charcoalText,
  },
  closeModalBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    padding: spacing.sm,
  },
  closeModalText: {
    color: colors.outline,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteModalContent: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...cardShadow,
  },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  deleteModalSub: {
    fontSize: 13,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  productBadge: {
    fontSize: 12,
    backgroundColor: '#E3F2FD',
    color: '#1565C0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    fontWeight: '600',
  },
  detailText: {
    fontSize: 13,
    color: colors.outline,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: '#FAFAFA',
  },
  chipSelected: {
    backgroundColor: colors.orangeVibrant,
    borderColor: colors.orangeVibrant,
  },
  chipText: {
    fontSize: 12,
    color: colors.charcoalText,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: 'bold',
  },
  addOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.orangeVibrant,
    borderStyle: 'dashed',
    backgroundColor: '#FFF6EF',
  },
  addOptionText: { fontSize: 12, color: colors.orangeVibrant, fontWeight: 'bold' },
  optionModalContent: { width: '92%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 18, padding: spacing.lg },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  mediaThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 6,
  },
  mediaThumbText: {
    fontSize: 12,
    color: colors.charcoalText,
    maxWidth: 100,
  },
  storeLogoSetupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    backgroundColor: '#FAFAFA',
  },
  storeLogoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  storeLogoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  storeLogoHint: {
    fontSize: 12,
    color: colors.outline,
    lineHeight: 18,
    marginBottom: 6,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.charcoalText,
  },
});