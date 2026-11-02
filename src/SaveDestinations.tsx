import { useEffect, useState } from 'react';
import { DEFAULT_SAVE_DESTINATIONS } from '../electron/capture-types';
import type {
  SaveDestinationsAPI,
  SaveDestinations as Selection,
  Connections,
  OneNoteState,
} from '../electron/capture-types';

type Choices = {
  selected: Selection;
  onChange(kind: keyof Selection, checked: boolean): void;
  busy?: boolean;
};

export function DestinationSummary({
  connections,
  oneNote,
  selected = DEFAULT_SAVE_DESTINATIONS,
  onChange,
  busy = false,
}: {
  connections: Connections | null;
  oneNote: OneNoteState | null;
} & Choices) {
  const folders = connections?.folders;
  const choices: {
    kind: keyof Selection;
    name: string;
    available: boolean;
    status: string;
    detail: string;
  }[] = [
    {
      kind: 'journal',
      name: 'Local journal',
      available: true,
      status: 'Optional',
      detail: folders?.journal ?? 'Choose a folder when you save here for the first time',
    },
    {
      kind: 'obsidian',
      name: 'Obsidian',
      available: !!folders?.obsidian,
      status: !connections
        ? 'Not checked'
        : folders?.obsidian
          ? 'Folder selected'
          : 'Not connected',
      detail: folders?.obsidian ?? 'Connect a folder to select this destination',
    },
    {
      kind: 'dropbox',
      name: 'Dropbox',
      available: !!folders?.dropbox,
      status: !connections ? 'Not checked' : folders?.dropbox ? 'Folder selected' : 'Not connected',
      detail: folders?.dropbox
        ? 'Files go to your Dropbox folder; its desktop app handles cloud sync'
        : 'Connect a folder to select this destination',
    },
    {
      kind: 'onenote',
      name: 'OneNote',
      available: !!oneNote?.connected && !!oneNote.notebook,
      status: !oneNote
        ? 'Not checked'
        : oneNote.connected
          ? oneNote.notebook
            ? 'Notebook selected'
            : 'Choose a notebook'
          : oneNote?.notebook
            ? 'Sign in again'
            : 'Not connected',
      detail:
        (oneNote?.connected && oneNote.notebook
          ? `${oneNote.notebook.displayName} / TradeFrame`
          : 'Connect and choose a notebook to select this destination') +
        (oneNote?.connected && !oneNote.durable ? ' · Sign-in lasts this session only' : ''),
    },
  ];
  return (
    <ul className="save-destinations" aria-label="Save destinations">
      {choices.map((choice) => (
        <li key={choice.kind}>
          <label className="destination-choice">
            <input
              type="checkbox"
              aria-label={`Save to ${choice.name}`}
              checked={selected[choice.kind]}
              disabled={busy || (!choice.available && !selected[choice.kind])}
              onChange={(event) => onChange(choice.kind, event.target.checked)}
            />
            <strong>
              {choice.name}
              <span>{choice.status}</span>
            </strong>
          </label>
          <span>{choice.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function SaveDestinations({
  api,
  busy,
  visible,
  selected,
  onChange,
}: {
  api: SaveDestinationsAPI | undefined;
  busy: boolean;
  visible: boolean;
} & Choices) {
  const [data, setData] = useState<{
    connections: Connections | null;
    oneNote: OneNoteState | null;
  }>({ connections: null, oneNote: null });
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!api || busy || !visible) return;
    let active = true;
    Promise.allSettled([api.getConnections(), api.getOneNote()]).then(([connections, oneNote]) => {
      if (!active) return;
      setData({
        connections: connections.status === 'fulfilled' ? connections.value : null,
        oneNote: oneNote.status === 'fulfilled' ? oneNote.value : null,
      });
      setError(connections.status === 'rejected' || oneNote.status === 'rejected');
    });
    return () => {
      active = false;
    };
  }, [api, busy, visible]);
  return (
    <fieldset className="save-destination-summary" disabled={busy || !api}>
      <legend>Save destinations</legend>
      <p>Choose where to save this setup. Only checked destinations receive it.</p>
      {error && (
        <p role="status">
          Some connections could not be checked. Available destinations can still be used.
        </p>
      )}
      <DestinationSummary {...data} selected={selected} onChange={onChange} busy={busy} />
      {!Object.values(selected).some(Boolean) && (
        <p role="status">Choose at least one destination.</p>
      )}
      {!selected.journal && (
        <p>A private recovery copy stays on this device for retries and follow-up screenshots.</p>
      )}
      {selected.journal && (
        <p>
          If your journal folder is inside Obsidian or Dropbox, those apps can still see its files
          without a separate delivery.
        </p>
      )}
      <a href="#connections">Manage destinations</a>
    </fieldset>
  );
}
