/* ══════════════════════════════════════════════════════════
   χ² StatLab — Main Script
══════════════════════════════════════════════════════════ */

// ──────────────────────────────────────
// STATE
// ──────────────────────────────────────
let lastResult = null;

// Critical value lookup (client-side, mirrors Python backend)
const CRIT = {
  0.10:{1:2.706,2:4.605,3:6.251,4:7.779,5:9.236,6:10.645,7:12.017,8:13.362,9:14.684,10:15.987,
        11:17.275,12:18.549,13:19.812,14:21.064,15:22.307,16:23.542,17:24.769,18:25.989,19:27.204,20:28.412},
  0.05:{1:3.841,2:5.991,3:7.815,4:9.488,5:11.070,6:12.592,7:14.067,8:15.507,9:16.919,10:18.307,
        11:19.675,12:21.026,13:22.362,14:23.685,15:24.996,16:26.296,17:27.587,18:28.869,19:30.144,20:31.410},
  0.01:{1:6.635,2:9.210,3:11.345,4:13.277,5:15.086,6:16.812,7:18.475,8:20.090,9:21.666,10:23.209,
        11:24.725,12:26.217,13:27.688,14:29.141,15:30.578,16:32.000,17:33.409,18:34.805,19:36.191,20:37.566},
};

// ──────────────────────────────────────
// INIT
// ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  buildTable();
  buildRefTable();
});

// ──────────────────────────────────────
// NAVIGATION HELPER
// ──────────────────────────────────────
function scrollToSection(id, el) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  const section = document.getElementById(id);
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ──────────────────────────────────────
// TABS
// ──────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('results-section').classList.add('hidden');
  lastResult = null;
}

// ──────────────────────────────────────
// TOGGLE COLLAPSIBLE
// ──────────────────────────────────────
function toggleSection(bodyId, arrowId) {
  const body  = document.getElementById(bodyId);
  const arrow = document.getElementById(arrowId);
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display  = hidden ? '' : 'none';
  arrow.classList.toggle('open', hidden);
}

// ──────────────────────────────────────
// EXAMPLE DATA
// ──────────────────────────────────────
function loadGOFExample() {
  document.getElementById('gof-observed').value = '30, 25, 20, 15, 10';
  document.getElementById('gof-expected').value = '20, 20, 20, 20, 20';
  document.getElementById('gof-alpha').value = '0.05';
}

function loadIndExample() {
  document.getElementById('ind-rows').value = 2;
  document.getElementById('ind-cols').value = 3;
  buildTable();
  const inputs = document.querySelectorAll('#ind-table input');
  const vals   = [30, 10, 20, 15, 25, 5];
  inputs.forEach((inp, i) => { inp.value = vals[i] ?? 0; });
  document.getElementById('ind-alpha').value = '0.05';
}

