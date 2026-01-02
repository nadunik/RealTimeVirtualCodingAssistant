const vscode = acquireVsCodeApi();
const socket = io('http://localhost:5000', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
});

let connected = false;
let loading = false;
let errors = [];
let currentCode = '';
let currentLanguage = '';
let statsChart = null;
let fuse = null;
let searchTimeout = null;

function updateStatus() {
    console.log('Updating status, connected:', connected, 'loading:', loading);
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const statusDiv = document.getElementById('status');
    statusDot.style.backgroundColor = connected ? '#4ade80' : '#ef4444';
    statusText.textContent = connected ? 'Connected to RTVCA' : 'Disconnected';
    statusDiv.classList.toggle('loading', loading);
}

function initializeChart(stats) {
    console.log('Initializing chart with stats:', stats);
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (statsChart) {
        statsChart.destroy();
    }
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Request Fix', 'Autopilot'],
            datasets: [{
                label: 'Usage Count',
                data: [stats.requestFixCount, stats.autopilotCount],
                backgroundColor: ['#3b82f6', '#8b5cf6'],
                borderColor: ['#1e40af', '#5b21b6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#d4d4d4',
                        stepSize: 1
                    },
                    grid: {
                        color: '#374151'
                    }
                },
                x: {
                    ticks: {
                        color: '#d4d4d4'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#d4d4d4'
                    }
                },
                tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#d4d4d4',
                    bodyColor: '#d4d4d4'
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}






socket.on('connect', () => {
    console.log('Connected to server');
    connected = true;
    updateStatus();
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    connected = false;
    updateStatus();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connected = false;
    updateStatus();
});

socket.on('code_errors', (data) => {
    console.log('Received code_errors:', data);
    loading = false;
    updateStatus();
    errors = data.errors || [];
    currentCode = data.code || currentCode;
    const errorsDiv = document.getElementById('errors');
    errorsDiv.innerHTML = errors.map((error, index) => `
        <div class="card bg-gray-900 p-3 rounded-md animate__animated animate__fadeIn">
            <div class="flex items-center text-red-400">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <strong>${error.type || 'Error'} (Line ${error.line || 0}, Col ${error.column || 0})</strong>
            </div>
            <p class="text-gray-300 mt-1">${error.message}</p>
            <button class="request-fix btn mt-2 px-3 py-1 bg-blue-600 text-white rounded-md" data-index="${index}">Request Fix</button>
        </div>
    `).join('');
    vscode.postMessage({
        command: 'updateDiagnostics',
        errors: errors
    });
    attachEventListeners();
});

socket.on('code_fix', (data) => {
    console.log('Received code_fix:', data);
    loading = false;
    updateStatus();
    if (data.fix_result.success) {
        const fixesDiv = document.getElementById('fixes');
        fixesDiv.innerHTML = `
            <div class="card bg-gray-900 p-3 rounded-md animate__animated animate__fadeIn">
                <div class="flex items-center text-green-400">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <strong>Fix for ${data.error.message}</strong>
                </div>
                <pre class="text-gray-300 mt-1 bg-gray-800 p-2 rounded">${data.fix_result.fix}</pre>
                
            </div>
        ` + fixesDiv.innerHTML;
        attachEventListeners();
    }
});

socket.on('autopilot_result', (data) => {
    console.log('Received autopilot_result:', data);
    loading = false;
    updateStatus();
    if (data.result.success) {
        vscode.postMessage({
            command: 'applyFix',
            code: data.result.code
        });
        currentCode = data.result.code;
        checkAutopilot(data.result.code);
    } else {
        const fixesDiv = document.getElementById('fixes');
        fixesDiv.innerHTML = `
            <div class="card bg-gray-900 p-3 rounded-md animate__animated animate__fadeIn">
                <div class="flex items-center text-red-400">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <strong>Autopilot Error (Line ${data.line})</strong>
                </div>
                <p class="text-gray-300 mt-1">Error generating code: ${data.result.error}</p>
            </div>
        ` + fixesDiv.innerHTML;
        attachEventListeners();
    }
});

function checkAutopilot(code) {
    console.log('Checking autopilot comments');
    const lines = code.split('\n');
    const commentPattern = /^\s*(?:\/\/|#)\s*autopilot\s+(.+)$/;
    const comments = [];
    lines.forEach((line, index) => {
        const match = line.match(commentPattern);
        if (match) {
            comments.push({
                line: index + 1,
                instruction: match[1].trim()
            });
        }
    });
    const autopilotDiv = document.getElementById('autopilot');
    autopilotDiv.innerHTML = comments.map((comment) => `
        <div class="card bg-gray-900 p-3 rounded-md animate__animated animate__fadeIn">
            <div class="flex items-center text-blue-400">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m0-2v-2m0-2V7m-4 5h8m4 0h4" />
                </svg>
                <strong>Line ${comment.line}: ${comment.instruction}</strong>
            </div>
            <button class="run-autopilot btn mt-2 px-3 py-1 bg-blue-600 text-white rounded-md" data-line="${comment.line}" data-instruction="${encodeURIComponent(comment.instruction)}">Run Autopilot</button>
        </div>
    `).join('');
    attachEventListeners();
}

function attachEventListeners() {
    console.log('Attaching event listeners');
    document.querySelectorAll('.request-fix').forEach((button) => {
        button.removeEventListener('click', handleRequestFix);
        button.addEventListener('click', handleRequestFix);
    });
    document.querySelectorAll('.run-autopilot').forEach((button) => {
        button.removeEventListener('click', handleRunAutopilot);
        button.addEventListener('click', handleRunAutopilot);
    });
    document.querySelectorAll('.apply-fix').forEach((button) => {
        button.removeEventListener('click', handleApplyFix);
        button.addEventListener('click', handleApplyFix);
    });
    document.querySelectorAll('.open-doc').forEach((button) => {
        button.removeEventListener('click', handleOpenDoc);
        button.addEventListener('click', handleOpenDoc);
    });
}

function handleRequestFix(event) {
    const button = event.target;
    const index = parseInt(button.dataset.index);
    console.log('Request Fix clicked, index:', index);
    if (errors[index]) {
        console.log('Emitting fix_code:', { code: currentCode, error: errors[index] });
        if (socket.connected) {
            loading = true;
            updateStatus();
            socket.emit('fix_code', {
                code: currentCode,
                error: errors[index]
            });
            vscode.postMessage({
                command: 'incrementStat',
                stat: 'requestFix'
            });
        } else {
            console.error('Socket not connected for fix_code');
        }
    } else {
        console.error('Error not found for index:', index, 'Errors:', errors);
    }
}

function handleRunAutopilot(event) {
    const button = event.target;
    const instruction = decodeURIComponent(button.dataset.instruction);
    const line = parseInt(button.dataset.line);
    console.log('Run Autopilot clicked, instruction:', instruction, 'line:', line);
    if (socket.connected) {
        console.log('Emitting autopilot_code:', {
            instruction,
            line,
            language: currentLanguage,
            code: currentCode
        });
        loading = true;
        updateStatus();
        socket.emit('autopilot_code', {
            instruction,
            line,
            language: currentLanguage,
            code: currentCode
        });
        vscode.postMessage({
            command: 'incrementStat',
            stat: 'autopilot'
        });
    } else {
        console.error('Socket not connected for autopilot_code');
    }
}





window.addEventListener('message', (event) => {
    const message = event.data;
    console.log('Received message from extension:', message);
    switch (message.command) {
        case 'checkCode':
            if (socket.connected && message.code.trim()) {
                console.log('Emitting check_code:', { code: message.code, language: message.language });
                loading = true;
                updateStatus();
                currentCode = message.code;
                currentLanguage = message.language;
                socket.emit('check_code', {
                    code: message.code,
                    language: message.language
                });
            }
            checkAutopilot(message.code);
            break;
        case 'updateStats':
            console.log('Updating stats chart:', message.stats);
            initializeChart(message.stats);
            break;
    }
});

attachEventListeners();
updateStatus();
