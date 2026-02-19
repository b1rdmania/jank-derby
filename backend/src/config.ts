import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '4001', 10),
  jsonApiUrl: process.env.DAML_JSON_API_URL ?? 'http://localhost:7575',
  ledgerId: process.env.DAML_LEDGER_ID ?? 'sandbox',
  applicationId: process.env.DAML_APPLICATION_ID ?? 'jank-derby',
  packageId: process.env.DAML_PACKAGE_ID ?? '',
  operatorPartyHint: process.env.OPERATOR_PARTY_HINT ?? 'Operator',
  demoPlayerHints: (process.env.DEMO_PLAYERS ?? 'Alice')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

