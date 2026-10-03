// --------------------------------------------------------------------------
// STATE & CONFIG
// --------------------------------------------------------------------------
let state = {
    selectedFiles: [],
    analysisData: null,
    activeFilter: 'all', // 'all', 'text', 'ocr'
    searchQuery: ''
};

// Configurable API URL for seamless transition to Vercel/Render
const DEFAULT_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '';

function getApiBase() {
    return localStorage.getItem('preprank_api_url') || DEFAULT_API;
}

function setApiBase(url) {
    if (url) {
        localStorage.setItem('preprank_api_url', url.replace(/\/+$/, ''));
    } else {
        localStorage.removeItem('preprank_api_url');
    }
}

// --------------------------------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------------------------------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const fileListContainer = document.getElementById('fileListContainer');
const fileChips = document.getElementById('fileChips');
const selectedCountText = document.getElementById('selectedCountText');
const clearAllFiles = document.getElementById('clearAllFiles');
const analyzeBtn = document.getElementById('analyzeBtn');

const progressSection = document.getElementById('progressSection');
const progressStepText = document.getElementById('progressStepText');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');

const resultsSection = document.getElementById('resultsSection');
const topSummaryText = document.getElementById('topSummaryText');
const statTotalPages = document.getElementById('statTotalPages');
const statTextPages = document.getElementById('statTextPages');
const statOcrPages = document.getElementById('statOcrPages');
const statPapersCount = document.getElementById('statPapersCount');

const pageSearch = document.getElementById('pageSearch');
const pagesList = document.getElementById('pagesList');
const filterPills = document.querySelectorAll('.filter-pill');

const backendStatus = document.getElementById('backendStatus');
const statusText = document.getElementById('statusText');

const configBtn = document.getElementById('configBtn');
const configModal = document.getElementById('configModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const apiUrlInput = document.getElementById('apiUrlInput');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const presetLocal = document.getElementById('presetLocal');
const presetRelative = document.getElementById('presetRelative');
const toast = document.getElementById('toast');

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    checkBackendHealth();
    setupDropzone();
    setupConfigModal();
    setupFiltersAndSearch();
});

// --------------------------------------------------------------------------
// BACKEND HEALTH CHECK
// --------------------------------------------------------------------------
async function checkBackendHealth() {
    backendStatus.className = 'status-badge checking';
    statusText.textContent = 'Checking Backend...';
    const baseUrl = getApiBase();

    try {
        const res = await fetch(`${baseUrl}/health`, { method: 'GET' });
        if (res.ok) {
            backendStatus.className = 'status-badge online';
            statusText.textContent = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost') 
                ? 'Backend: Online' 
                : 'Backend: Connected';
        } else {
            throw new Error();
        }
    } catch (e) {
        backendStatus.className = 'status-badge offline';
        statusText.textContent = 'Backend Offline';
    }
}

// --------------------------------------------------------------------------
// DROPZONE & FILE SELECTION
// --------------------------------------------------------------------------
function setupDropzone() {
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-active');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-active');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length === 0) {
            showToast('Please drop PDF files only.');
            return;
        }
        addFiles(files);
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        addFiles(files);
    });

    clearAllFiles.addEventListener('click', () => {
        state.selectedFiles = [];
        updateFilePreview();
    });

    analyzeBtn.addEventListener('click', runAnalysis);
}

function addFiles(newFiles) {
    newFiles.forEach(file => {
        if (!state.selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            state.selectedFiles.push(file);
        }
    });
    updateFilePreview();
}

function removeFile(index) {
    state.selectedFiles.splice(index, 1);
    updateFilePreview();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function updateFilePreview() {
    if (state.selectedFiles.length === 0) {
        fileListContainer.classList.add('hidden');
        analyzeBtn.disabled = true;
        fileInput.value = '';
        return;
    }

    fileListContainer.classList.remove('hidden');
    analyzeBtn.disabled = false;
    selectedCountText.textContent = `${state.selectedFiles.length} Paper${state.selectedFiles.length > 1 ? 's' : ''} Selected`;

    fileChips.innerHTML = '';
    state.selectedFiles.forEach((file, index) => {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.innerHTML = `
            <span>📄 ${file.name} <small style="color:var(--text-muted)">(${formatBytes(file.size)})</small></span>
            <span class="remove-chip" title="Remove">&times;</span>
        `;
        chip.querySelector('.remove-chip').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFile(index);
        });
        fileChips.appendChild(chip);
    });
}

