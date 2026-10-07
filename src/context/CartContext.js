import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { secureStorage as SecureStore } from '../utils/secureStorage';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const makeKey = (authId) => `cart_${authId || 'guest'}`;

export function CartProvider({ children }) {
  const { user } = useAuth();
  const storageKey = makeKey(user?.auth_id);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const persist = useCallback(async (items) => { await SecureStore.setItemAsync(storageKey, JSON.stringify(items)); }, [storageKey]);
  const calculateTotal = useCallback((items = cartItems) => items.reduce((sum, item) => sum + Number(item.line_total || 0), 0), [cartItems]);

  const addToCart = useCallback(async (product, quantity = 1, selectedOptions = {}) => {
    try {
      if (!product?.id || !product?.store_id && !product?.storeId) throw new Error('بيانات المنتج غير صحيحة');
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('الكمية غير صحيحة');
      const storeId = product.store_id || product.storeId;
      const unitPrice = Number(product.price) || 0;
      const snapshot = {
        title: product.title || product.name || '',
        imageUrl: Array.isArray(product.images) ? (product.images[0] || null) : (product.image || null),
        category: product.category || '',
      };
      const same = (item) => item.product_id === product.id && JSON.stringify(item.selected_options || {}) === JSON.stringify(selectedOptions || {});
      const existing = cartItems.findIndex(same);
      const next = [...cartItems];
      if (existing >= 0) {
        const newQty = Number(next[existing].quantity || 0) + quantity;
        next[existing] = { ...next[existing], quantity: newQty, line_total: newQty * next[existing].unit_price };
      } else {
        next.push({
          id: `cart-${product.id}-${Date.now()}`,
          product_id: product.id,
          store_id: storeId,
          quantity,
          unit_price: unitPrice,
          line_total: unitPrice * quantity,
          selected_options: selectedOptions || {},
          product_snapshot: snapshot,
        });
      }
      setCartItems(next); await persist(next); return { success:true, item:next[existing >= 0 ? existing : next.length - 1], total:calculateTotal(next) };
    } catch (err) { setError(err.message); return { success:false,error:err.message }; }
  }, [cartItems, calculateTotal, persist]);

  const updateCartItem = useCallback(async (itemId, quantity, selectedOptions = null) => {
    if (!itemId) return {success:false,error:'معرف العنصر مطلوب'};
    if (quantity !== undefined && (!Number.isInteger(quantity) || quantity <= 0)) return {success:false,error:'الكمية غير صحيحة'};
    const next = cartItems.map((item) => item.id===itemId ? {
      ...item,
      ...(quantity !== undefined ? { quantity, line_total: Number(item.unit_price || 0) * quantity } : {}),
      ...(selectedOptions !== null ? { selected_options: selectedOptions } : {}),
    } : item);
    if (!next.some((x)=>x.id===itemId)) return {success:false,error:'العنصر غير موجود في السلة'};
    setCartItems(next); await persist(next); return {success:true,total:calculateTotal(next)};
  }, [cartItems, calculateTotal, persist]);

  const removeFromCart = useCallback(async (itemId) => {
    const next = cartItems.filter((item)=>item.id!==itemId);
    setCartItems(next); await (next.length ? persist(next) : SecureStore.deleteItemAsync(storageKey)); return {success:true,total:calculateTotal(next)};
  }, [cartItems, calculateTotal, persist, storageKey]);

  const clearCart = useCallback(async () => { setCartItems([]); await SecureStore.deleteItemAsync(storageKey); return {success:true}; }, [storageKey]);

  const loadCart = useCallback(async () => {
    setLoading(true);
    try { const saved = await SecureStore.getItemAsync(storageKey); setCartItems(saved ? JSON.parse(saved) : []); }
    catch (err) { setError(err.message); setCartItems([]); }
    finally { setLoading(false); }
  }, [storageKey]);

  useEffect(()=>{ void loadCart(); },[loadCart]);

  const value = useMemo(()=>({
    cartItems, items:cartItems, loading, error,
    addToCart, addItem:addToCart,
    updateCartItem, updateQty:updateCartItem,
    removeFromCart, removeItem:removeFromCart, removeProductFromCart:async (productOrItemId)=>{ const next=cartItems.filter(i=>i.id!==productOrItemId && i.product_id!==productOrItemId); setCartItems(next); await (next.length?persist(next):SecureStore.deleteItemAsync(storageKey)); return {success:true}; },
    clearCart, loadCart,
    itemCount:cartItems.reduce((s,i)=>s+Number(i.quantity||0),0),
    getItemCount:()=>cartItems.reduce((s,i)=>s+Number(i.quantity||0),0),
    getTotalQuantity:()=>cartItems.reduce((s,i)=>s+Number(i.quantity||0),0),
    getCartTotal:()=>calculateTotal(),
    calculateTotal,
    groupItemsByStore:()=>cartItems.reduce((g,i)=>{(g[i.store_id] ||= []).push(i);return g;},{}),
    getStoreItems:(id)=>cartItems.filter(i=>i.store_id===id),
    getStoreTotal:(id)=>cartItems.filter(i=>i.store_id===id).reduce((s,i)=>s+Number(i.line_total||0),0),
    checkAvailability:(products)=>({isAvailable:cartItems.every(i=>products.some(p=>p.id===i.product_id && p.is_active!==false)),unavailableItems:cartItems.filter(i=>!products.some(p=>p.id===i.product_id && p.is_active!==false))}),
    prepareForCheckout:()=>cartItems,
  }),[addToCart,calculateTotal,cartItems,error,loadCart,removeFromCart,updateCartItem,clearCart,loading]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(){ const ctx=useContext(CartContext); if(!ctx) throw new Error('useCart must be used within CartProvider'); return ctx; }
export default CartContext;
