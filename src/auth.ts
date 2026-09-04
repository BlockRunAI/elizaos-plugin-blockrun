export type BlockRunBillingConfig =
  | { mode: 'account'; apiKey: string; apiUrl?: string }
  | { mode: 'solana'; privateKey: string; apiUrl?: string }
  | { mode: 'base'; privateKey: string; apiUrl?: string }
  | { mode: 'none' };

type SettingsReader = { getSetting(name: string): unknown };

function value(runtime: SettingsReader, env: NodeJS.ProcessEnv, name: string): string | undefined {
  const candidate = runtime.getSetting(name) ?? env[name];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

/** Resolve credentials once using the documented account → Solana → Base priority. */
export function resolveBlockRunBilling(
  runtime: SettingsReader,
  env: NodeJS.ProcessEnv = process.env,
): BlockRunBillingConfig {
  const apiKey = value(runtime, env, 'BLOCKRUN_API_KEY');
  if (apiKey) {
    return {
      mode: 'account',
      apiKey,
      apiUrl: value(runtime, env, 'BLOCKRUN_API_BASE_URL'),
    };
  }

  const solanaKey = value(runtime, env, 'SOLANA_WALLET_KEY');
  if (solanaKey) {
    return {
      mode: 'solana',
      privateKey: solanaKey,
      apiUrl: value(runtime, env, 'BLOCKRUN_SOLANA_API_URL'),
    };
  }

  const baseKey = value(runtime, env, 'BASE_CHAIN_WALLET_KEY') ||
    value(runtime, env, 'BLOCKRUN_WALLET_KEY');
  if (baseKey) {
    return {
      mode: 'base',
      privateKey: baseKey,
      apiUrl: value(runtime, env, 'BLOCKRUN_API_URL'),
    };
  }

  return { mode: 'none' };
}
