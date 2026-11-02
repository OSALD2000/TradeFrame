import type { FormSchema, FormValues } from './form-schema';
import type { FilingRules, FilingRule } from './filing-rules';
export type SetupHelpTopic = 'entra' | 'notebooks' | 'registration' | 'permissions';
export type UnloadAction = 'close' | 'reload';
export type FolderKind = 'journal' | 'obsidian' | 'dropbox';
export type SyncJob = {
  id: string;
  source: string;
  status: 'pending' | 'synced' | 'failed';
  error: string | null;
} & (
  | { kind: 'obsidian' | 'dropbox'; folder: string }
  | { kind: 'onenote'; section: string; notebookId?: string }
);
export type Connections = {
  version: 1 | 2;
  folders: Record<FolderKind, string | null>;
  jobs: SyncJob[];
};
export type OneNoteNotebook = { id: string; displayName: string; isDefault: boolean };
export type OneNotePage = { id: string; title: string; modifiedAt: string };
export const validOneNoteId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 2048 &&
  value !== '.' &&
  value !== '..' &&
  !/[\x00-\x20\x7f]/.test(value);
export type OneNoteState = {
  configured: boolean;
  applicationId: string;
  customApplicationId: boolean;
  connected: boolean;
  durable: boolean;
  section: string;
  error: string | null;
  notebook: OneNoteNotebook | null;
  notebooks: OneNoteNotebook[];
  login: { userCode: string; expiresAt: number } | null;
};
export type SetupInput = { schema: FormSchema; values: FormValues };
export type OpenedSetup = SetupInput & { capture: CaptureState };

export type SaveResult =
  { status: 'cancelled' } | { status: 'saved'; path: string; sync: SyncJob[]; warning?: string };

export type CaptureSource = { id: string; name: string; image: string };
export type Screenshot = {
  id: string;
  image: string;
  caption: string;
  capturedAt: string;
  timeframe: string;
};

export type CaptureState = {
  barOpen: boolean;
  busy: boolean;
  sources: CaptureSource[];
  screenshots: Screenshot[];
  savedPath: string | null;
  requiresTimeframeCopy: boolean;
  error: string | null;
};

export type CaptureAPI = {
  getFilingRules(): Promise<FilingRules>;
  saveFilingRule(kind: FolderKind, rule: FilingRule): Promise<FilingRules>;
  openSetupHelp(topic: SetupHelpTopic): Promise<void>;
  answerUnload(confirmed: boolean): Promise<void>;
  onUnloadRequested(listener: (action: UnloadAction) => void): () => void;
  getState(): Promise<CaptureState>;
  openBar(): Promise<void>;
  takeScreenshot(): Promise<void>;
  chooseSource(id: string): Promise<void>;
  discard(): Promise<void>;
  removeScreenshot(id: string): Promise<void>;
  captionScreenshot(id: string, caption: string): Promise<void>;
  setScreenshotTimeframe(id: string, timeframe: string): Promise<void>;
  newSetup(): Promise<void>;
  showJournal(): Promise<void>;
  saveSetup(input: SetupInput): Promise<SaveResult>;
  appendScreenshots(input: SetupInput): Promise<SaveResult>;
  getSchemas(): Promise<FormSchema[]>;
  saveSchema(schema: FormSchema): Promise<FormSchema>;
  openSetup(): Promise<OpenedSetup | null>;
  getConnections(): Promise<Connections>;
  connectFolder(kind: FolderKind): Promise<Connections>;
  disconnectFolder(kind: FolderKind): Promise<Connections>;
  retrySync(): Promise<Connections>;
  getOneNote(): Promise<OneNoteState>;
  configureOneNote(clientId: string): Promise<OneNoteState>;
  connectOneNote(): Promise<OneNoteState>;
  pollOneNote(): Promise<OneNoteState>;
  disconnectOneNote(): Promise<OneNoteState>;
  refreshOneNoteNotebooks(): Promise<OneNoteState>;
  selectOneNoteNotebook(id: string): Promise<OneNoteState>;
  listOneNoteSetups(): Promise<OneNotePage[]>;
  openOneNoteSetup(id: string): Promise<OpenedSetup & { legacy: boolean }>;
  sendToOneNote(): Promise<SaveResult>;
  openMicrosoftLogin(): Promise<void>;
  onStateChange(listener: (state: CaptureState) => void): () => void;
};

export type OneNoteBrowserAPI = Pick<CaptureAPI, 'getOneNote' | 'listOneNoteSetups'>;

export type OneNoteConnectionAPI = Pick<
  CaptureAPI,
  | 'getOneNote'
  | 'configureOneNote'
  | 'connectOneNote'
  | 'pollOneNote'
  | 'disconnectOneNote'
  | 'refreshOneNoteNotebooks'
  | 'selectOneNoteNotebook'
  | 'openMicrosoftLogin'
>;

export type SaveDestinationsAPI = Pick<CaptureAPI, 'getConnections' | 'getOneNote'>;

export type ConnectionsAPI = Pick<
  CaptureAPI,
  'getConnections' | 'connectFolder' | 'disconnectFolder' | 'retrySync'
> &
  OneNoteConnectionAPI &
  FilingRulesAPI;

export type FilingRulesAPI = Pick<CaptureAPI, 'getFilingRules' | 'saveFilingRule'>;
export type SetupGuideAPI = Pick<CaptureAPI, 'getOneNote' | 'openSetupHelp'>;

export type SetupDraftAPI = Pick<
  CaptureAPI,
  | 'newSetup'
  | 'saveSetup'
  | 'appendScreenshots'
  | 'getSchemas'
  | 'saveSchema'
  | 'openSetup'
  | 'openOneNoteSetup'
  | 'sendToOneNote'
  | 'answerUnload'
  | 'onUnloadRequested'
>;

export type SetupFormAPI = SetupDraftAPI & OneNoteBrowserAPI & SaveDestinationsAPI;
