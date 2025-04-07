// DOM Elements
const downloadSpeed = document.getElementById('download-speed');
const uploadSpeed = document.getElementById('upload-speed');
const startButton = document.getElementById('start-test');
const progress = document.getElementById('progress');
const errorMessage = document.getElementById('error-message');
const historyList = document.getElementById('history-list');
const clearHistoryButton = document.getElementById('clear-history');
const speedometerGauge = document.querySelector('.speedometer-gauge');

// Constants
const TEST_FILE = 'https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js'; // ~88KB test file
const CHUNK_SIZE = 256 * 1024; // 256KB for upload test
const GAUGE_MIN_ANGLE = 0;
const GAUGE_MAX_ANGLE = 180;
const MAX_SPEED = 200; // Maximum speed in Mbps

// State
let isTestRunning = false;
let currentPhase = 'download';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    setupEventListeners();
});

function setupEventListeners() {
    startButton.addEventListener('click', startSpeedTest);
    clearHistoryButton.addEventListener('click', clearHistory);
}

async function startSpeedTest() {
    if (isTestRunning) return;
    
    isTestRunning = true;
    resetUI();
    showProgress();

    try {
        // Download speed test
        currentPhase = 'download';
        const downloadResult = await measureDownloadSpeed();
        updateSpeedDisplay(downloadResult.toFixed(1), '--');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Upload speed test
        currentPhase = 'upload';
        const uploadResult = await measureUploadSpeed();
        
        // Save final results
        updateSpeedDisplay(downloadResult.toFixed(1), uploadResult.toFixed(1));
        saveToHistory(downloadResult, uploadResult);
        
    } catch (error) {
        console.error('Speed test error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        hideProgress();
        isTestRunning = false;
    }
}

async function measureDownloadSpeed() {
    const samples = [];
    const startTime = performance.now();
    let totalBytes = 0;

    try {
        // Download the test file multiple times
        for (let i = 0; i < 3; i++) {
            const response = await fetch(`${TEST_FILE}?t=${Date.now()}`);
            const reader = response.body.getReader();
            
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                
                totalBytes += value.length;
                const currentTime = performance.now();
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const speedMbps = (totalBytes * 8) / (1000000 * elapsedSeconds);
                
                samples.push(speedMbps);
                updateSpeedDisplay(speedMbps.toFixed(1), '--');
                updateGauge(speedMbps);
            }
        }
        
        // Calculate average speed
        const avgSpeed = samples.reduce((a, b) => a + b, 0) / samples.length;
        return Math.min(avgSpeed, MAX_SPEED);
    } catch (error) {
        throw new Error('Download speed test failed');
    }
}

async function measureUploadSpeed() {
    const samples = [];
    const startTime = performance.now();
    const testData = new Blob([new ArrayBuffer(CHUNK_SIZE)]);

    try {
        // Perform multiple upload tests
        for (let i = 0; i < 3; i++) {
            const formData = new FormData();
            formData.append('file', testData);

            const uploadStart = performance.now();
            const response = await fetch('https://httpbin.org/post', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const uploadEnd = performance.now();
            const elapsedSeconds = (uploadEnd - uploadStart) / 1000;
            const speedMbps = (CHUNK_SIZE * 8) / (1000000 * elapsedSeconds);
            
            samples.push(speedMbps);
            updateSpeedDisplay(downloadSpeed.textContent, speedMbps.toFixed(1));
            updateGauge(speedMbps);
        }

        // Calculate average speed
        const avgSpeed = samples.reduce((a, b) => a + b, 0) / samples.length;
        return Math.min(avgSpeed, MAX_SPEED);
    } catch (error) {
        throw new Error('Upload speed test failed');
    }
}

function updateSpeedDisplay(download, upload) {
    if (download !== '--') {
        downloadSpeed.textContent = download;
        downloadSpeed.classList.add('speed-updating');
    }
    
    if (upload !== '--') {
        uploadSpeed.textContent = upload;
        uploadSpeed.classList.add('speed-updating');
    }
    
    setTimeout(() => {
        downloadSpeed.classList.remove('speed-updating');
        uploadSpeed.classList.remove('speed-updating');
    }, 300);
}

function updateGauge(speed) {
    const speedRatio = Math.min(speed / MAX_SPEED, 1);
    const gaugeRotation = GAUGE_MIN_ANGLE + (GAUGE_MAX_ANGLE - GAUGE_MIN_ANGLE) * speedRatio;
    speedometerGauge.style.transform = `rotate(${gaugeRotation}deg)`;
}

function resetUI() {
    errorMessage.classList.add('hide');
    errorMessage.classList.remove('show');
    startButton.disabled = true;
    startButton.classList.add('opacity-50');
    speedometerGauge.style.transform = 'rotate(0deg)';
    downloadSpeed.textContent = '--';
    uploadSpeed.textContent = '--';
}

function showProgress() {
    progress.classList.remove('hidden');
    downloadSpeed.classList.add('opacity-50');
    uploadSpeed.classList.add('opacity-50');
}

function hideProgress() {
    progress.classList.add('hidden');
    downloadSpeed.classList.remove('opacity-50');
    uploadSpeed.classList.remove('opacity-50');
    startButton.disabled = false;
    startButton.classList.remove('opacity-50');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden', 'hide');
    errorMessage.classList.add('show');
}

// History Management
function saveToHistory(downloadSpeed, uploadSpeed) {
    const timestamp = new Date().toLocaleString();
    const historyItem = {
        download: downloadSpeed,
        upload: uploadSpeed,
        timestamp
    };
    
    let history = getHistory();
    history.unshift(historyItem);
    history = history.slice(0, 10);
    
    localStorage.setItem('speedTestHistory', JSON.stringify(history));
    updateHistoryDisplay();
}

function getHistory() {
    const history = localStorage.getItem('speedTestHistory');
    return history ? JSON.parse(history) : [];
}

function loadHistory() {
    updateHistoryDisplay();
}

function clearHistory() {
    localStorage.removeItem('speedTestHistory');
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const history = getHistory();
    
    historyList.innerHTML = history.map(item => `
        <div class="history-item p-3 rounded-lg bg-black/20 flex justify-between items-center">
            <div class="flex items-center gap-4">
                <div>
                    <i class="fas fa-download text-blue-400 mr-1"></i>
                    <span class="font-semibold">${item.download} Mbps</span>
                </div>
                <div>
                    <i class="fas fa-upload text-green-400 mr-1"></i>
                    <span class="font-semibold">${item.upload} Mbps</span>
                </div>
            </div>
            <span class="text-sm text-gray-400">${item.timestamp}</span>
        </div>
    `).join('');
    
    clearHistoryButton.style.display = history.length ? 'block' : 'none';
}