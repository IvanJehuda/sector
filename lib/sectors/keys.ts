import { createHash } from 'node:crypto';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export function canonicalQuery(params: QueryParams): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
    .join('&');
}

export function cacheKey(path: string, params: QueryParams): string {
  const q = canonicalQuery(params);
  return q ? `${path}?${q}` : path;
}

export function fixtureFileName(key: string): string {
  const [pathPart] = key.split('?');
  const slug = pathPart.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 10);
  return `${slug}__${hash}.json`;
}
