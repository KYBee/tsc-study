export type TextPartPath =
  | '/parts/1'
  | '/parts/3'
  | '/parts/4'
  | '/parts/5'
  | '/parts/6'
export type SafeReturnPath = TextPartPath | '/my-answers'

const SAFE_RETURN_PATHS: ReadonlySet<string> = new Set([
  '/parts/4',
  '/parts/1',
  '/parts/3',
  '/parts/5',
  '/parts/6',
  '/my-answers',
])

export interface NavigationContextState {
  returnTo: SafeReturnPath
}

export function getSafeReturnPath(
  state: unknown,
  fallback: SafeReturnPath = '/parts/4',
): SafeReturnPath {
  if (
    typeof state === 'object' &&
    state !== null &&
    'returnTo' in state &&
    typeof state.returnTo === 'string' &&
    SAFE_RETURN_PATHS.has(state.returnTo)
  ) {
    return state.returnTo as SafeReturnPath
  }
  return fallback
}

export function createNavigationContext(
  returnTo: SafeReturnPath,
): NavigationContextState {
  return { returnTo }
}
