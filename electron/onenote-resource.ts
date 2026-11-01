import { validOneNoteId } from './capture-types';
import { OneNoteError } from './onenote-error';

export function oneNoteResourceUrl(value: string): string {
  let url: URL;
  try {
    if (typeof value !== 'string' || value.length > 8192) throw new Error();
    url = new URL(value);
  } catch {
    throw new OneNoteError(
      'OneNote returned an unsupported resource link (missing or invalid URL).',
    );
  }
  const unsupported = () => {
    const host =
      url.hostname === 'graph.microsoft.com'
        ? 'Graph'
        : url.hostname === 'www.onenote.com'
          ? 'OneNote'
          : 'other host';
    const keywords = [
      'v1.0',
      'api',
      'me',
      'onenote',
      'notes',
      'users',
      'groups',
      'sites',
      'resources',
      'content',
      '$value',
    ];
    const shape = url.pathname
      .split('/')
      .slice(1, 13)
      .map((part) =>
        keywords.includes(part)
          ? part
          : /^(users|groups|sites|resources)\(/.test(part)
            ? `${part.slice(0, part.indexOf('('))}({id})`
            : '{id}',
      )
      .join('/');
    return new OneNoteError(
      `OneNote returned an unsupported resource link (${host}; /${shape}). Your draft is unchanged.`,
    );
  };
  if (
    url.protocol !== 'https:' ||
    !['graph.microsoft.com', 'www.onenote.com'].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw unsupported();
  const match = url.pathname.match(
    url.hostname === 'graph.microsoft.com'
      ? /^\/v1\.0\/(?:(?<scope>me|(?:users|groups|sites)(?:\/[^/]+|\([^/]+\)))\/onenote\/)?resources\/(?<id>[^/]+)\/(?:content|\$value)$/
      : /^\/api\/v1\.0\/(?:me\/notes\/)?resources\/(?<id>[^/]+)\/(?:content|\$value)$/,
  );
  if (!match?.groups) throw unsupported();
  let id: string;
  let owner: string[];
  try {
    id = decodeURIComponent(match.groups.id);
    owner = (match.groups.scope ?? 'me').split('/').map(decodeURIComponent);
  } catch {
    throw unsupported();
  }
  if (owner.length === 1 && owner[0] !== 'me') {
    const key = owner[0].match(/^(users|groups|sites)\((?:'((?:[^']|'')+)'|([^'()]+))\)$/);
    if (!key) throw unsupported();
    owner = [key[1], key[2] !== undefined ? key[2].replace(/''/g, "'") : key[3]];
  }
  if (!validOneNoteId(id) || !owner.every(validOneNoteId)) throw unsupported();
  // Rebuild a Graph URL; never forward a token to a URL supplied in page HTML.

  return `https://graph.microsoft.com/v1.0/${owner.map(encodeURIComponent).join('/')}/onenote/resources/${encodeURIComponent(id)}/content`;
}
