import type { SyncJob } from './capture-types';

export type ConnectorDelivery = Pick<SyncJob, 'id' | 'source'>;

export type OneNoteDelivery = (
  source: string,
  section: string,
  id: string,
  notebookId?: string,
) => Promise<void>;

export interface SetupConnector {
  deliver(delivery: ConnectorDelivery): Promise<unknown>;
  failureMessage(cause: unknown): string;
}
