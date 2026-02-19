import fetch from 'cross-fetch';

export class JsonApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string
  ) {}

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const doFetch = async () =>
      fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    let res = await doFetch();

    if (!res.ok) {
      const text = await res.text();

      // Canton local sandbox can reject concurrent submissions due to contract locks.
      // For development UX, retry a couple times.
      if (
        res.status === 409 &&
        text.includes('LOCAL_VERDICT_LOCKED_CONTRACTS')
      ) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 1000));
          res = await doFetch();
          if (res.ok) break;
        }
        if (res.ok) {
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        }
      }

      throw new Error(`JSON-API ${path} failed: ${res.status} ${res.statusText}\n${text}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  getLedgerEnd() {
    return this.request<{ offset: number }>('GET', '/v2/state/ledger-end');
  }

  allocateParty(args: { partyIdHint: string }) {
    return this.request<{ partyDetails: { party: string } }>('POST', '/v2/parties', args);
  }

  listParties(filterParty?: string) {
    const q = filterParty ? `?filter-party=${encodeURIComponent(filterParty)}` : '';
    return this.request<{ partyDetails: Array<{ party: string }> }>('GET', `/v2/parties${q}`);
  }

  activeContracts(party: string, activeAtOffset: number) {
    return this.request<
      Array<{
        contractEntry: {
          JsActiveContract: {
            createdEvent: {
              contractId: string;
              templateId: string;
              createArgument: unknown;
            };
          };
        };
      }>
    >('POST', '/v2/state/active-contracts', {
      activeAtOffset,
      filter: { filtersByParty: { [party]: { cumulative: [] } } },
      verbose: true,
    });
  }

  submitAndWaitForTransactionTree(args: {
    commandId: string;
    actAs: string[];
    readAs?: string[];
    userId?: string;
    commands: unknown[];
  }) {
    return this.request<{ transactionTree: any }>(
      'POST',
      '/v2/commands/submit-and-wait-for-transaction-tree',
      {
        commandId: args.commandId,
        actAs: args.actAs,
        readAs: args.readAs,
        userId: args.userId,
        commands: args.commands,
      }
    );
  }

  async listActiveContractsByTemplate<TContract>(
    party: string,
    templateId: string
  ): Promise<Array<{ contractId: string; payload: TContract }>> {
    const { offset } = await this.getLedgerEnd();
    const acs = await this.activeContracts(party, offset);
    return acs
      .map((e) => e.contractEntry.JsActiveContract.createdEvent)
      .filter((e) => e.templateId === templateId)
      .map((e) => ({ contractId: e.contractId, payload: e.createArgument as TContract }));
  }

  async create<TPayload>(args: { party: string; templateId: string; createArguments: TPayload }) {
    const res = await this.submitAndWaitForTransactionTree({
      commandId: `create-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: 'backend',
      actAs: [args.party],
      commands: [
        {
          CreateCommand: {
            templateId: args.templateId,
            createArguments: args.createArguments,
          },
        },
      ],
    });

    // Find created contract id
    const events = res.transactionTree?.eventsById ?? {};
    for (const k of Object.keys(events)) {
      const node = events[k];
      const created = node?.CreatedTreeEvent?.value;
      if (created?.contractId) return created.contractId as string;
    }
    throw new Error('Create did not return a CreatedTreeEvent');
  }

  async exercise<TArg, TResult>(args: {
    party: string;
    templateId: string;
    contractId: string;
    choice: string;
    choiceArgument: TArg;
  }): Promise<TResult> {
    const res = await this.submitAndWaitForTransactionTree({
      commandId: `ex-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: 'backend',
      actAs: [args.party],
      commands: [
        {
          ExerciseCommand: {
            templateId: args.templateId,
            contractId: args.contractId,
            choice: args.choice,
            choiceArgument: args.choiceArgument,
          },
        },
      ],
    });

    const events = res.transactionTree?.eventsById ?? {};
    for (const k of Object.keys(events)) {
      const node = events[k];
      const exercised = node?.ExercisedTreeEvent?.value;
      if (exercised?.choice === args.choice) {
        return exercised.exerciseResult as TResult;
      }
    }
    // Some choices may not return; return undefined
    return undefined as TResult;
  }
}

