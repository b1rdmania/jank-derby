function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createInsecureJwt(payload: Record<string, unknown>): string {
  // JSON-API in dev mode often allows "alg":"none" tokens.
  const header = { alg: 'none', typ: 'JWT' } as const;
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.`;
}

export function createDamlToken(args: {
  ledgerId: string;
  applicationId: string;
  actAs: string[];
  readAs?: string[];
}): string {
  const readAs = args.readAs ?? args.actAs;
  return createInsecureJwt({
    'https://daml.com/ledger-api': {
      ledgerId: args.ledgerId,
      applicationId: args.applicationId,
      actAs: args.actAs,
      readAs,
    },
  });
}

