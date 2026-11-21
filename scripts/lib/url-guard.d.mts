export interface GuardRule {
  label: string;
  pattern: RegExp;
}

export interface GuardHit {
  path: string;
  label: string;
  excerpt: string;
}

export declare function guardKind(path: string): 'document' | 'script' | null;
export declare function findForbiddenUrls(
  path: string,
  content: string,
  extraPatterns?: readonly GuardRule[],
): GuardHit[];
