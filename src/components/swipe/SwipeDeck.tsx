import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, shadows, spacing, type } from '@/theme';

export interface SwipeDeckHandle {
  swipe: (decision: 'yes' | 'no') => void;
}

interface SwipeDeckProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T, decision?: 'yes' | 'no') => React.ReactNode;
  onDecide: (item: T, decision: 'yes' | 'no') => void;
  renderEmpty?: () => React.ReactNode;
  yesLabel?: string;
  noLabel?: string;
}

function SwipeDeckInner<T>(
  {
    items,
    keyExtractor,
    renderCard,
    onDecide,
    renderEmpty,
    yesLabel = 'Yes',
    noLabel = 'No',
  }: SwipeDeckProps<T>,
  ref: React.ForwardedRef<SwipeDeckHandle>,
) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const locked = useRef(false);
  const signature = items.map(keyExtractor).join('|');

  useEffect(() => {
    setIndex(0);
    locked.current = false;
    translateX.value = 0;
    translateY.value = 0;
    // Reset only when the actual content of the deck changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const current = items[index];
  const next = items[index + 1];

  const advance = useCallback(
    (item: T, decision: 'yes' | 'no') => {
      setIndex((current) => current + 1);
      translateX.value = 0;
      translateY.value = 0;
      locked.current = false;
      onDecide(item, decision);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDecide],
  );

  const forceSwipe = useCallback(
    (decision: 'yes' | 'no') => {
      if (locked.current || !items[index]) return;
      locked.current = true;
      const target = decision === 'yes' ? width * 1.5 : -width * 1.5;
      translateX.value = withTiming(target, { duration: 240 }, (finished) => {
        if (finished && items[index]) {
          runOnJS(advance)(items[index], decision);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advance, index, items, width],
  );

  useImperativeHandle(ref, () => ({ swipe: forceSwipe }), [forceSwipe]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      if (locked.current) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.35;
    })
    .onEnd((event) => {
      if (locked.current) return;
      const threshold = width * 0.26;
      if (event.translationX > threshold || event.velocityX > 1000) {
        runOnJS(forceSwipe)('yes');
      } else if (event.translationX < -threshold || event.velocityX < -1000) {
        runOnJS(forceSwipe)('no');
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-width, 0, width],
          [-9, 0, 9],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  const yesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, width * 0.22], [0, 1], Extrapolation.CLAMP),
  }));

  const noStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-width * 0.22, 0], [1, 0], Extrapolation.CLAMP),
  }));

  if (!current) {
    return <View style={styles.emptyWrap}>{renderEmpty?.() ?? null}</View>;
  }

  return (
    <View style={styles.deck}>
      {next ? (
        <View
          style={[styles.cardLayer, styles.behind, styles.noTouch]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {renderCard(next)}
        </View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.cardLayer, cardStyle]}>
          {renderCard(current)}
          <Animated.View style={[styles.decisionBadge, styles.yesBadge, yesStyle, styles.noTouch]}>
            <MaterialCommunityIcons name="check-bold" size={14} color={colors.greenInk} />
            <Text style={[type.label, { color: colors.greenInk }]}>{yesLabel}</Text>
          </Animated.View>
          <Animated.View style={[styles.decisionBadge, styles.noBadge, noStyle, styles.noTouch]}>
            <MaterialCommunityIcons name="close-thick" size={14} color={colors.coral} />
            <Text style={[type.label, { color: colors.coral }]}>{noLabel}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T>(
  props: SwipeDeckProps<T> & { ref?: React.Ref<SwipeDeckHandle> },
) => React.ReactElement;

const styles = StyleSheet.create({
  deck: { flex: 1, justifyContent: 'center' },
  cardLayer: { flex: 1, justifyContent: 'center' },
  behind: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: [{ scale: 0.955 }], opacity: 0.72 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  decisionBadge: {
    position: 'absolute',
    top: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...shadows.soft,
  },
  yesBadge: { right: spacing.lg, backgroundColor: colors.sage },
  noBadge: { left: spacing.lg, backgroundColor: colors.coralSoft },
  noTouch: { pointerEvents: 'none' },
});
