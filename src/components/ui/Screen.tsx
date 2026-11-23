import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Blob, Flower, Heart, Sparkle } from '@/components/cute/Decor';
import { colors, gradients, radius, shadows, spacing, type } from '@/theme';

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  footer,
  style,
  contentStyle,
  bottomSpace = 0,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra room at the bottom — use 104 on screens with the floating tab bar. */
  bottomSpace?: number;
}) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = padded ? { paddingHorizontal: spacing.lg } : {};

  return (
    <LinearGradient colors={gradients.background} style={styles.safe}>
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[
              {
                paddingTop: spacing.lg,
                paddingBottom: footer ? 140 : insets.bottom + spacing.xl + bottomSpace,
              },
              padding,
              contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              { flex: 1 },
              padding,
              { paddingTop: spacing.sm },
              footer ? { paddingBottom: 108 } : bottomSpace ? { paddingBottom: bottomSpace } : null,
              contentStyle,
            ]}
          >
            {children}
          </View>
        )}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Handwritten note — the little aside that makes a screen feel personal. */
export function ScriptNote({
  children,
  style,
  align = 'left',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  align?: 'left' | 'center';
}) {
  return (
    <View style={[align === 'center' ? styles.centeredRow : null, style]}>
      <Text style={[type.scriptSmall, { color: colors.primaryDeep }]}>{children}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primaryDeep} size="large" />
      <Text style={[type.scriptSmall, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'silverware-fork-knife',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Sparkle size={16} color={colors.butter} style={styles.emptySparkleLeft} />
      <Sparkle size={11} color={colors.lavender} style={styles.emptySparkleRight} />
      <View style={styles.emptyArt}>
        <Blob size={104} color={colors.primarySoft} style={StyleSheet.absoluteFill as StyleProp<ViewStyle>} />
        <MaterialCommunityIcons name={icon} size={34} color={colors.primaryDeep} />
        <Flower size={18} color={colors.white} center={colors.butter} style={styles.emptyFlower} />
      </View>
      <Text style={[type.sectionTitle, styles.emptyTitle]}>{title}</Text>
      <Text style={[type.body, styles.stateText]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.emptyAction,
            { transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
        >
          <Heart size={12} color={colors.primaryDeep} />
          <Text style={[type.label, { color: colors.primaryInk }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  actionLabel = 'Try again',
  onAction,
}: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.errorCard}>
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyMedium, { color: colors.ink }]}>{title}</Text>
        <Text style={[type.caption, { color: colors.inkSoft, marginTop: 2 }]}>{message}</Text>
      </View>
      {onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[type.label, { color: colors.primaryDeep, textDecorationLine: 'underline' }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Banner({
  icon = 'information-outline',
  message,
  tone = 'neutral',
}: {
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  message: string;
  tone?: 'neutral' | 'warm' | 'warning';
}) {
  const background = tone === 'warning' ? colors.butterSoft : colors.surfaceMuted;
  const color = tone === 'warning' ? colors.butterInk : colors.inkSoft;
  return (
    <View style={[styles.banner, { backgroundColor: background }]}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={[type.caption, { color, flex: 1 }]}>{message}</Text>
    </View>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Sparkle size={12} color={colors.butter} />
          <Text style={[type.sectionTitle, { color: colors.ink }]}>{title}</Text>
        </View>
        {subtitle ? (
          <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#D0698F',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  centeredRow: { alignItems: 'center' },
  stateText: { color: colors.muted, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  emptyArt: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyFlower: { position: 'absolute', right: 4, top: 6 },
  emptySparkleLeft: { position: 'absolute', left: 18, top: 22 },
  emptySparkleRight: { position: 'absolute', right: 26, top: 54 },
  emptyTitle: { color: colors.ink, textAlign: 'center' },
  emptyAction: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
});
