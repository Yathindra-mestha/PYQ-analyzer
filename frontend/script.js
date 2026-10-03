const API_LOCAL = 'http://127.0.0.1:8000';
let API_CLOUD = localStorage.getItem('API_URL') || '';

let selectedFiles = [];
// Store analysis data
let globalAnalysisData = {};
let currentSubject = "";

// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const browseBtn = document.getElementById('browseBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const fileListContainer = document.getElementById('fileListContainer');
const fileChips = document.getElementById('fileChips');
const selectedCountText = document.getElementById('selectedCountText');
const clearAllBtn = document.getElementById('clearAllFiles');

const progressSection = document.getElementById('progressSection');
const progressStepText = document.getElementById('progressStepText');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const resultsSection = document.getElementById('resultsSection');

const pagesList = document.getElementById('pagesList');
const topSummaryText = document.getElementById('topSummaryText');
const statTotalPages = document.getElementById('statTotalPages');
const statTotalQuestions = document.getElementById('statTotalQuestions');
const statRepeatedQs = document.getElementById('statRepeatedQs');
const statPapersCount = document.getElementById('statPapersCount');

const filterPills = document.querySelectorAll('.filter-pill');
const pageSearch = document.getElementById('pageSearch');
let pagesData = [];

// API Config Modal Elements
const configBtn = document.getElementById('configBtn');
const configModal = document.getElementById('configModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const apiUrlInput = document.getElementById('apiUrlInput');
const presetLocal = document.getElementById('presetLocal');
const presetRelative = document.getElementById('presetRelative');
const backendStatus = document.getElementById('backendStatus');
const statusText = document.getElementById('statusText');

const toast = document.getElementById('toast');

// Initialize
checkHealth();

// -------------------------------------------------------------
// Tabs Logic
// -------------------------------------------------------------
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// -------------------------------------------------------------
// Accordion Logic
// -------------------------------------------------------------
const accordionHeaders = document.querySelectorAll('.accordion-header');
accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const item = header.parentElement;
        item.classList.toggle('active');
    });
});

// -------------------------------------------------------------
// Config Modal Logic
// -------------------------------------------------------------
function getApiBase() {
    return API_CLOUD || API_LOCAL;
}

configBtn.addEventListener('click', () => {
    apiUrlInput.value = getApiBase();
    configModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    configModal.classList.add('hidden');
});

presetLocal.addEventListener('click', () => {
    apiUrlInput.value = API_LOCAL;
});

presetRelative.addEventListener('click', () => {
    apiUrlInput.value = '/api';
});

saveConfigBtn.addEventListener('click', () => {
    let val = apiUrlInput.value.trim();
    if (val.endsWith('/')) val = val.slice(0, -1);
    
    if (val !== API_LOCAL) {
        localStorage.setItem('API_URL', val);
        API_CLOUD = val;
    } else {
        localStorage.removeItem('API_URL');
        API_CLOUD = '';
    }
    
    configModal.classList.add('hidden');
    checkHealth();
});

async function checkHealth() {
    backendStatus.className = 'status-badge checking';
    statusText.textContent = 'Checking Backend...';
    
    try {
        const url = getApiBase();
        const res = await fetch(`${url}/health`, { method: 'GET' });
        if (res.ok) {
            backendStatus.className = 'status-badge online';
            statusText.textContent = 'Backend: Online';
        } else {
            throw new Error('Not OK');
        }
    } catch (err) {
        backendStatus.className = 'status-badge offline';
        statusText.textContent = 'Backend: Offline';
    }
}

// -------------------------------------------------------------
// Drag and Drop & File Selection
// -------------------------------------------------------------
browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-active'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-active'), false);
});

dropzone.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
        if (files[i].type === 'application/pdf' || files[i].name.toLowerCase().endsWith('.pdf')) {
            selectedFiles.push(files[i]);
        }
    }
    updateFileListUI();
}

