/** Minimal stand-in for the brief's `serverFn` primitive (bet-07 fixture only). */
export interface ServerFnCtx {
  request: Request;
}

export interface ServerFnConfig<I, O> {
  input: 'none' | 'object';
  handler: (input: I, ctx: ServerFnCtx) => Promise<O>;
}

export const serverFn = <I, O>(config: ServerFnConfig<I, O>) =>
  Object.assign((input: I, ctx: ServerFnCtx) => config.handler(input, ctx), {
    __serverFn: true as const,
  });

export const fnError = (code: string, data?: unknown) =>
  Object.assign(new Error(code), { code, data, __fnError: true as const });
