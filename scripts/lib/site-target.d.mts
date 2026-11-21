export declare const INVALID_SITE_ORIGIN: string;
export declare const DEFAULT_BASE_PATH: string;

export interface GithubRepository {
  owner: string;
  repo: string;
}

export interface PagesTarget {
  origin: string;
  basePath: string;
}

export interface PreviewTarget {
  basePath: string;
  siteUrl: string;
  /** "env", "github:<owner>/<repo>" or "fallback". */
  source: string;
  warning?: string;
}

export declare function parseGithubRepository(
  value: string | null | undefined,
): GithubRepository | null;
export declare function pagesTargetFor(repository: GithubRepository): PagesTarget;
export declare function resolvePreviewTarget(
  env: Record<string, string | undefined>,
  remoteUrl: string | null | undefined,
): PreviewTarget;