function updateFileListUI() {
    if (selectedFiles.length === 0) {
        fileListContainer.classList.add('hidden');
        analyzeBtn.disabled = true;
        return;
    }

    fileListContainer.classList.remove('hidden');
    analyzeBtn.disabled = false;
    selectedCountText.textContent = `${selectedFiles.length} Paper${selectedFiles.length > 1 ? 's' : ''} Selected`;

    fileChips.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = file.name;
        nameSpan.title = file.name;
        
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'file-size';
        sizeSpan.textContent = `(${(file.size / (1024 * 1024)).toFixed(1)} MB)`;

        const delBtn = document.createElement('button');
        delBtn.className = 'file-delete-btn';
        delBtn.innerHTML = '&times;';
        delBtn.onclick = () => {
            selectedFiles.splice(index, 1);
            updateFileListUI();
        };

        chip.appendChild(nameSpan);
        chip.appendChild(sizeSpan);
        chip.appendChild(delBtn);
        fileChips.appendChild(chip);
    });
}

clearAllBtn.addEventListener('click', () => {
    selectedFiles = [];
    updateFileListUI();
});

// -------------------------------------------------------------
// Analyze Papers
// -------------------------------------------------------------
analyzeBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    // Show Progress UI
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    analyzeBtn.disabled = true;

    // Reset Progress
    progressPercent.textContent = '0%';
    progressBar.style.width = '0%';
    progressStepText.textContent = 'Uploading PDF papers...';

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    let step = 0;
    let tickCount = 0;
    const steps = [
        { text: 'Uploading PDF papers...', pct: 20 },
        { text: 'Extracting text (direct text + OCR fallback per page)...', pct: 50 },
        { text: 'Fuzzy grouping questions...', pct: 85 },
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
        
        progressPercent.textContent = '100%';
        progressBar.style.width = '100%';
        progressStepText.textContent = 'Done!';
        
        setTimeout(() => {
            progressSection.classList.add('hidden');
            analyzeBtn.disabled = false;
            displayResults(data);
        }, 500);

    } catch (err) {
        clearInterval(interval);
        progressSection.classList.add('hidden');
        analyzeBtn.disabled = false;
        showToast('Error analyzing files. Is the backend running?');
        console.error(err);
    }
});

// -------------------------------------------------------------
// Display Results
// -------------------------------------------------------------
function displayResults(data) {
    resultsSection.classList.remove('hidden');

    // Update Summary Header
    topSummaryText.textContent = data.summary;
    statTotalPages.textContent = data.total_pages;
    statTotalQuestions.textContent = data.total_questions_extracted;
    statPapersCount.textContent = data.paper_count;

    // Cache Analysis Data
    globalAnalysisData = data.analysis;
    pagesData = data.pages;

    // Populate Subject Dropdown
    const subjectDropdown = document.getElementById('subjectDropdown');
    subjectDropdown.innerHTML = '';
    const subjects = Object.keys(globalAnalysisData);
    
    if (subjects.length > 0) {
        subjects.forEach(subj => {
            const opt = document.createElement('option');
            opt.value = subj;
            opt.textContent = subj;
            subjectDropdown.appendChild(opt);
        });
        currentSubject = subjects[0];
        renderAnalysis(currentSubject);
    } else {
        // No subjects found
        document.getElementById('list-repeated').innerHTML = '<p class="empty-state">No questions found</p>';
        document.getElementById('list-least').innerHTML = '<p class="empty-state">No questions found</p>';
        document.getElementById('list-remaining').innerHTML = '<p class="empty-state">No questions found</p>';
    }

    subjectDropdown.addEventListener('change', (e) => {
        currentSubject = e.target.value;
        renderAnalysis(currentSubject);
    });
    
    // Render Raw Text Pages
    renderPages();
    
    // Smooth scroll
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    // Open Repeated section by default
    document.getElementById('acc-repeated').classList.add('active');
}

