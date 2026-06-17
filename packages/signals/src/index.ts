import type { Signal } from '@noname/core';
import { PriceMomentumSignal } from './signals/price-momentum.js';
import { VolumeSurgeSignal } from './signals/volume-surge.js';
import { LiquidityTrendSignal } from './signals/liquidity-trend.js';
import { BuyPressureSignal } from './signals/buy-pressure.js';
import { RugRiskVetoSignal } from './signals/rug-risk-veto.js';
import { SocialMomentumSignal } from './signals/social-momentum.js';

export * from './util.js';
export { PriceMomentumSignal } from './signals/price-momentum.js';
export { VolumeSurgeSignal } from './signals/volume-surge.js';
export { LiquidityTrendSignal } from './signals/liquidity-trend.js';
export { BuyPressureSignal } from './signals/buy-pressure.js';
export { RugRiskVetoSignal } from './signals/rug-risk-veto.js';
export { SocialMomentumSignal } from './signals/social-momentum.js';

/** The default signal suite spanning all four independent families. */
export function defaultSignals(): Signal[] {
  return [
    new PriceMomentumSignal(),
    new VolumeSurgeSignal(),
    new LiquidityTrendSignal(),
    new BuyPressureSignal(),
    new RugRiskVetoSignal(),
    new SocialMomentumSignal(),
  ];
}
