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
  onStateChange(listener: (state: CaptureState) => void): () => void;
};
