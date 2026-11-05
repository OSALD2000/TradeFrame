import { OneNoteError } from './onenote-error';
import { oneNoteResourceUrl } from './onenote-resource';
import { validOneNoteId } from './capture-types';

type GraphSession = {
  generation(): number;
  invalidateAccessToken(): void;
};

const graph = 'https://graph.microsoft.com/v1.0/me/onenote/';

export class OneNoteGraph {
  constructor(
    private request: typeof fetch,
    private session: GraphSession,
  ) {}

  send(endpoint: string, options: RequestInit): Promise<Response> {
    return this.request(graph + endpoint, options);
  }

  async checkResponse(response: Response, action: string) {
    if (response.ok) return;
    if (response.status === 401) this.session.invalidateAccessToken();
    let code = '';
    try {
      const data = (await response.json()) as { error?: { code?: unknown } };
      if (typeof data.error?.code === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(data.error.code))
        code = `, code ${data.error.code}`;
    } catch {
      /* The status remains useful when Microsoft returns no JSON. */
    }
    const help =
      response.status === 401
        ? 'Reconnect OneNote.'
        : response.status === 403
          ? 'Check notebook write access and Microsoft Notes.ReadWrite consent.'
          : response.status === 413
            ? 'This request exceeds Microsoft Graph’s 4 MB limit.'
            : response.status === 429
              ? 'Microsoft is throttling requests. Wait, then retry.'
              : response.status === 404
                ? 'The selected notebook, section or page is unavailable.'
                : 'Retry in Connections; your local setup is safe.';
    throw new OneNoteError(`OneNote could not ${action} (HTTP ${response.status}${code}). ${help}`);
  }

  async collection(
    endpoint: string,
    headers: Record<string, string>,
    generation: number,
    property = 'displayName',
  ): Promise<Record<string, unknown>[]> {
    const initial = new URL(graph + endpoint);
    let next: string | undefined = initial.href;
    const seen = new Set<string>();
    const items: Record<string, unknown>[] = [];
    while (next) {
      const url = new URL(next);
      if (
        url.origin !== initial.origin ||
        decodeURIComponent(url.pathname) !== decodeURIComponent(initial.pathname) ||
        url.username ||
        url.password ||
        seen.has(url.href) ||
        seen.size >= 100
      )
        throw new Error('Invalid OneNote pagination');
      seen.add(url.href);
      const response = await this.request(url.href, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      if (generation !== this.session.generation()) throw new Error('OneNote was disconnected');
      await this.checkResponse(response, 'read notebooks or sections');
      const data = (await response.json()) as {
        value?: Record<string, unknown>[];
        '@odata.nextLink'?: string;
      };
      if (
        !Array.isArray(data.value) ||
        items.length + data.value.length > 1000 ||
        data.value.some(
          (item) =>
            !item ||
            !validOneNoteId(item.id) ||
            typeof item[property] !== 'string' ||
            (item[property] as string).length > 1000,
        ) ||
        (data['@odata.nextLink'] !== undefined && typeof data['@odata.nextLink'] !== 'string')
      )
        throw new Error('Invalid OneNote collection');
      if (generation !== this.session.generation()) throw new Error('OneNote was disconnected');
      items.push(...data.value);
      next = data['@odata.nextLink'];
    }
    return items;
  }

  private async bytes(response: Response, limit: number, generation: number) {
    if (generation !== this.session.generation())
      throw new OneNoteError('OneNote was disconnected.');
    await this.checkResponse(response, 'download setup content');
    const reader = response.body?.getReader();
    if (!reader) throw new OneNoteError('Microsoft returned no setup content.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (generation !== this.session.generation())
          throw new OneNoteError('OneNote was disconnected.');
        if (next.done) break;
        size += next.value.length;
        if (size > limit) throw new OneNoteError('OneNote content exceeds the supported size.');
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks, size);
  }

  async content(id: string, headers: Record<string, string>, generation: number) {
    if (generation !== this.session.generation())
      throw new OneNoteError('OneNote was disconnected.');
    const response = await this.request(`${graph}pages/${encodeURIComponent(id)}/content`, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    return (await this.bytes(response, 5_000_000, generation)).toString('utf8');
  }

  async resource(
    value: string,
    headers: Record<string, string>,
    generation: number,
    limit: number,
  ) {
    if (generation !== this.session.generation())
      throw new OneNoteError('OneNote was disconnected.');
    const response = await this.request(oneNoteResourceUrl(value), {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    return this.bytes(response, limit, generation);
  }
}