// -------------------------------------------------------------
// Render Analysis Data (Question Groups)
// -------------------------------------------------------------
function renderAnalysis(subject, filterText = "") {
    if (!globalAnalysisData[subject]) return;
    
    const data = globalAnalysisData[subject];
    const term = filterText.toLowerCase();

    // Helper to render one category
    const renderCategory = (category, elementId, badgeId) => {
        const list = data[category].filter(q => q.text.toLowerCase().includes(term));
        const listEl = document.getElementById(elementId);
        const badgeEl = document.getElementById(badgeId);
        
        badgeEl.textContent = list.length;
        listEl.innerHTML = '';
        
        if (list.length === 0) {
            listEl.innerHTML = '<p class="empty-state">No matching questions.</p>';
            return list.length;
        }

        list.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card card';
            
            let marksHtml = q.marks ? `<span class="q-marks">[${q.marks} Marks]</span>` : '';
            let imageHtml = q.image_url ? `<div class="q-image-container"><img src="${getApiBase()}${q.image_url}" alt="Question Cropped Image" class="q-image" loading="lazy"></div>` : '';
            
            card.innerHTML = `
                <div class="q-header">
                    <span class="q-count-badge">Repeated ${q.count} times</span>
                    ${marksHtml}
                    <button class="btn-ghost copy-btn" onclick="copyText(this)">Copy</button>
                </div>
                ${imageHtml}
                <div class="q-text-content">${q.text}</div>
                <div class="q-footer">Seen in: ${q.locations}</div>
            `;
            listEl.appendChild(card);
        });
        
        return list.length;
    };

    let countRepeated = renderCategory("Repeated", "list-repeated", "badge-repeated");
    let countLeast = renderCategory("Least repeated", "list-least", "badge-least");
    let countRemaining = renderCategory("Remaining", "list-remaining", "badge-remaining");
    
    if (filterText === "") {
        statRepeatedQs.textContent = countRepeated;
    }
}

// Download Excel logic
document.getElementById('downloadExcelBtn').addEventListener('click', () => {
    if (!currentSubject) return;
    const url = `${getApiBase()}/export?subject=${encodeURIComponent(currentSubject)}`;
    window.open(url, '_blank');
});

// Search functionality for Analysis Tab
document.getElementById('analysisSearch').addEventListener('input', (e) => {
    if (currentSubject) {
        renderAnalysis(currentSubject, e.target.value);
    }
});

// -------------------------------------------------------------
// Render Raw Text Pages
// -------------------------------------------------------------
function renderPages(filterMethod = "all", filterText = "") {
    pagesList.innerHTML = '';

    let filtered = pagesData;

    if (filterMethod !== 'all') {
        filtered = filtered.filter(p => p.method === filterMethod);
    }

    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filtered = filtered.filter(p => 
            p.text.toLowerCase().includes(lowerFilter) || 
            p.filename.toLowerCase().includes(lowerFilter)
        );
    }

    if (filtered.length === 0) {
        pagesList.innerHTML = `
            <div class="empty-state">
                <p>No pages match the current filters.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(page => {
        const card = document.createElement('div');
        card.className = 'page-card';

        const methodBadgeClass = page.method === 'text' ? 'badge-text' : 'badge-ocr';
        const methodLabel = page.method === 'text' ? '📝 Text' : '🔍 OCR';

        card.innerHTML = `
            <div class="page-header">
                <div class="page-meta">
                    <span class="page-file">${page.filename} <span class="page-num">#${page.page_num}</span></span>
                    <span class="page-stats">${page.char_count} chars</span>
                </div>
                <span class="method-badge ${methodBadgeClass}">${methodLabel}</span>
            </div>
            <div class="page-content">${page.text}</div>
        `;

        pagesList.appendChild(card);
    });
}

// Pill Filters for Raw Text
filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
        filterPills.forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        
        const filter = e.target.getAttribute('data-filter');
        const textFilter = pageSearch.value;
        renderPages(filter, textFilter);
    });
});

pageSearch.addEventListener('input', (e) => {
    const activePill = document.querySelector('.filter-pill.active');
    const filter = activePill ? activePill.getAttribute('data-filter') : 'all';
    renderPages(filter, e.target.value);
});

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
window.copyText = function(btn) {
    const textEl = btn.parentElement.nextElementSibling;
    const text = textEl.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copied to clipboard!");
    });
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
}
