import { useCallback } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthenticatedStackParamList } from '../navigation/AppNavigator';
import { enqueuePendingSession } from '../services/pendingSessionsQueue';
import { listAllMySessions, recordSession } from '../services/sessionsService';
import { computePersonalRecord, detectNewRecords, detectOverload } from '../services/sessionInsights';
import type { AsymmetryResult, FatigueResult } from '../services/poseScoring';

type Navigation = NativeStackNavigationProp<AuthenticatedStackParamList, 'Execution'>;

export type SubmitParams = {
  token: string | null;
  exerciseId: string;
  score: number;
  weightKg: number | null;
  asymmetry: AsymmetryResult | null;
  repCount: number | null;
  fatigue: FatigueResult | null;
  /** Propagado até o resultado para decidir se o aviso de pontuação
   * experimental aparece (ADR-0001). */
  referenceIsSynthetic: boolean;
};

/**
 * Orquestra o envio do resultado da série: POST /sessions, fallback para
 * fila offline em caso de falha de rede, detecção de recordes pessoais e
 * navegação para ResultScreen. Extraído de ExecutionScreen (M8).
 */
export function useSessionSubmit(navigation: Navigation) {
  const submit = useCallback(
    ({ token, exerciseId, score, weightKg, asymmetry, repCount, fatigue, referenceIsSynthetic }: SubmitParams) => {
      if (!token) {
        navigation.replace('Result', {
          score, exerciseId, asymmetry, repCount, fatigue,
          newRecords: null, overload: null, weightKg, referenceIsSynthetic,
        });
        return;
      }

      const executedAt = new Date();

      recordSession(token, exerciseId, score, executedAt, weightKg).catch(() => {
        enqueuePendingSession({
          exerciseId, score,
          executedAt: executedAt.toISOString(),
          weightKg,
        }).catch(() => {});
      });

      listAllMySessions(token)
        .then((sessions) => {
          const previousSessions = sessions.filter((s) => new Date(s.executed_at) < executedAt);
          navigation.replace('Result', {
            score, exerciseId, asymmetry, repCount, fatigue,
            newRecords: detectNewRecords(
              { score, weightKg },
              computePersonalRecord(previousSessions, exerciseId)
            ),
            overload: detectOverload(previousSessions, exerciseId, weightKg),
            weightKg, referenceIsSynthetic,
          });
        })
        .catch(() => {
          navigation.replace('Result', {
            score, exerciseId, asymmetry, repCount, fatigue,
            newRecords: null, overload: null, weightKg, referenceIsSynthetic,
          });
        });
    },
    [navigation]
  );

  return { submit };
}
