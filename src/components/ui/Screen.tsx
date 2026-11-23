import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { colors, radius, spacing, type } from '@/theme';

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  footer,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = padded ? { paddingHorizontal: spacing.lg } : {};

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { paddingBottom: footer ? 120 : insets.bottom + spacing.xl },
            padding,
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.greenDeep} size="large" />
      <Text style={[type.body, styles.stateText]}>{label}</Text>
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
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={26} color={colors.greenDeep} />
      </View>
      <Text style={[type.cardTitle, styles.emptyTitle]}>{title}</Text>
      <Text style={[type.body, styles.stateText]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.emptyAction, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[type.button, { color: colors.greenInk }]}>{actionLabel}</Text>
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
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.coral} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyMedium, { color: colors.ink }]}>{title}</Text>
        <Text style={[type.caption, { color: colors.inkSoft, marginTop: 2 }]}>{message}</Text>
      </View>
      {onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[type.label, { color: colors.ink, textDecorationLine: 'underline' }]}>
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
  const background = tone === 'warning' ? colors.orangeSoft : colors.surfaceMuted;
  const color = tone === 'warning' ? '#7A4A17' : colors.inkSoft;
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
        <Text style={type.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  stateText: { color: colors.muted, textAlign: 'center' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontSize: 18, color: colors.ink },
  emptyAction: { marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.sage, borderRadius: radius.pill },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.coralSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
});
