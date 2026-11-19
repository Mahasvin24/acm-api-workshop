const status = document.querySelector('#status');
const rows = document.querySelector('#registrations');
let loading = false;
let lastUpdated;

async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch('/api/apis', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Could not load registrations');
    const { apis } = await response.json();
    const entries = apis.map(api => {
      const row = document.createElement('tr');
      for (const field of ['creator', 'name', 'description', 'ip', 'port']) {
        const cell = document.createElement('td');
        cell.textContent = api[field];
        row.append(cell);
      }
      return row;
    });
    rows.replaceChildren(...entries);
    lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    status.textContent = apis.length
      ? `${apis.length} registered · Updated ${lastUpdated}`
      : 'No registrations yet.';
  } catch {
    status.textContent = lastUpdated
      ? `Couldn’t refresh. Showing registrations from ${lastUpdated}. Retrying shortly.`
      : 'Couldn’t load registrations. Retrying shortly.';
  } finally { loading = false; }
}

const logo = document.querySelector('#logo');
logo.addEventListener('error', () => { logo.hidden = true; });
if (logo.complete && !logo.naturalWidth) logo.hidden = true;
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 10000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
