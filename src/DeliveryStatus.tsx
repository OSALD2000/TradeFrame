import type { SaveResult } from '../electron/capture-types';

export function DeliveryStatus({ result }: { result: SaveResult }) {
  if (result.status !== 'saved') return null;
  const failed = result.sync.some((job) => job.status !== 'synced');
  return <section className="delivery-status" aria-label="Last save result" role="status">
    <strong>Saved locally{failed ? ' · delivery needs attention' : ''}</strong>
    <p className="saved-path">{result.path}</p>
    {result.sync.length > 0 && <ul>{result.sync.map((job) => <li key={job.id}>
      <strong>{job.kind === 'onenote' ? 'OneNote' : job.kind === 'obsidian' ? 'Obsidian' : 'Dropbox folder'}:</strong>{' '}
      {job.status === 'synced' ? job.kind === 'onenote' ? 'Sent to your notebook' : 'Files saved' : job.error ?? 'Waiting to send'}
    </li>)}</ul>}
    {result.warning && <p>{result.warning}</p>}
    {(failed || result.warning) && <a href="#connections">Review connections and retry</a>}
  </section>;
}
