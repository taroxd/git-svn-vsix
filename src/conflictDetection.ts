import { ProcessCommandError } from './processRunner';

export function isRebaseConflictError(error: unknown): boolean {
  if (!(error instanceof ProcessCommandError)) {
    return false;
  }

  const output = `${error.result?.stdout ?? ''}\n${error.result?.stderr ?? ''}`;
  return /^CONFLICT /m.test(output);
}
