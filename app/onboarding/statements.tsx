import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flower } from '@/components/cute/Decor';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe/SwipeDeck';
import { STATEMENTS, type StatementDefinition } from '@/data/taxonomy';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { setStatements } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, shadows, spacing, type } from '@/theme';
import type { StatementResponses } from '@/types';

export default function StatementsScreen() {
  const mutate = useUserStore((state) => state.mutate);
  const { goNext, goBack } = useOnboardingNav('statements');
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [answers, setAnswers] = useState<Partial<StatementResponses>>({});

  const answeredCount = Object.keys(answers).length;
  const current = Math.min(answeredCount + 1, STATEMENTS.length);

  const handleDecide = (statement: StatementDefinition, decision: 'yes' | 'no') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const next: Partial<StatementResponses> = { ...answers, [statement.key]: decision === 'yes' };
    setAnswers(next);

    if (Object.keys(next).length === STATEMENTS.length) {
      const complete = STATEMENTS.reduce((acc, item) => {
        acc[item.key] = Boolean(next[item.key]);
        return acc;
      }, {} as StatementResponses);
      // Persist the full structured response set, then advance once.
      setTimeout(() => {
        mutate((data) => setStatements(data, complete));
        goNext();
      }, 220);
    }
  };

  return (
    <OnboardingScaffold
      step="statements"
      scroll={false}
      onBack={goBack}
      headerRight={
        <Text style={[type.label, { color: colors.primaryDeep }]}>
          {current} / {STATEMENTS.length}
        </Text>
      }
      footer={
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No, this isn't me"
            onPress={() => deckRef.current?.swipe('no')}
            style={({ pressed }) => [styles.action, styles.noAction, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <MaterialCommunityIcons name="close-thick" size={26} color={colors.danger} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yes, I relate to this"
            onPress={() => deckRef.current?.swipe('yes')}
            style={({ pressed }) => [styles.action, styles.yesAction, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <MaterialCommunityIcons name="heart" size={26} color={colors.white} />
          </Pressable>
        </View>
      }
    >
      <View style={styles.deckWrap}>
        <SwipeDeck
          ref={deckRef}
          items={STATEMENTS}
          keyExtractor={(statement) => statement.key}
          onDecide={handleDecide}
          yesLabel="That's me"
          noLabel="Not me"
          renderCard={(statement) => (
            <View style={styles.card}>
              <Text style={styles.quoteMark}>“</Text>
              <Flower size={22} color={colors.primarySoft} center={colors.butter} style={styles.cardFlower} />
              <Text style={styles.statement}>{statement.text}</Text>
              <View style={styles.cardFooter}>
                <Text style={[type.scriptTiny, { color: colors.primaryDeep }]}>
                  tap the heart if that's you ♡
                </Text>
              </View>
            </View>
          )}
          renderEmpty={() => (
            <View style={styles.empty}>
              <Text style={[type.cardTitle, { color: colors.ink }]}>All five answered</Text>
              <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>
                Nice — moving on to what you like.
              </Text>
            </View>
          )}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  deckWrap: { flex: 1, paddingBottom: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    minHeight: 330,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  quoteMark: {
    fontFamily: type.display.fontFamily,
    fontSize: 56,
    lineHeight: 56,
    color: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  statement: {
    fontFamily: type.screenTitle.fontFamily,
    fontSize: 28,
    lineHeight: 36,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  cardFooter: { alignItems: 'center', marginTop: spacing.xl },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  action: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  noAction: { backgroundColor: colors.dangerSoft, borderColor: 'rgba(219, 84, 97, 0.24)' },
  yesAction: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  cardFlower: { position: 'absolute', right: spacing.lg, top: spacing.lg },
  empty: { alignItems: 'center', gap: spacing.xs, padding: spacing.xl },
});
