export type SetupInput = {
  mode: 'live' | 'backtest';
  symbol: string;
  direction: 'long' | 'short';
  model: string;
  timeframe: string;
  entryTimeNewYork: string;
  note: string;
};

export type SaveResult = { status: 'cancelled' } | { status: 'saved'; path: string };

export type CaptureSource = { id: string; name: string; image: string };

export type CaptureState = {
  barOpen: boolean;
  busy: boolean;
  sources: CaptureSource[];
  preview: CaptureSource | null;
  error: string | null;
};

export type CaptureAPI = {
  getState(): Promise<CaptureState>;
  openBar(): Promise<void>;
  takeScreenshot(): Promise<void>;
  chooseSource(id: string): Promise<void>;
  discard(): Promise<void>;
  showJournal(): Promise<void>;
  saveSetup(input: SetupInput): Promise<SaveResult>;
  onStateChange(listener: (state: CaptureState) => void): () => void;
};
