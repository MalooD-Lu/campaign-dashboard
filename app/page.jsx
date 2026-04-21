// app/page.jsx
'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [transEnabled, setTransEnabled] = useState(false);
  const [rowsPerFile, setRowsPerFile] = useState(1000);
  const [nameCol, setNameCol] = useState('');
  const [language, setLanguage] = useState('Hindi');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputs, setOutputs] = useState([]);
  const [preview, setPreview] = useState([]);

  const languages = ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'];

  const handleFileUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const csv = evt.target.result;
        const lines = csv.split('\n').filter(l => l.trim());
        const headerRow = lines[0].split(',').map(h => h.trim());

        if (!headerRow.includes('Numbers')) {
          setError('CSV must have a "Numbers" column');
          return;
        }

        const dataRows = lines.slice(1).map(line => {
          return line.split(',').map(c => c.trim());
        });

        setFile(f.name);
        setHeaders(headerRow);
        setRows(dataRows);
        setNameCol(headerRow.find(h => h !== 'Numbers') || '');
        setError('');
        setOutputs([]);
        setPreview([]);
      } catch (err) {
        setError('Error parsing CSV: ' + err.message);
      }
    };
    reader.readAsText(f);
  };

  const handleProcess = async () => {
    if (!splitEnabled && !transEnabled) {
      setError('Enable at least one operation');
      return;
    }

    setProcessing(true);
    setError('');
    setStatus('Processing…');
    setProgress(0);
    setOutputs([]);

    try {
      let outHeaders = [...headers];
      let outRows = rows.map(r => [...r]);
      let newColIdx = -1;

      // Transliterate if enabled
      if (transEnabled) {
        if (!nameCol) {
          throw new Error('Select a column to transliterate');
        }

        const colIdx = outHeaders.indexOf(nameCol);
        const names = outRows.map(r => r[colIdx] || '');

        setProgress(10);
        setStatus(`Pre-cleaning ${names.length} names (removing abbreviations, fixing formats)…`);
        
        // Brief pause to show cleaning step
        await new Promise(r => setTimeout(r, 300));
        
        setProgress(15);
        const batchCount = Math.ceil(names.length / 250);
        setStatus(`Sending to Claude API (${names.length} names, ~${batchCount} batch${batchCount > 1 ? 'es' : ''})…`);

        const apiResp = await fetch('/api/transliterate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names, language })
        });

        if (!apiResp.ok) {
          const err = await apiResp.json();
          throw new Error(err.error || 'API error');
        }

        const { transliterated, batches, processed } = await apiResp.json();
        
        setProgress(70);
        setStatus(`Processing results (${processed} names processed across ${batches} batch${batches > 1 ? 'es' : ''})…`);

        const newCol = `${nameCol}_${language.toLowerCase()}`;
        newColIdx = outHeaders.length;
        outHeaders.push(newCol);
        outRows = outRows.map((r, i) => [...r, transliterated[i] ?? '⚠️ ERROR']);

        setProgress(75);
        setStatus(`✓ Transliteration complete — ${transliterated.length} names converted to ${language}`);
      }

      // Split files if enabled
      if (splitEnabled) {
        setProgress(85);
        setStatus('Splitting files…');
        
        const n = rowsPerFile;
        const files = [];
        const numFiles = Math.ceil(outRows.length / n);

        for (let i = 0; i < numFiles; i++) {
          const chunk = outRows.slice(i * n, (i + 1) * n);
          const csv = [outHeaders, ...chunk]
            .map(row => row.map(c => `"${c}"`).join(','))
            .join('\n');

          files.push({
            name: `campaign_${String(i + 1).padStart(2, '0')}_of_${String(numFiles).padStart(2, '0')}.csv`,
            content: csv,
            rows: chunk.length
          });
        }

        setOutputs(files);
        setPreview(outRows.slice(0, 5).map(r => [nameCol, newColIdx >= 0 ? outHeaders[newColIdx] : null].filter(h => h && outHeaders.includes(h)).map(h => r[outHeaders.indexOf(h)])));
      } else {
        const csv = [outHeaders, ...outRows]
          .map(row => row.map(c => `"${c}"`).join(','))
          .join('\n');

        setOutputs([{
          name: 'campaign_processed.csv',
          content: csv,
          rows: outRows.length
        }]);
      }

      setProgress(100);
      setStatus('Done!');
    } catch (err) {
      setError('Error: ' + err.message);
      setStatus('');
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = (idx) => {
    const f = outputs[idx];
    const blob = new Blob([f.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    outputs.forEach(f => zip.file(f.name, f.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaigns.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Campaign CSV Dashboard</h1>
        <p>Upload, process & download campaign files</p>
      </div>

      {/* File Upload */}
      <div className={styles.card}>
        <h2>Step 1: Upload CSV</h2>
        <label className={styles.dropZone}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={processing}
          />
          <div>📁 Click to upload or drag & drop</div>
          <small>.csv files with "Numbers" column</small>
        </label>
        {file && <div className={styles.filePill}>{file} ({rows.length} rows)</div>}
      </div>

      {/* Operations */}
      {headers.length > 0 && (
        <div className={styles.card}>
          <h2>Step 2: Operations</h2>

          {/* Split Option */}
          <div className={styles.toggle}>
            <div className={styles.toggleLabel}>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => setSplitEnabled(e.target.checked)}
                  disabled={processing}
                />
                <span className={styles.slider}></span>
              </label>
              <span>Split into multiple files</span>
            </div>
            {splitEnabled && (
              <div className={styles.subOpts}>
                <label>
                  Rows per file:
                  <input
                    type="number"
                    value={rowsPerFile}
                    onChange={(e) => setRowsPerFile(parseInt(e.target.value) || 1000)}
                    disabled={processing}
                  />
                </label>
                <small>
                  {rows.length.toLocaleString()} rows → {Math.ceil(rows.length / rowsPerFile)} files
                </small>
              </div>
            )}
          </div>

          {/* Transliterate Option */}
          <div className={styles.toggle}>
            <div className={styles.toggleLabel}>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={transEnabled}
                  onChange={(e) => setTransEnabled(e.target.checked)}
                  disabled={processing}
                />
                <span className={styles.slider}></span>
              </label>
              <span>Transliterate names</span>
            </div>
            {transEnabled && (
              <div className={styles.subOpts}>
                <label>
                  Column to transliterate:
                  <select value={nameCol} onChange={(e) => setNameCol(e.target.value)} disabled={processing}>
                    {headers.filter(h => h !== 'Numbers').map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target language:
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={processing}>
                    {languages.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <button
            className={styles.processBtn}
            onClick={handleProcess}
            disabled={processing || (!splitEnabled && !transEnabled)}
          >
            {processing ? `Processing (${progress}%)` : 'Process'}
          </button>
        </div>
      )}

      {/* Status */}
      {status && <div className={styles.status}>{status}</div>}
      {error && <div className={styles.error}>{error}</div>}
      {progress > 0 && progress < 100 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Output */}
      {outputs.length > 0 && (
        <div className={styles.card}>
          <h2>Output Files</h2>
          {outputs.map((f, i) => (
            <div key={i} className={styles.outputItem}>
              <div>
                <div className={styles.fileName}>{f.name}</div>
                <div className={styles.fileRows}>{f.rows.toLocaleString()} rows</div>
              </div>
              <button className={styles.dlBtn} onClick={() => downloadFile(i)}>
                ↓ Download
              </button>
            </div>
          ))}
          {outputs.length > 1 && (
            <button className={styles.dlAllBtn} onClick={downloadAll}>
              ↓ Download All as ZIP
            </button>
          )}
        </div>
      )}
    </div>
  );
}
