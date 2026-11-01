import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { SafeStorage } from 'electron';
import { validOneNoteId } from './capture-types';
import type { OneNoteNotebook, OneNoteState, OneNotePage } from './capture-types';
import { readSetup, pngBytes } from './journal';
import { journalTags } from './form-schema';
import { assets, restoreOneNote, snapshotName, imageAlt, imageHash } from './onenote-content';

type Encryption = Pick<
  SafeStorage,
  | 'isEncryptionAvailable'
  | 'encryptString'
  | 'isAsyncEncryptionAvailable'
  | 'encryptStringAsync'
  | 'decryptStringAsync'
  | 'getSelectedStorageBackend'
>;
const identity = 'https://login.microsoftonline.com/common/oauth2/v2.0/';
const graph = 'https://graph.microsoft.com/v1.0/me/onenote/';
const scope = 'https://graph.microsoft.com/Notes.ReadWrite offline_access';
const clientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeHtml = (text: unknown) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const queryString = (values: Record<string, string>) =>
  new URLSearchParams(values).toString().replace(/\+/g, '%20');

export class OneNoteError extends Error {}

export class OneNoteClient {
  private clientId = '';
  private customApplicationId = false;
  private notebook: OneNoteNotebook | null = null;
  private notebooks: OneNoteNotebook[] = [];
  private pages: OneNotePage[] = [];
  private refreshToken = '';
  private accessToken = '';
  private expiresAt = 0;
  private durable = false;
  private error: string | null = null;
  private loaded: Promise<void> | null = null;
  private generation = 0;
  private polling = false;
  private login: {
    deviceCode: string;
    userCode: string;
    expiresAt: number;
    interval: number;
    nextPoll: number;
  } | null = null;

  constructor(
    private directory: string,
    private encryption: Encryption,
    private publisherClientId = '',
    private request: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}

