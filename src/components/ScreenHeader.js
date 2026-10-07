import { TText } from '../context/LanguageContext';
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, sizes } from '../theme/theme';

// Shared AppBar: back arrow on the right (RTL), centered title, optional right action.
export default function ScreenHeader({ title, showBack = true, rightAction, tintColor = colors.charcoalText, transparent = false }) {
  const navigation = useNavigation();

  return (
    <View style={[styles.container, transparent && { backgroundColor: 'transparent' }]}>
      <View style={styles.side}>
        {showBack && (
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
            <MaterialIcons name="arrow-forward" size={sizes.iconLg} color={tintColor} />
          </Pressable>
        )}
      </View>
      <TText style={[styles.title, { color: tintColor }]} numberOfLines={1}>
        {title}
      </TText>
      <View style={styles.side}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: sizes.headerHeight,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  side: {
    width: sizes.touchTarget,
    alignItems: 'center',
  },
  iconBtn: {
    padding: spacing.xs,
    minWidth: sizes.touchTarget - spacing.md,
    minHeight: sizes.touchTarget - spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.titleMd,
    flex: 1,
    textAlign: 'center',
  },
});
