import {
  rawSignalToContribution,
  type Signal,
  type SignalContribution,
  type SignalFamily,
  type SignalResult,
  type TokenWithHistory,
} from '@noname/core';
import type { StrategyConfig } from './config.js';

export interface ConfluenceAssessment {
  /** True only when enough independent families confirm and no veto fired. */
  readonly enter: boolean;
  /** Blended conviction in [-1, 1]. */
  readonly conviction: number;
  /** Distinct families confirming the bullish direction. */
  readonly confirmations: number;
  readonly confirmingFamilies: readonly SignalFamily[];
  readonly contributions: readonly SignalContribution[];
  readonly reasoning: readonly string[];
  readonly vetoed: boolean;
  readonly rejectionReason?: string;
  readonly results: readonly SignalResult[];
}

/**
 * Enforces the platform's core rule: a trade requires confluence across
 * multiple *independent* signal families. A single strong signal — even a
 * maximal one — can never trigger an entry on its own, and any veto blocks the
 * entry outright.
 */
export class ConfluenceEngine {
  constructor(
    private readonly signals: readonly Signal[],
    private readonly config: StrategyConfig,
  ) {}

  private weight(signalId: string): number {
    return this.config.weights[signalId] ?? 1;
  }

  assess(subject: TokenWithHistory): ConfluenceAssessment {
    const results = this.signals.map((s) => s.evaluate(subject));
    const contributions = results.map((r) => rawSignalToContribution(r, this.weight(r.signalId)));

    // 1. Vetoes are absolute.
    const veto = results.find((r) => r.veto);
    if (veto) {
      return {
        enter: false,
        conviction: -1,
        confirmations: 0,
        confirmingFamilies: [],
        contributions,
        reasoning: [`VETO by ${veto.signalId}: ${veto.evidence.join('; ')}`],
        vetoed: true,
        rejectionReason: `Vetoed by ${veto.signalId}`,
        results,
      };
    }

    // 2. Determine which families confirm the bullish direction.
    const byFamily = new Map<SignalFamily, number>();
    for (const c of contributions) {
      const best = byFamily.get(c.family);
      if (best === undefined || c.weightedScore > best) byFamily.set(c.family, c.weightedScore);
    }
    const confirmingFamilies = [...byFamily.entries()]
      .filter(([, score]) => score >= this.config.familyConfirmThreshold)
      .map(([family]) => family);
    const confirmations = confirmingFamilies.length;

    // 3. Blended conviction: confidence-weighted mean of weighted scores.
    const totalWeight = contributions.reduce((acc, c) => acc + this.weight(c.signalId) * c.confidence, 0);
    const conviction =
      totalWeight > 0
        ? contributions.reduce((acc, c) => acc + c.weightedScore, 0) / totalWeight
        : 0;

    const enter = confirmations >= this.config.minConfirmations && conviction >= this.config.minConviction;

    const reasoning: string[] = [];
    reasoning.push(
      `${confirmations}/${this.config.minConfirmations} independent families confirm (${confirmingFamilies.join(', ') || 'none'})`,
    );
    reasoning.push(`Blended conviction ${conviction.toFixed(2)} vs required ${this.config.minConviction}`);
    for (const c of [...contributions].sort((a, b) => b.weightedScore - a.weightedScore)) {
      reasoning.push(`[${c.family}] ${c.signalId}: ${c.evidence[0] ?? '—'} (w=${c.weightedScore.toFixed(2)})`);
    }

    let rejectionReason: string | undefined;
    if (!enter) {
      rejectionReason =
        confirmations < this.config.minConfirmations
          ? `Only ${confirmations} family confirmations (need ${this.config.minConfirmations})`
          : `Conviction ${conviction.toFixed(2)} below threshold ${this.config.minConviction}`;
    }

    return {
      enter,
      conviction,
      confirmations,
      confirmingFamilies,
      contributions,
      reasoning,
      vetoed: false,
      rejectionReason,
      results,
    };
  }
}
