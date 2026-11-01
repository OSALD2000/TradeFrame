import type { ConnectorDelivery, OneNoteDelivery, SetupConnector } from './connector';
import { OneNoteError } from './onenote-error';

export class OneNoteConnector implements SetupConnector {
  constructor(
    private section: string,
    private notebookId: string | undefined,
    private deliverOneNote: OneNoteDelivery | undefined,
  ) {}

  deliver(delivery: ConnectorDelivery): Promise<void> {
    const deliver = this.deliverOneNote;
    if (!deliver) throw new Error('OneNote is not connected');
    return deliver(delivery.source, this.section, delivery.id, this.notebookId);
  }

  failureMessage(cause: unknown): string {
    return cause instanceof OneNoteError
      ? cause.message
      : 'Could not sync OneNote. Check your sign-in, connection and setup size, then retry.';
  }
}
