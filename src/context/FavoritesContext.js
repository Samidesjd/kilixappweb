import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const [favoriteIds, setFavoriteIds] = useState({});

  const toggleFavorite = useCallback((productId) => {
    setFavoriteIds((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

  const isFavorite = useCallback((productId) => !!favoriteIds[productId], [favoriteIds]);

  // useMemo لقيمة الـ Context لمنع إعادة رسم كل المكوّنات المستهلكة بلا داعٍ
  const value = useMemo(
    () => ({ favoriteIds, toggleFavorite, isFavorite }),
    [favoriteIds, toggleFavorite, isFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites لازم يُستعمل داخل FavoritesProvider');
  return ctx;
}
