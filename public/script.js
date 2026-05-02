function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) setFile(file);
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('dragging');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) {
    document.getElementById('fileInput').files = e.dataTransfer.files;
    setFile(file);
  }
}

function setFile(file) {
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('uploadBtn').disabled = false;
}

function setOutput(text, label) {
  const out = document.getElementById('output');
  out.classList.remove('loading');
  out.textContent = text;
  if (label) document.getElementById('outputLabel').textContent = label;
}

function setLoading(label) {
  const out = document.getElementById('output');
  out.classList.add('loading');
  out.textContent = 'Fetching results...';
  document.getElementById('outputLabel').textContent = label || 'Loading...';
}

function copyOutput() {
  navigator.clipboard.writeText(document.getElementById('output').textContent);
}

function showOutput(data, label) {
  if (data === null || data === undefined) { setOutput('No result', label); return; }

  if (!Array.isArray(data) && typeof data === 'object') {
    if (Object.keys(data).length === 0) { setOutput('No result', label); return; }
    if (data.product && data.maxRevenue !== undefined) {
      setOutput(`Product: ${data.product}\nCategory: ${data.category}\nMax Revenue: $${data.maxRevenue}`, label); return;
    }
    if (data.product && data.minRevenue !== undefined) {
      setOutput(`Product: ${data.product}\nCategory: ${data.category}\nMin Revenue: $${data.minRevenue}`, label); return;
    }
    if (data.averageRevenue !== undefined) {
      setOutput(`Average Revenue: $${data.averageRevenue.toFixed(2)}`, label); return;
    }
    if (data.totalProducts !== undefined) {
      setOutput(`Total Products: ${data.totalProducts}`, label); return;
    }
    if (data.message !== undefined) {
      setOutput(data.message + (data.inserted !== undefined ? `\n${data.inserted} records inserted` : ''), label); return;
    }
  }

  if (Array.isArray(data)) {
    if (data.length === 0) { setOutput('No results found', label); return; }
    const lines = data.map((row, i) => {
      const product  = row.product  ?? '-';
      const category = row.category ?? '-';
      const price    = row.price    ?? '-';
      const quantity = row.quantity ?? '-';
      const revenue  = row.revenue  ?? '-';
      return `${String(i+1).padStart(2,'0')}. ${product} (${category})\n    Price: $${price}  |  Qty: ${quantity}  |  Revenue: $${revenue}`;
    });
    setOutput(lines.join('\n\n'), label);
    return;
  }

  setOutput(JSON.stringify(data, null, 2), label);
}

async function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) { alert('Please select a file'); return; }

  setLoading('Uploading...');
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/upload', { method: 'POST', body: formData });
  const data = await res.json();
  showOutput(data, 'Upload Result');

  if (data.inserted) {
    document.getElementById('statusPill').textContent = `${data.inserted} Records Loaded`;
    document.getElementById('statusPill').classList.add('active');
    document.getElementById('statsRow').style.display = 'grid';
    refreshStats();
  }
}

async function refreshStats() {
  const [countRes, maxRes, minRes, avgRes] = await Promise.all([
    fetch('/count'), fetch('/max'), fetch('/min'), fetch('/average')
  ]);
  const count = await countRes.json();
  const max   = await maxRes.json();
  const min   = await minRes.json();
  const avg   = await avgRes.json();

  document.getElementById('statCount').textContent = count.totalProducts ?? '—';
  document.getElementById('statMax').textContent   = max.maxRevenue  != null ? `$${parseFloat(max.maxRevenue).toFixed(2)}` : '—';
  document.getElementById('statMin').textContent   = min.minRevenue  != null ? `$${parseFloat(min.minRevenue).toFixed(2)}` : '—';
  document.getElementById('statAvg').textContent   = avg.averageRevenue != null ? `$${avg.averageRevenue.toFixed(0)}` : '—';
}

async function getMax()     { setLoading('Max Revenue'); const r = await fetch('/max');     showOutput(await r.json(), 'Max Revenue'); }
async function getMin()     { setLoading('Min Revenue'); const r = await fetch('/min');     showOutput(await r.json(), 'Min Revenue'); }
async function getCount()   { setLoading('Count');       const r = await fetch('/count');   showOutput(await r.json(), 'Count'); }
async function getAverage() { setLoading('Average');     const r = await fetch('/average'); showOutput(await r.json(), 'Average Revenue'); }

async function getFilter(operator, label) {
  const value = prompt(`Enter revenue value for "${label}":`, '5000');
  if (value === null) return;
  setLoading(label);
  const r = await fetch(`/filter?operator=${operator}&value=${encodeURIComponent(value)}`);
  showOutput(await r.json(), label);
}

function getGreaterThan() { return getFilter('gt', 'Greater Than'); }
function getLessThan()    { return getFilter('lt', 'Less Than'); }
function getEqualTo()     { return getFilter('eq', 'Equal To'); }

async function getSort(order) {
  const field = prompt('Sort by field:\nproduct, category, price, quantity, revenue', 'revenue');
  if (field === null) return;
  setLoading(`Sort ${order.toUpperCase()}`);
  const r = await fetch(`/sort?field=${encodeURIComponent(field.trim())}&order=${order}`);
  showOutput(await r.json(), `Sort by ${field} (${order})`);
}

async function getSkip() {
  const skip = prompt('Enter number of records to skip:', '0');
  if (skip === null) return;
  setLoading('Skip');
  const r = await fetch(`/skip?skip=${encodeURIComponent(skip)}`);
  showOutput(await r.json(), `Skip ${skip}`);
}

async function getLimit() {
  const limit = prompt('Enter limit value:', '10');
  if (limit === null) return;
  setLoading('Limit');
  const r = await fetch(`/limit?limit=${encodeURIComponent(limit)}`);
  showOutput(await r.json(), `Limit ${limit}`);
}
