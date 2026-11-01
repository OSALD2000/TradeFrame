import { useEffect, useState } from 'react';
import type { CaptureAPI, Connections, OneNoteState } from '../electron/capture-types';

export function DestinationSummary({
  connections,
  oneNote,
}: {
  connections: Connections;
  oneNote: OneNoteState;
}) {
  return (
    <ul className="save-destinations" aria-label="Save destinations">
      <li>
        <strong>
          Local journal <span>Required local copy</span>
        </strong>
        <span>
          {connections.folders.journal ?? 'Choose a folder when you save for the first time'}
        </span>
      </li>
      <li>
        <strong>
          Obsidian <span>{connections.folders.obsidian ? 'Folder selected' : 'Not connected'}</span>
        </strong>
        <span>{connections.folders.obsidian ?? 'Optional'}</span>
      </li>
      <li>
        <strong>
          Dropbox <span>{connections.folders.dropbox ? 'Folder selected' : 'Not connected'}</span>
        </strong>
        <span>
          {connections.folders.dropbox
            ? 'Files are saved to your Dropbox folder; its desktop app handles cloud sync'
            : 'Optional'}
        </span>
      </li>
      <li>
        <strong>
          OneNote{' '}
          <span>
            {oneNote.connected
              ? oneNote.notebook
                ? 'Notebook selected'
                : 'Choose a notebook'
              : oneNote.notebook
                ? 'Sign in again'
                : 'Not connected'}
          </span>
        </strong>
        <span>
          {oneNote.connected && oneNote.notebook
            ? `${oneNote.notebook.displayName} / TradeFrame`
            : 'Connect and choose a notebook to send this setup'}
          {oneNote.connected && !oneNote.durable && ' · Sign-in lasts this session only'}
        </span>
      </li>
    </ul>
  );
}

export function SaveDestinations({
  api,
  busy,
  visible,
}: {
  api: CaptureAPI | undefined;
  busy: boolean;
  visible: boolean;
}) {
  const [data, setData] = useState<{ connections: Connections; oneNote: OneNoteState } | null>(
    null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!api || busy || !visible) return;
    let active = true;
    Promise.all([api.getConnections(), api.getOneNote()])
      .then(([connections, oneNote]) => {
        if (active) {
          setData({ connections, oneNote });
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [api, busy, visible]);
  return (
    <div className="save-destination-summary">
      <p>Save a local copy and send it to the destinations selected below.</p>
      {error ? (
        <p role="alert">Could not check destinations. Review Connections before sending.</p>
      ) : data ? (
        <DestinationSummary {...data} />
      ) : (
        <p>{api ? 'Checking destinations…' : 'Choose destinations in the desktop app.'}</p>
      )}
      <a href="#connections">Manage destinations</a>
    </div>
  );
}