// ──────────────────────────────────────
// BUILD INDEPENDENCE INPUT TABLE
// ──────────────────────────────────────
function buildTable() {
  const rows  = parseInt(document.getElementById('ind-rows').value) || 2;
  const cols  = parseInt(document.getElementById('ind-cols').value) || 2;
  const table = document.getElementById('ind-table');

  let html = '<thead><tr><th></th>';
  for (let c = 1; c <= cols; c++) html += `<th>Col ${c}</th>`;
  html += '</tr></thead><tbody>';

  for (let r = 1; r <= rows; r++) {
    html += `<tr><th>Row ${r}</th>`;
    for (let c = 1; c <= cols; c++) {
      html += `<td><input type="number" id="cell-${r}-${c}" value="0" min="0" /></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  table.innerHTML = html;
}

// ──────────────────────────────────────
// PARSE HELPERS
// ──────────────────────────────────────
function parseCSV(str) {
  return str.split(',').map(v => v.trim()).filter(Boolean).map(Number);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = '⚠  ' + msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

// ──────────────────────────────────────
// SPINNER
// ──────────────────────────────────────
function showSpinner()  { document.getElementById('spinner-overlay').classList.remove('hidden'); }
function hideSpinner()  { document.getElementById('spinner-overlay').classList.add('hidden'); }

// ──────────────────────────────────────
// RUN GOODNESS OF FIT
// ──────────────────────────────────────
async function runGOF() {
  const observed = parseCSV(document.getElementById('gof-observed').value);
  const expected = parseCSV(document.getElementById('gof-expected').value);
  const alpha    = parseFloat(document.getElementById('gof-alpha').value);

  // Validation
  if (observed.length === 0) return showError('gof-error', 'Please enter observed values.');
  if (expected.length === 0) return showError('gof-error', 'Please enter expected values.');
  if (observed.some(isNaN)) return showError('gof-error', 'Observed values must be numbers.');
  if (expected.some(isNaN)) return showError('gof-error', 'Expected values must be numbers.');
  if (observed.length !== expected.length) return showError('gof-error', 'Observed and expected must have the same count.');
  if (observed.some(v => v < 0) || expected.some(v => v < 0)) return showError('gof-error', 'Values cannot be negative.');

  showSpinner();
  try {
    const res  = await fetch('/calculate/goodness-of-fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observed, expected, alpha }),
    });
    const data = await res.json();
    if (!res.ok) return showError('gof-error', data.error || 'Calculation failed.');
    lastResult = data;
    displayResults(data);
  } catch (e) {
    showError('gof-error', 'Server error. Make sure app.py is running.');
  } finally {
    hideSpinner();
  }
}

// ──────────────────────────────────────
// RUN TEST OF INDEPENDENCE
// ──────────────────────────────────────
async function runInd() {
  const rows  = parseInt(document.getElementById('ind-rows').value);
  const cols  = parseInt(document.getElementById('ind-cols').value);
  const alpha = parseFloat(document.getElementById('ind-alpha').value);

  const observed = [];
  for (let r = 1; r <= rows; r++) {
    const row = [];
    for (let c = 1; c <= cols; c++) {
      const val = parseFloat(document.getElementById(`cell-${r}-${c}`).value);
      if (isNaN(val) || val < 0) return showError('ind-error', `Invalid value at Row ${r}, Col ${c}.`);
      row.push(val);
    }
    observed.push(row);
  }

  showSpinner();
  try {
    const res  = await fetch('/calculate/independence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observed, alpha }),
    });
    const data = await res.json();
    if (!res.ok) return showError('ind-error', data.error || 'Calculation failed.');
    lastResult = data;
    displayResults(data);
  } catch (e) {
    showError('ind-error', 'Server error. Make sure app.py is running.');
  } finally {
    hideSpinner();
  }
}

// ──────────────────────────────────────
// DISPLAY RESULTS
// ──────────────────────────────────────
function displayResults(data) {
  document.getElementById('results-section').classList.remove('hidden');

  // ── Decision Banner ──
  const banner = document.getElementById('decision-banner');
  if (data.decision === 'reject') {
    banner.className = 'decision-banner reject';
    banner.innerHTML = `<span class="decision-icon">✗</span>
      <div><strong>Reject H₀ — Statistically Significant</strong><br>
      <span style="font-weight:400;font-size:0.9rem;">The calculated χ² (${data.chiSquareValue.toFixed(4)}) exceeds the critical value (${data.criticalValue.toFixed(3)})</span></div>`;
  } else {
    banner.className = 'decision-banner accept';
    banner.innerHTML = `<span class="decision-icon">✓</span>
      <div><strong>Fail to Reject H₀ — Not Significant</strong><br>
      <span style="font-weight:400;font-size:0.9rem;">The calculated χ² (${data.chiSquareValue.toFixed(4)}) does not exceed the critical value (${data.criticalValue.toFixed(3)})</span></div>`;
  }

  // ── Stats ──
  document.getElementById('res-chisq').textContent = data.chiSquareValue.toFixed(4);
  document.getElementById('res-df').textContent    = data.degreesOfFreedom;
  document.getElementById('res-pval').textContent  = data.pValue.toFixed(6);
  document.getElementById('res-crit').textContent  = data.criticalValue.toFixed(3);

  // ── Interpretation ──
  document.getElementById('res-interpretation').textContent = data.interpretation;

  // ── Expected Table (Independence only) ──
  const expSection = document.getElementById('expected-table-section');
  if (data.expected && Array.isArray(data.expected[0])) {
    expSection.classList.remove('hidden');
    buildExpectedTable(data.observed, data.expected);
  } else {
    expSection.classList.add('hidden');
  }

  // ── Steps Table ──
  buildStepsTable(data.steps);

  // ── Charts ──
  renderBarChart(data);
  renderDistChart(data);

  // ── Update Reference Table Highlights ──
  highlightRefTable(data.degreesOfFreedom, data.alpha);

  // Smooth scroll to results
  setTimeout(() => {
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

// ──────────────────────────────────────
// STEP-BY-STEP TABLE
// ──────────────────────────────────────
function buildStepsTable(steps) {
  const total = steps.reduce((s, r) => s + r.chiComponent, 0);
  let html = `<thead><tr>
    <th>Category</th><th>O</th><th>E</th><th>O − E</th><th>(O − E)²</th><th>(O − E)² / E</th>
  </tr></thead><tbody>`;
  steps.forEach(s => {
    html += `<tr>
      <td style="text-align:left;font-weight:600;">${s.label}</td>
      <td>${s.observed}</td>
      <td>${s.expected.toFixed(4)}</td>
      <td>${s.difference.toFixed(4)}</td>
      <td>${s.differenceSquared.toFixed(4)}</td>
      <td>${s.chiComponent.toFixed(6)}</td>
    </tr>`;
  });
  html += `<tr class="total-row">
    <td style="text-align:left;">Σ (Total)</td>
    <td>—</td><td>—</td><td>—</td><td>—</td>
    <td>χ² = ${total.toFixed(6)}</td>
  </tr></tbody>`;
  document.getElementById('steps-table').innerHTML = html;
}

// ──────────────────────────────────────
// EXPECTED TABLE (Independence)
// ──────────────────────────────────────
function buildExpectedTable(observed, expected) {
  const rows = expected.length;
  const cols = expected[0].length;
  let html = '<thead><tr><th></th>';
  for (let c = 0; c < cols; c++) html += `<th>Col ${c+1}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 0; r < rows; r++) {
    html += `<tr><th>Row ${r+1}</th>`;
    for (let c = 0; c < cols; c++) {
      html += `<td>${expected[r][c].toFixed(4)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  document.getElementById('expected-table').innerHTML = html;
}

// ──────────────────────────────────────
// BAR CHART — Observed vs Expected
// ──────────────────────────────────────
function renderBarChart(data) {
  let labels, obs, exp;

  if (Array.isArray(data.observed[0])) {
    // Independence: flatten
    labels = []; obs = []; exp = [];
    data.observed.forEach((row, r) =>
      row.forEach((v, c) => {
        labels.push(`R${r+1}C${c+1}`);
        obs.push(v);
        exp.push(data.expected[r][c]);
      })
    );
  } else {
    labels = data.steps.map(s => s.label);
    obs    = data.observed;
    exp    = data.expected;
  }

  Plotly.react('bar-chart', [
    { x: labels, y: obs, name: 'Observed', type: 'bar', marker: { color: '#7c3aed' } },
    { x: labels, y: exp, name: 'Expected', type: 'bar', marker: { color: '#06b6d4' } },
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    font:   { color: '#94a3b8', family: 'Inter, sans-serif', size: 12 },
    barmode:'group',
    margin: { t: 10, r: 10, l: 40, b: 50 },
    xaxis:  { gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.05)' },
    yaxis:  { gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.08)' },
    legend: { orientation: 'h', y: -0.25 },
  }, { responsive: true, displayModeBar: false });
}

// ──────────────────────────────────────
// DISTRIBUTION CHART — χ² PDF
// ──────────────────────────────────────
function renderDistChart(data) {
  const df    = data.degreesOfFreedom;
  const chiSq = data.chiSquareValue;
  const crit  = data.criticalValue;

  const maxX = Math.max(chiSq * 1.8, crit * 1.8, df * 3, 10);
  const step  = maxX / 300;
  const xAll = [], yAll = [], xRej = [], yRej = [];

  for (let x = 0.01; x <= maxX; x += step) {
    const y = chi2PDF(x, df);
    xAll.push(x); yAll.push(y);
    if (x >= crit) { xRej.push(x); yRej.push(y); }
  }
  const maxY = Math.max(...yAll);

  Plotly.react('dist-chart', [
    // Acceptance fill
    { x: xAll, y: yAll, type: 'scatter', mode: 'lines', name: 'Acceptance Region',
      line: { color: '#7c3aed', width: 3 }, fill: 'tozeroy', fillcolor: 'rgba(124,58,237,0.1)', hoverinfo: 'none' },
    // Rejection fill
    { x: [crit, ...xRej, maxX], y: [0, ...yRej, 0], type: 'scatter', mode: 'lines', name: 'Rejection Region',
      line: { color: 'rgba(0,0,0,0)', width: 0 }, fill: 'tozeroy', fillcolor: 'rgba(239,68,68,0.3)', hoverinfo: 'none' },
  ], {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    font:   { color: '#94a3b8', family: 'Inter, sans-serif', size: 12 },
    margin: { t: 10, r: 10, l: 40, b: 60 },
    xaxis:  { title: 'χ² Value', gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.05)' },
    yaxis:  { title: 'Density', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.08)', showticklabels: false },
    legend: { orientation: 'h', y: -0.35 },
    shapes: [
      { type:'line', x0:crit,  y0:0, x1:crit,  y1:maxY * 1.05,
        line: { color:'#ef4444', width:2, dash:'dash' } },
      { type:'line', x0:chiSq, y0:0, x1:chiSq, y1:maxY * 1.05,
        line: { color:'#a78bfa', width:3 } },
    ],
    annotations: [
      { x:crit,  y:maxY * 0.75, text:`χ²_crit = ${crit.toFixed(3)}`,  showarrow:true, arrowcolor:'#ef4444', font:{ color:'#ef4444', size:11 }, ax:40, ay:-30 },
      { x:chiSq, y:maxY * 0.50, text:`χ²_calc = ${chiSq.toFixed(3)}`, showarrow:true, arrowcolor:'#a78bfa', font:{ color:'#a78bfa', size:11 }, ax:-40, ay:-30 },
    ],
  }, { responsive: true, displayModeBar: false });
}

// χ² PDF (Lanczos log-gamma)
function logGamma(z) {
  const g = 7, c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function chi2PDF(x, df) {
  if (x <= 0) return 0;
  const k = df / 2;
  return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.log(2) - logGamma(k));
}

// ──────────────────────────────────────
// REFERENCE TABLE
// ──────────────────────────────────────
function buildRefTable() {
  const body = document.getElementById('ref-table-body');
  let html = '';
  for (let df = 1; df <= 20; df++) {
    html += `<tr id="ref-row-${df}">
      <td style="font-weight:700;text-align:center;color:#a78bfa;">${df}</td>
      <td id="ref-${df}-0.10" class="ref-cell" data-alpha="0.10">${(CRIT[0.10][df] || '—').toFixed ? CRIT[0.10][df].toFixed(3) : '—'}</td>
      <td id="ref-${df}-0.05" class="ref-cell" data-alpha="0.05">${(CRIT[0.05][df] || '—').toFixed ? CRIT[0.05][df].toFixed(3) : '—'}</td>
      <td id="ref-${df}-0.01" class="ref-cell" data-alpha="0.01">${(CRIT[0.01][df] || '—').toFixed ? CRIT[0.01][df].toFixed(3) : '—'}</td>
    </tr>`;
  }
  body.innerHTML = html;
}

function highlightRefTable(df, alpha) {
  // Clear old highlights
  document.querySelectorAll('#ref-table-body tr').forEach(r => r.classList.remove('highlight-row'));
  document.querySelectorAll('.ref-cell').forEach(c => {
    c.classList.remove('highlight-col', 'highlight-cell');
  });
  document.querySelectorAll('thead th[data-alpha]').forEach(h => h.classList.remove('highlight-col'));

  if (df < 1 || df > 20) return;

  // Highlight row
  const row = document.getElementById(`ref-row-${df}`);
  if (row) row.classList.add('highlight-row');

  // Highlight column header
  const alphaStr = alpha.toString();
  const headers  = document.querySelectorAll(`#ref-table thead th[data-alpha="${alphaStr}"]`);
  headers.forEach(h => h.classList.add('highlight-col'));

  // Highlight column cells
  document.querySelectorAll(`.ref-cell[data-alpha="${alphaStr}"]`).forEach(c => c.classList.add('highlight-col'));

  // Highlight intersection cell
  const cell = document.getElementById(`ref-${df}-${alphaStr}`);
  if (cell) { cell.classList.remove('highlight-col'); cell.classList.add('highlight-cell'); }
}

// ──────────────────────────────────────
// EXPORT AS PDF
// ──────────────────────────────────────
function exportPDF() {
  window.print();
}

// ══════════════════════════════════════════════════════════
//   FILE UPLOAD — CSV / Excel / PDF
// ══════════════════════════════════════════════════════════

let uploadedData = { gof: null, ind: null };

/* ── Drag & drop helpers ── */
function handleDragOver(event, tab) {
  event.preventDefault();
  document.getElementById(tab + '-upload-zone').classList.add('dragover');
}
function handleDragLeave(event, tab) {
  document.getElementById(tab + '-upload-zone').classList.remove('dragover');
}
function handleDrop(event, tab) {
  event.preventDefault();
  handleDragLeave(event, tab);
  const file = event.dataTransfer.files[0];
  if (file) processFile(file, tab);
}
function handleFileSelect(event, tab) {
  const file = event.target.files[0];
  if (file) processFile(file, tab);
}

/* ── Route to correct parser ── */
function processFile(file, tab) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') parseSpreadsheet(file, tab, 'string');
  else if (ext === 'xlsx' || ext === 'xls') parseSpreadsheet(file, tab, 'array');
  else if (ext === 'pdf') parsePDF(file, tab);
  else showUploadError(tab, 'Unsupported format. Please use CSV, Excel (.xlsx/.xls), or PDF.');
}

/* ── CSV / Excel via SheetJS ── */
function parseSpreadsheet(file, tab, readAs) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(
        readAs === 'array' ? new Uint8Array(e.target.result) : e.target.result,
        { type: readAs }
      );
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const clean = data.filter(row => row.some(c => c !== ''));
      if (!clean.length) return showUploadError(tab, 'File is empty or has no readable data.');
      showUploadPreview(clean, file.name, tab);
    } catch (err) {
      showUploadError(tab, 'Could not read file. Make sure it is a valid CSV or Excel file.');
    }
  };
  if (readAs === 'array') reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}