  private async atomicWrite(file: string, value: string | Buffer) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, value, { flag: 'wx', mode: 0o600 });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  private async load() {
    if (!this.loaded)
      this.loaded = (async () => {
        this.clientId = clientIdPattern.test(this.publisherClientId) ? this.publisherClientId : '';
        try {
          const config = JSON.parse(
            await readFile(path.join(this.directory, 'onenote.json'), 'utf8'),
          );
          if (!clientIdPattern.test(config.clientId))
            throw new Error('Invalid Microsoft application ID');
          this.clientId = config.clientId;
          this.customApplicationId = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.customApplicationId = true;
            this.error =
              'Could not load OneNote settings. Edit or remove the custom application ID below.';
          }
        }
        try {
          const encrypted = await readFile(path.join(this.directory, 'onenote-token.bin'));
          if (encrypted.length > 100_000 || !(await this.secureStorage()))
            throw new Error('Secure storage unavailable');
          const decrypted = await this.encryption.decryptStringAsync(encrypted);
          const token = JSON.parse(decrypted.result);
          if (
            token.clientId !== this.clientId ||
            typeof token.refreshToken !== 'string' ||
            token.refreshToken.length > 50_000
          )
            throw new Error('Invalid credentials');
          this.refreshToken = token.refreshToken;
          this.durable = true;
          if (decrypted.shouldReEncrypt) await this.persistToken();
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            this.error =
              'OneNote needs to be reconnected. Check that your system keyring is unlocked.';
        }
        try {
          const target = JSON.parse(
            await readFile(path.join(this.directory, 'onenote-notebook.json'), 'utf8'),
          );
          if (
            target.clientId !== this.clientId ||
            !validOneNoteId(target.notebook?.id) ||
            typeof target.notebook?.displayName !== 'string' ||
            target.notebook.displayName.length > 1000 ||
            typeof target.notebook.isDefault !== 'boolean'
          )
            throw new Error('Invalid notebook settings');
          this.notebook = {
            id: target.notebook.id,
            displayName: target.notebook.displayName,
            isDefault: target.notebook.isDefault,
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            this.error =
              'Could not load the selected notebook. Refresh notebooks and choose it again.';
        }
      })();
    await this.loaded;
  }
  private async secureStorage() {
    // shortcut: Electron 45 only identifies the sync Linux provider; revisit when async exposes its security level.
    if (process.platform === 'linux')
      return (
        this.encryption.isEncryptionAvailable() &&
        ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(
          this.encryption.getSelectedStorageBackend(),
        )
      );
    return this.encryption.isAsyncEncryptionAvailable();
  }
  private async persistToken() {
    this.durable = false;
    if (!this.refreshToken) return;
    if (!(await this.secureStorage())) {
      this.error =
        'Connected for this session. Secure sign-in storage is unavailable. Start and unlock your system keyring, then reconnect to keep sign-in after closing the app.';
      return;
    }
    const value = JSON.stringify({ clientId: this.clientId, refreshToken: this.refreshToken });
    const encrypted =
      process.platform === 'linux'
        ? this.encryption.encryptString(value)
        : await this.encryption.encryptStringAsync(value);
    await this.atomicWrite(path.join(this.directory, 'onenote-token.bin'), encrypted);
    this.durable = true;
  }
  async getState(): Promise<OneNoteState> {
    await this.load();
    if (this.login && this.now() >= this.login.expiresAt) {
      this.login = null;
      this.error = 'Sign-in expired. Connect again to get a new code.';
    }
    return {
      configured: !!this.clientId,
      applicationId: this.clientId,
      customApplicationId: this.customApplicationId,
      connected: !!(this.refreshToken || this.accessToken),
      durable: this.durable,
      notebook: this.notebook ? { ...this.notebook } : null,
      notebooks: this.notebooks.map((item) => ({ ...item })),
      section: 'TradeFrame',
      error: this.error,
      login: this.login ? { userCode: this.login.userCode, expiresAt: this.login.expiresAt } : null,
    };
  }
  async configure(clientId: unknown) {
    await this.load();
    if (typeof clientId !== 'string' || (clientId !== '' && !clientIdPattern.test(clientId)))
      throw new Error('Enter a valid Microsoft Application (client) ID');
    await this.disconnect();
    if (clientId)
      await this.atomicWrite(
        path.join(this.directory, 'onenote.json'),
        JSON.stringify({ clientId }),
      );
    else await rm(path.join(this.directory, 'onenote.json'), { force: true });
    this.customApplicationId = !!clientId;
    this.clientId =
      clientId || (clientIdPattern.test(this.publisherClientId) ? this.publisherClientId : '');
    return this.getState();
  }
  private async tokenRequest(endpoint: 'token' | 'devicecode', body: Record<string, string>) {
    const response = await this.request(identity + endpoint, {
      method: 'POST',
      body: new URLSearchParams({ client_id: this.clientId, ...body }),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    const data = (await response.json()) as Record<string, unknown>;
    return { response, data };
  }
  async begin() {
    await this.load();
    if (!this.clientId)
      throw new Error(
        'The publisher must configure a Microsoft application ID before OneNote can connect',
      );
    const generation = ++this.generation;
    await this.clearNotebook();
    this.login = null;
    let result;
    try {
      result = await this.tokenRequest('devicecode', { scope });
    } catch {
      if (generation === this.generation)
        this.error =
          'Could not reach Microsoft. Check your connection and retry. You can still edit or remove the application ID below.';
      return this.getState();
    }
    const { response, data } = result;
    if (generation !== this.generation) return this.getState();
    if (
      !response.ok ||
      typeof data.device_code !== 'string' ||
      typeof data.user_code !== 'string' ||
      data.user_code.length > 40 ||
      typeof data.expires_in !== 'number' ||
      data.expires_in < 1 ||
      data.expires_in > 3600 ||
      typeof data.interval !== 'number' ||
      data.interval < 1 ||
      data.interval > 60
    ) {
      this.error =
        'Microsoft sign-in could not start. Use the Application (client) ID from App registrations and enable public client flows. You can edit or remove your ID below.';
      return this.getState();
    }
    this.error = null;
    this.login = {
      deviceCode: data.device_code,
      userCode: data.user_code,
      expiresAt: this.now() + data.expires_in * 1000,
      interval: data.interval * 1000,
      nextPoll: this.now() + data.interval * 1000,
    };
    return this.getState();
  }
  async poll() {
    await this.getState();
    const login = this.login;
    if (!login || this.polling || this.now() < login.nextPoll) return this.getState();
    this.polling = true;
    const generation = this.generation;
    login.nextPoll = this.now() + login.interval;
    try {
      const { response, data } = await this.tokenRequest('token', {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: login.deviceCode,
      });
      if (generation !== this.generation) return this.getState();
      if (response.ok) {
        await this.acceptToken(data);
        this.login = null;
      } else if (data.error === 'slow_down') {
        login.interval += 5000;
        login.nextPoll = this.now() + login.interval;
      } else if (data.error === 'authorization_pending') this.error = null;
      else if (data.error !== 'authorization_pending') {
        this.login = null;
        this.error = 'Sign-in was declined or expired. Connect again to retry.';
      }
    } catch {
      this.error =
        'Could not reach Microsoft. Check your connection; sign-in will retry until the code expires.';
    } finally {
      this.polling = false;
    }
    return this.getState();
  }
  private async acceptToken(data: Record<string, unknown>) {
    if (
      typeof data.access_token !== 'string' ||
      data.access_token.length > 50_000 ||
      typeof data.expires_in !== 'number' ||
      data.expires_in < 60 ||
      (data.refresh_token !== undefined &&
        (typeof data.refresh_token !== 'string' || data.refresh_token.length > 50_000))
    )
      throw new Error('Invalid Microsoft token response');
    this.accessToken = data.access_token;
    this.expiresAt = this.now() + data.expires_in * 1000;
    if (typeof data.refresh_token === 'string') this.refreshToken = data.refresh_token;
    this.error = null;
    try {
      await this.persistToken();
    } catch {
      this.durable = false;
      this.error =
        'Connected for this session. Could not save the sign-in securely; reconnect after restarting.';
    }
  }
  private async token() {
    await this.load();
    if (this.accessToken && this.now() < this.expiresAt - 60_000) return this.accessToken;
    if (!this.refreshToken) throw new Error('Connect OneNote before syncing');
    const generation = this.generation;
    const { response, data } = await this.tokenRequest('token', {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      scope,
    });
    if (generation !== this.generation) throw new Error('OneNote was disconnected');
    if (!response.ok) {
      if (data.error === 'invalid_grant') {
        this.refreshToken = '';
        this.accessToken = '';
        this.durable = false;
        this.error = 'OneNote authorization expired. Connect again.';
        await rm(path.join(this.directory, 'onenote-token.bin'), { force: true });
      }
      throw new Error('OneNote could not refresh its sign-in. Reconnect if this persists.');
    }
    await this.acceptToken(data);
    return this.accessToken;
  }
  private async clearNotebook() {
    await rm(path.join(this.directory, 'onenote-notebook.json'), { force: true });
    this.notebook = null;
    this.notebooks = [];
    this.pages = [];
  }
  private async checkResponse(response: Response, action: string) {
    if (response.ok) return;
    if (response.status === 401) this.accessToken = '';
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
  async disconnect() {
    await this.load();
    await rm(path.join(this.directory, 'onenote-token.bin'), { force: true });
    await this.clearNotebook();
    this.generation++;
    this.login = null;
    this.refreshToken = '';
    this.accessToken = '';
    this.expiresAt = 0;
    this.durable = false;
    this.error = null;
    return this.getState();
  }
  private async collection(
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
      if (generation !== this.generation) throw new Error('OneNote was disconnected');
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
      if (generation !== this.generation) throw new Error('OneNote was disconnected');
      items.push(...data.value);
      next = data['@odata.nextLink'];
    }
    return items;
  }
  async refreshNotebooks() {
    await this.load();
    const generation = this.generation;
    try {
      const accessToken = await this.token();
      const rows = await this.collection(
        'notebooks?$select=id,displayName,isDefault',
        { Authorization: `Bearer ${accessToken}` },
        generation,
      );
      if (generation !== this.generation) return this.getState();
      if (
        new Set(rows.map((row) => row.id)).size !== rows.length ||
        rows.some((row) => row.isDefault !== undefined && typeof row.isDefault !== 'boolean')
      )
        throw new Error('Invalid notebook list');
      this.notebooks = rows.map((row) => ({
        id: row.id as string,
        displayName: row.displayName as string,
        isDefault: row.isDefault === true,
      }));
      this.error =
        this.notebook && !this.notebooks.some((item) => item.id === this.notebook!.id)
          ? 'The selected notebook is unavailable. Choose another notebook; nothing will be sent to a fallback notebook.'
          : null;
    } catch {
      if (generation === this.generation)
        this.error =
          'Could not load notebooks. Check your connection or sign-in, then Refresh notebooks.';
    }
    return this.getState();
  }
  async selectNotebook(id: unknown) {
    await this.load();
    const selected = this.notebooks.find((item) => item.id === id);
    if (!validOneNoteId(id) || !selected || !(this.refreshToken || this.accessToken))
      throw new Error('Choose an available notebook after signing in');
    await this.atomicWrite(
      path.join(this.directory, 'onenote-notebook.json'),
      JSON.stringify({ clientId: this.clientId, notebook: selected }),
    );
    this.notebook = { ...selected };
    this.pages = [];
    this.error = null;
    return this.getState();
  }
  private async sectionFor(
    notebookId: string,
    headers: Record<string, string>,
    generation: number,
    create = true,
  ): Promise<string> {
    const endpoint = `notebooks/${encodeURIComponent(notebookId)}/sections`;
    const rows = await this.collection(`${endpoint}?$select=id,displayName`, headers, generation);
    const sections = rows.filter((row) => row.displayName === 'TradeFrame');
    if (sections.length > 1) throw new Error('Multiple TradeFrame sections found');
    if (sections.length) return sections[0].id as string;
    if (!create) return '';
    const response = await this.request(graph + endpoint, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'TradeFrame' }),
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (generation !== this.generation) throw new Error('OneNote was disconnected');
    await this.checkResponse(response, 'create the TradeFrame section');
    const section = (await response.json()) as { id?: string; displayName?: string };
    if (generation !== this.generation) throw new Error('OneNote was disconnected');
    if (!validOneNoteId(section.id) || section.displayName !== 'TradeFrame')
      throw new Error('Invalid OneNote section');
    return section.id;
  }
  private async bytes(response: Response, limit: number, generation: number) {
    await this.checkResponse(response, 'download setup content');
    const reader = response.body?.getReader();
    if (!reader) throw new OneNoteError('Microsoft returned no setup content.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
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
  private async content(id: string, headers: Record<string, string>, generation: number) {
    if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
    const response = await this.request(`${graph}pages/${encodeURIComponent(id)}/content`, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    return (await this.bytes(response, 5_000_000, generation)).toString('utf8');
  }
  private async resource(
    value: string,
    headers: Record<string, string>,
    generation: number,
    limit: number,
  ) {
    if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
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
    const response = await this.request(
      `https://graph.microsoft.com/v1.0/${owner.map(encodeURIComponent).join('/')}/onenote/resources/${encodeURIComponent(id)}/content`,
      { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) },
    );
    return this.bytes(response, limit, generation);
  }
  async listSetups(): Promise<OneNotePage[]> {
    await this.load();
    if (!this.notebook) throw new OneNoteError('Choose a OneNote notebook in Connections first.');
    const generation = this.generation;
    const headers = { Authorization: `Bearer ${await this.token()}` };
    const section = await this.sectionFor(this.notebook.id, headers, generation, false);
    if (!section) return (this.pages = []);
    const rows = await this.collection(
      `sections/${encodeURIComponent(section)}/pages?$select=id,title,lastModifiedDateTime`,
      headers,
      generation,
      'title',
    );
    this.pages = rows
      .filter((row) => (row.title as string).startsWith('TradeFrame · '))
      .map((row) => ({
        id: row.id as string,
        title: row.title as string,
        modifiedAt: typeof row.lastModifiedDateTime === 'string' ? row.lastModifiedDateTime : '',
      }));
    return this.pages.map((page) => ({ ...page }));
  }
  async openSetup(id: unknown) {
    if (!validOneNoteId(id) || !this.notebook || !this.pages.some((page) => page.id === id))
      throw new OneNoteError('Refresh the OneNote setup list and choose a page.');
    const generation = this.generation;
    const headers = { Authorization: `Bearer ${await this.token()}` };
    return restoreOneNote(await this.content(id, headers, generation), (url, limit) =>
      this.resource(url, headers, generation, limit),
    );
  }
  async deliver(file: string, section: string, jobId: string, notebookId?: string) {
    if (
      section !== 'TradeFrame' ||
      !clientIdPattern.test(jobId) ||
      (notebookId !== undefined && !validOneNoteId(notebookId))
    )
      throw new Error('Invalid OneNote delivery');
    const loaded = await readSetup(file);
    const pictures = loaded.screenshots.map((shot) => pngBytes(shot.image));
    const snapshot = JSON.stringify({
      formatVersion: 1,
      markdown: loaded.markdown,
      images: pictures.map(imageHash),
    });
    // Graph permits 4 MB and six multipart parts, unlike the underlying OneNote API.
    const limit = 3_900_000;
    if (
      pictures.some((bytes) => bytes.length > limit - 100_000) ||
      Buffer.byteLength(snapshot) > limit - 100_000
    )
      throw new OneNoteError(
        'OneNote needs each screenshot and the setup details below 3.8 MB. Capture a smaller window; your local setup is safe.',
      );
    const accessToken = await this.token();
    const generation = this.generation;
    const title = `TradeFrame · ${String(loaded.values.instrument ?? loaded.values.symbol ?? loaded.schema.name).slice(0, 80)} · ${jobId}`;
    const headers = { Authorization: `Bearer ${accessToken}`, 'client-request-id': jobId };
    const pagesPath = notebookId
      ? `sections/${encodeURIComponent(await this.sectionFor(notebookId, headers, generation))}/pages`
      : 'pages';
    const query = queryString({
      $filter: `title eq '${title.replace(/'/g, "''")}'`,
      $select: 'id,title',
      $top: '2',
    });
    const existing = await this.request(`${graph}${pagesPath}?${query}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
    await this.checkResponse(existing, 'check existing pages');
    const pages = (await existing.json()) as { value?: { id: string; title: string }[] };
    if (
      !Array.isArray(pages.value) ||
      pages.value.some((page) => !validOneNoteId(page.id) || page.title !== title)
    )
      throw new OneNoteError('Microsoft returned an invalid setup list.');
    if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
    if (pages.value.length > 1)
      throw new OneNoteError(
        'Multiple OneNote pages were found for this delivery. Review them before retrying.',
      );
    let pageId = pages.value[0]?.id;
    const uploaded = new Set<number>();
    if (pageId) {
      const html = await this.content(pageId, headers, generation);
      const saved = assets(html, 'object').filter(
        (item) => item['data-attachment'] === snapshotName,
      );
      if (!saved.length && assets(html, 'img').some((item) => /^Chart \d+$/.test(item.alt ?? '')))
        return;
      if (
        saved.length !== 1 ||
        (await this.resource(saved[0].data, headers, generation, 5_000_000)).toString('utf8') !==
          snapshot
      )
        throw new OneNoteError(
          'The existing OneNote page or local setup changed. Save a new copy instead of replacing it.',
        );
      const resources = assets(html, 'img');
      for (const [index, picture] of pictures.entries()) {
        const matches = resources.filter((item) => item.alt === imageAlt(index));
        if (matches.length > 1)
          throw new OneNoteError(
            'The OneNote page contains duplicate screenshots. Review it before retrying.',
          );
        if (matches.length) {
          const bytes = await this.resource(
            matches[0]['data-fullres-src'],
            headers,
            generation,
            32_000_000,
          );
          if (imageHash(bytes) !== imageHash(picture))
            throw new OneNoteError(
              'An uploaded screenshot changed. Save a new copy instead of replacing it.',
            );
          uploaded.add(index);
        }
      }
    }
    const fields = loaded.schema.fields
      .filter((field) => Object.hasOwn(loaded.values, field.id))
      .map(
        (field) =>
          `<h2>${escapeHtml(field.label)}</h2><p>${escapeHtml(Array.isArray(loaded.values[field.id]) ? (loaded.values[field.id] as string[]).join(', ') : (loaded.values[field.id] ?? '')).replace(/\r?\n/g, '<br />')}</p>`,
      )
      .join('');
    const imageHtml = (index: number) => {
      const shot = loaded.screenshots[index];
      return `<h2>Screenshot ${index + 1} · ${escapeHtml(shot.timeframe || 'Timeframe not recorded')}</h2><p>${escapeHtml(shot.caption).replace(/\r?\n/g, '<br />')}</p><img src="name:chart${index}" alt="${imageAlt(index)}" /><p>${escapeHtml(shot.capturedAt)}</p>`;
    };
    const bodyFor = (indices: number[], create: boolean) => {
      const body = new FormData();
      const content = indices.map(imageHtml).join('');
      if (create) {
        const html = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${fields}<p>${escapeHtml(
          journalTags(loaded.schema, loaded.values)
            .map((tag) => `#${tag}`)
            .join(' '),
        )}</p><p>TradeFrame setup snapshot</p><object data-attachment="${snapshotName}" data="name:setup" type="application/json" />${content}</body></html>`;
        body.append('Presentation', new Blob([html], { type: 'text/html; charset=utf-8' }));
        body.append('setup', new Blob([snapshot], { type: 'application/json' }), snapshotName);
      } else
        body.append(
          'Commands',
          new Blob([JSON.stringify([{ target: 'body', action: 'append', content }])], {
            type: 'application/json',
          }),
        );
      for (const index of indices)
        body.append(
          `chart${index}`,
          new Blob([new Uint8Array(pictures[index])], { type: 'image/png' }),
          `chart-${index + 1}.png`,
        );
      return body;
    };
    let remaining = pictures.map((_, index) => index).filter((index) => !uploaded.has(index));
    while (!pageId || remaining.length) {
      const create = !pageId;
      const batch = remaining.slice(0, create ? 4 : 5);
      let body = bodyFor(batch, create);
      while ((await new Response(body).arrayBuffer()).byteLength > limit) {
        if (!batch.length)
          throw new OneNoteError(
            'The OneNote setup details exceed Microsoft Graph’s request limit. Your local setup is safe.',
          );
        batch.pop();
        body = bodyFor(batch, create);
      }
      if (!create && !batch.length)
        throw new OneNoteError(
          'A screenshot exceeds Microsoft Graph’s request limit. Capture a smaller window.',
        );
      if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
      const endpoint = create
        ? `${pagesPath}${notebookId ? '' : `?${queryString({ sectionName: section })}`}`
        : `pages/${encodeURIComponent(pageId!)}/content`;
      const response = await this.request(graph + endpoint, {
        method: create ? 'POST' : 'PATCH',
        headers,
        body,
        signal: AbortSignal.timeout(60_000),
        redirect: 'error',
      });
      await this.checkResponse(
        response,
        create ? 'create the setup page' : 'add the remaining screenshots',
      );
      if (generation !== this.generation) throw new OneNoteError('OneNote was disconnected.');
      remaining = remaining.filter((index) => !batch.includes(index));
      if (create && remaining.length) {
        const page = (await response.json()) as { id?: string };
        if (!validOneNoteId(page.id))
          throw new OneNoteError(
            'Microsoft did not return the new page ID. Retry to find the created page.',
          );
        pageId = page.id;
      }
      if (create && !remaining.length) return;
    }
  }
}
