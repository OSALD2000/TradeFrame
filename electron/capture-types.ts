import type { FormSchema, FormValues } from './form-schema';
export type FolderKind = 'journal' | 'obsidian' | 'dropbox';
export type SyncJob = { id: string; source: string; status: 'pending' | 'synced' | 'failed'; error: string | null }
  & ({ kind: 'obsidian' | 'dropbox'; folder: string } | { kind: 'onenote'; section: string });
export type Connections = { version: 1; folders: Record<FolderKind, string | null>; jobs: SyncJob[] };
export type OneNoteState = { configured: boolean; connected: boolean; durable: boolean; section: string; error: string | null;
  login: { userCode: string; expiresAt: number } | null };
export type SetupInput = { schema: FormSchema; values: FormValues };

export type SaveResult = { status: 'cancelled' } | { status: 'saved'; path: string; sync: SyncJob[]; warning?: string };

export type CaptureSource = { id: string; name: string; image: string };
export type Screenshot = { id: string; image: string; caption: string; capturedAt: string };

export type CaptureState = {
  barOpen: boolean;
  busy: boolean;
  sources: CaptureSource[];
  screenshots: Screenshot[];
  savedPath: string | null;
  error: string | null;
};

export type CaptureAPI = {
  getState(): Promise<CaptureState>;
  openBar(): Promise<void>;
  takeScreenshot(): Promise<void>;
  chooseSource(id: string): Promise<void>;
  discard(): Promise<void>;
  removeScreenshot(id: string): Promise<void>;
  captionScreenshot(id: string, caption: string): Promise<void>;
  newSetup(): Promise<void>;
  showJournal(): Promise<void>;
  saveSetup(input: SetupInput): Promise<SaveResult>;
  appendScreenshots(input: SetupInput): Promise<SaveResult>;
  getSchemas(): Promise<FormSchema[]>;
  saveSchema(schema: FormSchema): Promise<FormSchema>;
  openSetup(): Promise<SetupInput | null>;
  getConnections(): Promise<Connections>;
  connectFolder(kind: FolderKind): Promise<Connections>;
  disconnectFolder(kind: FolderKind): Promise<Connections>;
  retrySync(): Promise<Connections>;
  getOneNote(): Promise<OneNoteState>;
  configureOneNote(clientId: string): Promise<OneNoteState>;
  connectOneNote(): Promise<OneNoteState>;
  pollOneNote(): Promise<OneNoteState>;
  disconnectOneNote(): Promise<OneNoteState>;
  openMicrosoftLogin(): Promise<void>;
  onStateChange(listener: (state: CaptureState) => void): () => void;
};
