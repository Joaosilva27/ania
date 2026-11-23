import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { getRecipeImage } from '@/assets/recipeImages';
import { colors, radius } from '@/theme';
import type { Recipe } from '@/types';

export function RecipeImage({
  recipe,
  style,
  contentFit = 'cover',
  priority = 'normal',
}: {
  recipe: Pick<Recipe, 'imageKey' | 'imageUrl' | 'title'>;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  priority?: 'low' | 'normal' | 'high';
}) {
  const source = getRecipeImage(recipe.imageKey, recipe.imageUrl);

  if (!source) {
    return (
      <View
        style={[styles.fallback, style as StyleProp<ViewStyle>]}
        accessibilityLabel={`${recipe.title} image unavailable`}
      >
        <MaterialCommunityIcons name="silverware-fork-knife" size={26} color={colors.primaryDeep} />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      transition={220}
      cachePolicy="memory-disk"
      priority={priority}
      accessibilityLabel={recipe.title}
      placeholderContentFit="cover"
      placeholder={{ blurhash: 'L9F5,}00~q~qM{ofRjWB00t7xuWC' }}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
});
