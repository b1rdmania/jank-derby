export function makeTemplateIds(packageId: string) {
  const t = (moduleAndEntity: string) => `${packageId}:${moduleAndEntity}`;
  return {
    Operator: t('HorseRaceSecure:Operator'),
    PlayerAccount: t('HorseRaceSecure:PlayerAccount'),
    Race: t('HorseRaceSecure:Race'),
    BetRequest: t('HorseRaceSecure:BetRequest'),
    Bet: t('HorseRaceSecure:Bet'),
    Payout: t('HorseRaceSecure:Payout'),
    RefundReceipt: t('HorseRaceSecure:RefundReceipt'),
  } as const;
}

export type Horse = 'Red' | 'Blue' | 'Green' | 'Yellow' | 'Purple';