/* ── PDF via PDF.js ── */
async function parsePDF(file, tab) {
  try {
    if (typeof pdfjsLib === 'undefined') {
      return showUploadError(tab, 'PDF support is loading. Please try again in a moment.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let rows = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lineMap = {};
      content.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineMap[y]) lineMap[y] = [];
        lineMap[y].push(item.str.trim());
      });
      Object.keys(lineMap).sort((a, b) => b - a).forEach(y => {
        const lineText = lineMap[y].join(' ');
        const nums = lineText.match(/-?\d+\.?\d*/g);
        if (nums && nums.length >= 1) rows.push(nums.map(Number));
      });
    }
    if (!rows.length) return showUploadError(tab, 'No numeric data found in PDF. Please use CSV or Excel for best results.');
    showUploadPreview(rows, file.name, tab);
  } catch (err) {
    showUploadError(tab, 'Error reading PDF. Please use CSV or Excel format for best accuracy.');
  }
}

/* ── Show parsed preview ── */
function showUploadPreview(data, filename, tab) {
  uploadedData[tab] = data;
  const previewEl = document.getElementById(tab + '-upload-preview');
  const display = data.slice(0, 8);

  let tableHtml = '<table class="result-table" style="font-size:.82rem"><tbody>';
  display.forEach(row => {
    tableHtml += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
  });
  if (data.length > 8) {
    tableHtml += `<tr><td colspan="${data[0].length}" style="text-align:center;color:var(--muted);font-style:italic">… ${data.length - 8} more rows</td></tr>`;
  }
  tableHtml += '</tbody></table>';

  previewEl.innerHTML = `
    <div class="preview-topbar">
      <span class="preview-filename">✅ &nbsp;${filename} &nbsp;(${data.length} rows detected)</span>
      <button class="preview-clear-btn" onclick="clearUpload('${tab}')">✕ Clear</button>
    </div>
    <div class="preview-table-wrap">${tableHtml}</div>
    <button class="preview-apply-btn" onclick="applyUploadedData('${tab}')">
      ↓ &nbsp;Apply Data to Form
    </button>
  `;
  previewEl.classList.remove('hidden');
}