// --------------------------------------------------------------------------
// RUN ANALYSIS (KEEP PROGRESS MESSAGE & ERROR HANDLING)
// --------------------------------------------------------------------------
async function runAnalysis() {
    if (state.selectedFiles.length === 0) return;

    analyzeBtn.disabled = true;
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    const formData = new FormData();
    state.selectedFiles.forEach(f => formData.append('files', f));

    // Progress message steps
    let step = 0;
    let tickCount = 0;
    const steps = [
        { text: 'Uploading PDF papers...', pct: 20 },
        { text: 'Extracting text (direct text + OCR fallback per page)...', pct: 50 },
        { text: 'Finalizing page extractions...', pct: 85 },
        { text: 'Aggregating results...', pct: 95 }
    ];

    const interval = setInterval(() => {
        if (step < steps.length) {
            progressStepText.textContent = steps[step].text;
            progressPercent.textContent = `${steps[step].pct}%`;
            progressBar.style.width = `${steps[step].pct}%`;
            step++;
        } else {
            tickCount++;
            if (tickCount > 10) {
                progressStepText.textContent = 'Still processing... (Large or scanned PDFs may take a few minutes for OCR)';
            }
        }
    }, 800);

    try {
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/analyze`, {
            method: 'POST',
            body: formData
        });

        clearInterval(interval);

        if (!res.ok) {
            throw new Error(`Failed to analyze: HTTP ${res.status}`);
        }

        const data = await res.json();
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        progressStepText.textContent = 'Analysis complete!';

        setTimeout(() => {
            progressSection.classList.add('hidden');
            renderDashboard(data);
        }, 300);

    } catch (err) {
        clearInterval(interval);
        progressSection.classList.add('hidden');
        showToast('Error analyzing files. Is the backend running?');
        console.error(err);
    } finally {
        analyzeBtn.disabled = false;
    }
}

// --------------------------------------------------------------------------
// RENDER DASHBOARD
// --------------------------------------------------------------------------
function renderDashboard(data) {
    state.analysisData = data;
    resultsSection.classList.remove('hidden');

    resultsSection.scrollIntoView({ behavior: 'smooth' });

    // 1. Top Summary Banner (e.g. "35 pages: 0 text, 35 OCR")
    topSummaryText.textContent = data.summary || `${data.total_pages} pages: ${data.text_pages} text, ${data.ocr_pages} OCR`;

    // 2. Metric Cards
    statTotalPages.textContent = data.total_pages;
    statTextPages.textContent = data.text_pages;
    statOcrPages.textContent = data.ocr_pages;
    statPapersCount.textContent = data.paper_count || state.selectedFiles.length || 1;

    // 3. Render Pages List
    renderPages();
}

// --------------------------------------------------------------------------
// FILTERS & SEARCH
// --------------------------------------------------------------------------
function setupFiltersAndSearch() {
    pageSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderPages();
    });

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            state.activeFilter = pill.dataset.filter;
            renderPages();
        });
    });
}

function renderPages() {
    if (!state.analysisData || !state.analysisData.pages) return;

    pagesList.innerHTML = '';

    const filtered = state.analysisData.pages.filter(p => {
        // Filter by method: 'all', 'text', 'ocr'
        const matchesFilter = state.activeFilter === 'all' || p.method === state.activeFilter;

        // Filter by search query
        const textToSearch = (p.text || '').toLowerCase();
        const filenameSearch = (p.filename || '').toLowerCase();
        const matchesSearch = !state.searchQuery || 
            textToSearch.includes(state.searchQuery) || 
            filenameSearch.includes(state.searchQuery);

        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        pagesList.innerHTML = `<div class="no-results">No pages match your filter or search query.</div>`;
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'page-card';

        const isText = p.method === 'text';
        const methodBadge = isText 
            ? `<span class="method-badge method-text">📝 Text</span>` 
            : `<span class="method-badge method-ocr">🔍 OCR</span>`;

        const filenameLabel = p.filename ? `• <span style="color:var(--text-secondary)">${escapeHtml(p.filename)}</span>` : '';
        const charLabel = `${p.char_count || (p.text ? p.text.length : 0)} characters`;
        const contentText = p.text && p.text.trim().length > 0 
            ? escapeHtml(p.text) 
            : '<em style="color:var(--text-muted)">[No text could be extracted from this page]</em>';

        card.innerHTML = `
            <div class="page-header">
                <div class="page-meta">
                    <span class="page-title">Page ${p.page_num} ${filenameLabel}</span>
                    ${methodBadge}
                    <span class="page-chars">(${charLabel})</span>
                </div>
                <button class="copy-btn" title="Copy Page Text">📋 Copy Text</button>
            </div>
            <div class="page-text-preview">${contentText}</div>
        `;

        card.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(p.text || '');
            showToast(`Page ${p.page_num} text copied!`);
        });

        pagesList.appendChild(card);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

// --------------------------------------------------------------------------
// MODAL & CONFIG (FOR VERCEL TRANSITION)
// --------------------------------------------------------------------------
function setupConfigModal() {
    configBtn.addEventListener('click', () => {
        apiUrlInput.value = getApiBase();
        configModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => configModal.classList.add('hidden'));

    presetLocal.addEventListener('click', () => {
        apiUrlInput.value = 'http://127.0.0.1:8000';
    });

    presetRelative.addEventListener('click', () => {
        apiUrlInput.value = '';
    });

    saveConfigBtn.addEventListener('click', () => {
        setApiBase(apiUrlInput.value.trim());
        configModal.classList.add('hidden');
        showToast('API Configuration saved!');
        checkBackendHealth();
    });

    configModal.addEventListener('click', (e) => {
        if (e.target === configModal) configModal.classList.add('hidden');
    });
}

// --------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// --------------------------------------------------------------------------
let toastTimeout;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2800);
}
