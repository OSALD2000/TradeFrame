import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { SafeStorage } from 'electron';
import type { OneNoteState } from './capture-types';
import { readSetup, pngBytes } from './journal';
import { valueTags } from './form-schema';

type Encryption = Pick<SafeStorage, 'isAsyncEncryptionAvailable' | 'encryptStringAsync' | 'decryptStringAsync' | 'getSelectedStorageBackend'>;
const identity = 'https://login.microsoftonline.com/common/oauth2/v2.0/';
const graph = 'https://graph.microsoft.com/v1.0/me/onenote/';
const scope = 'https://graph.microsoft.com/Notes.ReadWrite offline_access';
const clientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeHtml = (text: unknown) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export class OneNoteClient {
  private clientId = '';
  private refreshToken = '';
  private accessToken = '';
  private expiresAt = 0;
  private durable = false;
  private error: string | null = null;
  private loaded: Promise<void> | null = null;
  private generation = 0;
  private polling = false;
  private login: { deviceCode: string; userCode: string; expiresAt: number; interval: number; nextPoll: number } | null = null;

  constructor(private directory: string, private encryption: Encryption, private publisherClientId = '',
    private request: typeof fetch = fetch, private now: () => number = Date.now) {}

  private async atomicWrite(file: string, value: string | Buffer) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, value, { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
    finally { await rm(temporary, { force: true }); }
  }
  private async load() {
    if (!this.loaded) this.loaded = (async () => {
      this.clientId = clientIdPattern.test(this.publisherClientId) ? this.publisherClientId : '';
      try {
        const config = JSON.parse(await readFile(path.join(this.directory, 'onenote.json'), 'utf8'));
        if (!clientIdPattern.test(config.clientId)) throw new Error('Invalid Microsoft application ID');
        this.clientId = config.clientId;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.error = 'Could not load OneNote settings. Configure the Microsoft application again.';
      }
      try {
        const encrypted = await readFile(path.join(this.directory, 'onenote-token.bin'));
        if (encrypted.length > 100_000 || !await this.secureStorage()) throw new Error('Secure storage unavailable');
        const decrypted = await this.encryption.decryptStringAsync(encrypted);
        const token = JSON.parse(decrypted.result);
        if (token.clientId !== this.clientId || typeof token.refreshToken !== 'string' || token.refreshToken.length > 50_000) throw new Error('Invalid credentials');
        this.refreshToken = token.refreshToken;
        this.durable = true;
        if (decrypted.shouldReEncrypt) await this.persistToken();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.error = 'OneNote needs to be reconnected. Check that your system keyring is unlocked.';
      }
    })();
    await this.loaded;
  }
  private async secureStorage() {
    if (!await this.encryption.isAsyncEncryptionAvailable()) return false;
    return process.platform !== 'linux' || ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(this.encryption.getSelectedStorageBackend());
  }
  private async persistToken() {
    this.durable = false;
    if (!this.refreshToken || !await this.secureStorage()) return;
    const encrypted = await this.encryption.encryptStringAsync(JSON.stringify({ clientId: this.clientId, refreshToken: this.refreshToken }));
    await this.atomicWrite(path.join(this.directory, 'onenote-token.bin'), encrypted);
    this.durable = true;
  }
  async getState(): Promise<OneNoteState> {
    await this.load();
    if (this.login && this.now() >= this.login.expiresAt) { this.login = null; this.error = 'Sign-in expired. Connect again to get a new code.'; }
    return { configured: !!this.clientId, connected: !!(this.refreshToken || this.accessToken), durable: this.durable,
      section: 'TradeFrame', error: this.error, login: this.login ? { userCode: this.login.userCode, expiresAt: this.login.expiresAt } : null };
  }
  async configure(clientId: unknown) {
    await this.load();
    if (typeof clientId !== 'string' || !clientIdPattern.test(clientId)) throw new Error('Enter a valid Microsoft application ID');
    await this.disconnect();
    await this.atomicWrite(path.join(this.directory, 'onenote.json'), JSON.stringify({ clientId }));
    this.clientId = clientId;
    return this.getState();
  }
  private async tokenRequest(endpoint: 'token' | 'devicecode', body: Record<string, string>) {
    const response = await this.request(identity + endpoint, { method: 'POST', body: new URLSearchParams({ client_id: this.clientId, ...body }),
      signal: AbortSignal.timeout(15_000), redirect: 'error' });
    const data = await response.json() as Record<string, unknown>;
    return { response, data };
  }
  async begin() {
    await this.load();
    if (!this.clientId) throw new Error('The publisher must configure a Microsoft application ID before OneNote can connect');
    const generation = ++this.generation;
    const { response, data } = await this.tokenRequest('devicecode', { scope });
    if (generation !== this.generation) return this.getState();
    if (!response.ok || typeof data.device_code !== 'string' || typeof data.user_code !== 'string'
      || data.user_code.length > 40 || typeof data.expires_in !== 'number' || data.expires_in < 1 || data.expires_in > 3600
      || typeof data.interval !== 'number' || data.interval < 1 || data.interval > 60) throw new Error('Microsoft sign-in could not start. Check the application registration and network.');
    this.error = null;
    this.login = { deviceCode: data.device_code, userCode: data.user_code, expiresAt: this.now() + data.expires_in * 1000,
      interval: data.interval * 1000, nextPoll: this.now() + data.interval * 1000 };
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
      const { response, data } = await this.tokenRequest('token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: login.deviceCode });
      if (generation !== this.generation) return this.getState();
      if (response.ok) { await this.acceptToken(data); this.login = null; }
      else if (data.error === 'slow_down') { login.interval += 5000; login.nextPoll = this.now() + login.interval; }
      else if (data.error === 'authorization_pending') this.error = null;
      else if (data.error !== 'authorization_pending') { this.login = null; this.error = 'Sign-in was declined or expired. Connect again to retry.'; }
    } catch { this.error = 'Could not reach Microsoft. Check your connection; sign-in will retry until the code expires.'; }
    finally { this.polling = false; }
    return this.getState();
  }
  private async acceptToken(data: Record<string, unknown>) {
    if (typeof data.access_token !== 'string' || data.access_token.length > 50_000 || typeof data.expires_in !== 'number' || data.expires_in < 60
      || (data.refresh_token !== undefined && (typeof data.refresh_token !== 'string' || data.refresh_token.length > 50_000))) throw new Error('Invalid Microsoft token response');
    this.accessToken = data.access_token;
    this.expiresAt = this.now() + data.expires_in * 1000;
    if (typeof data.refresh_token === 'string') this.refreshToken = data.refresh_token;
    this.error = null;
    try { await this.persistToken(); }
    catch { this.durable = false; this.error = 'Connected for this session. Could not save the sign-in securely; reconnect after restarting.'; }
  }
  private async token() {
    await this.load();
    if (this.accessToken && this.now() < this.expiresAt - 60_000) return this.accessToken;
    if (!this.refreshToken) throw new Error('Connect OneNote before syncing');
    const generation = this.generation;
    const { response, data } = await this.tokenRequest('token', { grant_type: 'refresh_token', refresh_token: this.refreshToken, scope });
    if (generation !== this.generation) throw new Error('OneNote was disconnected');
    if (!response.ok) {
      if (data.error === 'invalid_grant') {
        this.refreshToken = ''; this.accessToken = ''; this.durable = false; this.error = 'OneNote authorization expired. Connect again.';
        await rm(path.join(this.directory, 'onenote-token.bin'), { force: true });
      }
      throw new Error('OneNote could not refresh its sign-in. Reconnect if this persists.');
    }
    await this.acceptToken(data);
    return this.accessToken;
  }
  async disconnect() {
    await this.load();
    await rm(path.join(this.directory, 'onenote-token.bin'), { force: true });
    this.generation++;
    this.login = null; this.refreshToken = ''; this.accessToken = ''; this.expiresAt = 0; this.durable = false; this.error = null;
    return this.getState();
  }
  async deliver(file: string, section: string, jobId: string) {
    if (section !== 'TradeFrame' || !clientIdPattern.test(jobId)) throw new Error('Invalid OneNote delivery');
    const loaded = await readSetup(file);
    const accessToken = await this.token();
    const generation = this.generation;
    const title = `TradeFrame · ${String(loaded.values.symbol ?? loaded.schema.name).slice(0, 80)} · ${jobId}`;
    const headers = { Authorization: `Bearer ${accessToken}`, 'client-request-id': jobId };
    const query = new URLSearchParams({ '$filter': `title eq '${title.replace(/'/g, "''")}'`, '$select': 'id,title', '$top': '2' });
    const existing = await this.request(`${graph}pages?${query}`, { headers, signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (generation !== this.generation) throw new Error('OneNote was disconnected');
    if (!existing.ok) { if (existing.status === 401) this.accessToken = ''; throw new Error('Could not check OneNote before syncing'); }
    const pages = await existing.json() as { value?: { id: string; title: string }[] };
    if (!Array.isArray(pages.value) || pages.value.some((page) => typeof page.id !== 'string' || page.title !== title)) throw new Error('Invalid OneNote response');
    if (pages.value.length === 1) return;
    if (pages.value.length > 1) throw new Error('Multiple OneNote pages found for this delivery');
    const fields = loaded.schema.fields.filter((field) => Object.hasOwn(loaded.values, field.id)).map((field) =>
      `<h2>${escapeHtml(field.label)}</h2><p>${escapeHtml(Array.isArray(loaded.values[field.id]) ? (loaded.values[field.id] as string[]).join(', ') : loaded.values[field.id] ?? '').replace(/\r?\n/g, '<br />')}</p>`).join('');
    const images = loaded.screenshots.map((shot, index) => `<h2>Screenshot ${index + 1}</h2><p>${escapeHtml(shot.caption)}</p><img src="name:chart${index}" alt="Chart ${index + 1}" /><p>${escapeHtml(shot.capturedAt)}</p>`).join('');
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${images}${fields}<p>${escapeHtml(valueTags(loaded.schema, loaded.values).map((tag) => `#${tag}`).join(' '))}</p></body></html>`;
    const body = new FormData();
    body.append('Presentation', new Blob([html], { type: 'text/html' }));
    let bytes = Buffer.byteLength(html);
    loaded.screenshots.forEach((shot, index) => {
      const png = pngBytes(shot.image); bytes += png.length;
      body.append(`chart${index}`, new Blob([new Uint8Array(png)], { type: 'image/png' }), `chart-${index + 1}.png`);
    });
    // OneNote has a lower request limit than the local journal; keep the local save regardless.
    if (bytes > 70_000_000) throw new Error('This setup is too large for OneNote');
    const response = await this.request(`${graph}pages?${new URLSearchParams({ sectionName: section })}`, {
      method: 'POST', headers, body, signal: AbortSignal.timeout(60_000), redirect: 'error',
    });
    if (!response.ok) { if (response.status === 401) this.accessToken = ''; throw new Error('OneNote upload failed. Retry checks for an existing page first.'); }
  }
}
