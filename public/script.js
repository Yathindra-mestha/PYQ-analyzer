// --------------------------------------------------------------------------
// STATE & CONFIG
// --------------------------------------------------------------------------
let state = {
    selectedFiles: [],
    analysisData: null,
    activeTopicFilter: 'all',
    searchQuery: '',
    chartType: 'bar',
    chartInstance: null
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
const statPapersCount = document.getElementById('statPapersCount');
const statQuestionsCount = document.getElementById('statQuestionsCount');
const statTopTopic = document.getElementById('statTopTopic');
const statTopicsFound = document.getElementById('statTopicsFound');

const topicsChartCanvas = document.getElementById('topicsChart');
const chartToggleBtns = document.querySelectorAll('.chart-toggle-btn');

const questionSearch = document.getElementById('questionSearch');
const topicFilters = document.getElementById('topicFilters');
const questionsList = document.getElementById('questionsList');

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
    setupChartToggles();
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
// RUN ANALYSIS
// --------------------------------------------------------------------------
async function runAnalysis() {
    if (state.selectedFiles.length === 0) return;

    analyzeBtn.disabled = true;
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    const formData = new FormData();
    state.selectedFiles.forEach(f => formData.append('files', f));

    // Simulated progress steps
    let step = 0;
    const steps = [
        { text: 'Uploading PDF papers...', pct: 20 },
        { text: 'Extracting page text with PyMuPDF...', pct: 50 },
        { text: 'Parsing questions and identifying topics...', pct: 80 },
        { text: 'Aggregating frequency counts...', pct: 95 }
    ];

    const interval = setInterval(() => {
        if (step < steps.length) {
            progressStepText.textContent = steps[step].text;
            progressPercent.textContent = `${steps[step].pct}%`;
            progressBar.style.width = `${steps[step].pct}%`;
            step++;
        }
    }, 450);

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

    // Metric Cards
    statPapersCount.textContent = data.paper_count || state.selectedFiles.length || 1;
    statQuestionsCount.textContent = data.total_questions || data.questions.length;
    
    const topTopicEntry = Object.entries(data.topics_ranking || {})[0];
    statTopTopic.textContent = topTopicEntry ? `${topTopicEntry[0]} (${topTopicEntry[1]}x)` : 'None';
    statTopicsFound.textContent = Object.keys(data.topics_ranking || {}).length;

    // Render Chart
    renderChart(data.topics_ranking);

    // Render Topic Filters
    buildTopicFilters(data.topics_ranking);

    // Render Questions List
    renderQuestions();
}

// --------------------------------------------------------------------------
// CHART RENDERING (Chart.js)
// --------------------------------------------------------------------------
function setupChartToggles() {
    chartToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chartToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.chartType = btn.dataset.chart;
            if (state.analysisData) {
                renderChart(state.analysisData.topics_ranking);
            }
        });
    });
}

function renderChart(topicsRanking) {
    const labels = Object.keys(topicsRanking || {});
    const counts = Object.values(topicsRanking || {});

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    const ctx = topicsChartCanvas.getContext('2d');

    const colors = [
        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'
    ];

    if (state.chartType === 'bar') {
        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Question Count',
                    data: counts,
                    backgroundColor: colors.slice(0, labels.length),
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        titleColor: '#f9fafb',
                        bodyColor: '#93c5fd',
                        borderColor: '#374151',
                        borderWidth: 1,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', weight: '500' } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(55, 65, 81, 0.4)' },
                        ticks: { stepSize: 1, color: '#9ca3af' }
                    }
                }
            }
        });
    } else {
        // Doughnut chart
        state.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#111827',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#f3f4f6', font: { family: 'Plus Jakarta Sans' } }
                    }
                }
            }
        });
    }
}

// --------------------------------------------------------------------------
// FILTERS & QUESTIONS LIST
// --------------------------------------------------------------------------
function setupFiltersAndSearch() {
    questionSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderQuestions();
    });
}

function buildTopicFilters(topicsRanking) {
    topicFilters.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-pill active';
    allBtn.dataset.topic = 'all';
    allBtn.textContent = 'All Topics';
    allBtn.addEventListener('click', () => selectTopicFilter('all'));
    topicFilters.appendChild(allBtn);

    Object.keys(topicsRanking || {}).forEach(topic => {
        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.dataset.topic = topic;
        btn.textContent = `${topic} (${topicsRanking[topic]})`;
        btn.addEventListener('click', () => selectTopicFilter(topic));
        topicFilters.appendChild(btn);
    });
}

function selectTopicFilter(topic) {
    state.activeTopicFilter = topic;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.topic === topic);
    });
    renderQuestions();
}

function renderQuestions() {
    if (!state.analysisData || !state.analysisData.questions) return;

    questionsList.innerHTML = '';

    const filtered = state.analysisData.questions.filter(q => {
        const matchesTopic = state.activeTopicFilter === 'all' || 
            (q.topics && q.topics.includes(state.activeTopicFilter));

        const textToSearch = ((q.full_text || '') + ' ' + (q.display_text || '')).toLowerCase();
        const matchesSearch = !state.searchQuery || textToSearch.includes(state.searchQuery);

        return matchesTopic && matchesSearch;
    });

    if (filtered.length === 0) {
        questionsList.innerHTML = `<div class="no-results">No questions match your filter.</div>`;
        return;
    }

    filtered.forEach(q => {
        const item = document.createElement('div');
        item.className = 'question-item';

        const fullText = q.full_text || q.display_text;

        const topicBadges = (q.topics && q.topics.length > 0)
            ? q.topics.map(t => `<span class="topic-tag">${t}</span>`).join('')
            : `<span class="topic-tag" style="color:var(--text-muted)">Uncategorized</span>`;

        item.innerHTML = `
            <div class="question-content">
                <div class="question-meta">
                    ${topicBadges}
                </div>
                <div class="question-text">${escapeHtml(fullText)}</div>
            </div>
            <button class="copy-btn" title="Copy Question">📋 Copy</button>
        `;

        item.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(fullText);
            showToast('Question copied to clipboard!');
        });

        questionsList.appendChild(item);
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
