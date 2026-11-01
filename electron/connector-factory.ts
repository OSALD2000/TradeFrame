import type { SyncJob } from './capture-types';
import type { OneNoteDelivery, SetupConnector } from './connector';
import { FolderConnector } from './folder-connector';
import { OneNoteConnector } from './onenote-connector';

export function createConnector(job: SyncJob, deliverOneNote?: OneNoteDelivery): SetupConnector {
  switch (job.kind) {
    case 'obsidian':
    case 'dropbox':
      return new FolderConnector(job.folder, job.kind);
    case 'onenote':
      return new OneNoteConnector(job.section, job.notebookId, deliverOneNote);
  }
  const _unsupported: never = job;
  throw new Error('Unsupported connector');
}