function showUploadError(tab, msg) {
  const previewEl = document.getElementById(tab + '-upload-preview');
  previewEl.innerHTML = `<div style="padding:14px 16px;color:#fca5a5;font-size:.875rem">⚠ ${msg}</div>`;
  previewEl.style.borderColor = 'rgba(239,68,68,0.4)';
  previewEl.style.background = 'rgba(239,68,68,0.05)';
  previewEl.classList.remove('hidden');
}

function clearUpload(tab) {
  uploadedData[tab] = null;
  const previewEl = document.getElementById(tab + '-upload-preview');
  previewEl.innerHTML = '';
  previewEl.classList.add('hidden');
  previewEl.style.borderColor = '';
  previewEl.style.background = '';
  const fileInput = document.getElementById(tab + '-file-input');
  if (fileInput) fileInput.value = '';
}

/* ── Apply parsed data into the form ── */
function applyUploadedData(tab) {
  const data = uploadedData[tab];
  if (!data) return;
  if (tab === 'gof') applyGOFData(data);
  else applyIndData(data);
}

function applyGOFData(data) {
  const firstRow = data[0];
  const isHeader = firstRow.some(cell => typeof cell === 'string' && isNaN(Number(cell)) && cell.trim() !== '');
  const rows = isHeader ? data.slice(1) : data;

  const observed = [], expected = [];
  rows.forEach(row => {
    const nums = row.map(v => Number(v)).filter(n => !isNaN(n));
    if (nums.length >= 2) { observed.push(nums[0]); expected.push(nums[1]); }
    else if (nums.length === 1) { observed.push(nums[0]); }
  });

  document.getElementById('gof-observed').value = observed.join(', ');
  document.getElementById('gof-expected').value = expected.length ? expected.join(', ') : '';
  document.getElementById('gof-observed').focus();
  document.querySelector('#tab-gof .glass-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function applyIndData(data) {
  const firstRow = data[0];
  const isHeader = firstRow.some(cell => typeof cell === 'string' && isNaN(Number(cell)) && cell.trim() !== '');
  const rows = isHeader ? data.slice(1) : data;
  const firstColIsLabel = rows.every(row => typeof row[0] === 'string' && isNaN(Number(row[0])) && row[0].trim() !== '');

  const matrix = rows.map(row => {
    const vals = firstColIsLabel ? row.slice(1) : row;
    return vals.map(v => Number(v)).filter(n => !isNaN(n));
  }).filter(r => r.length > 0);

  const numRows = matrix.length;
  const numCols = Math.max(...matrix.map(r => r.length));
  document.getElementById('ind-rows').value = numRows;
  document.getElementById('ind-cols').value = numCols;
  buildTable();

  setTimeout(() => {
    matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        const cell = document.getElementById(`cell-${r + 1}-${c + 1}`);
        if (cell) cell.value = val;
      });
    });
    document.getElementById('ind-table').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}

/* ── Download template CSV ── */
function downloadTemplate(tab) {
  let csv, filename;
  if (tab === 'gof') {
    csv = 'Category,Observed,Expected\nMonday,30,20\nTuesday,25,20\nWednesday,20,20\nThursday,15,20\nFriday,10,20';
    filename = 'gof_template.csv';
  } else {
    csv = ',Column1,Column2,Column3\nRow1,30,10,20\nRow2,15,25,5\nRow3,8,18,12';
    filename = 'independence_template.csv';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
