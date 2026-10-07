import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { useData } from '../context/DataContext';

export default function CategoriesScreen({ navigation }) {
  const { categories } = useData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="تصنيفات المنتجات" />
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        numColumns={2}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        columnWrapperStyle={{ gap: spacing.md }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('Main', { screen: 'الرئيسية', params: { categoryId: item.id } })}
          >
            <View style={styles.iconWrap}>
              <MaterialIcons name={item.icon} size={26} color={colors.charcoalText} />
            </View>
            <TText style={styles.name}>{item.name}</TText>
            <TText style={styles.subCount}>{item.subcategories.length} أقسام فرعية</TText>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { ...cardShadow.level1, flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, alignItems: 'flex-end', gap: 4 },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  name: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  subCount: { ...typography.bodySm, color: colors.outline, textAlign: 'right' },
});
