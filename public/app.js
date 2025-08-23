let allSeries = [];
let dbPath = null;
let currentFilter = 'all';
let analysisCache = {};
let isAnalyzing = false;
let analyzeQueue = [];

// Event Listeners
document.querySelectorAll('input[name="filter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        displaySeries();
    });
});

// Lade gespeicherte Analysen beim Start
loadSavedAnalysis();

async function loadSavedAnalysis() {
    try {
        const response = await fetch('/api/load-cache');
        const result = await response.json();
        if (result.success && result.cache) {
            analysisCache = result.cache;
        }
    } catch (error) {
        console.log('Kein Cache gefunden');
    }
}

async function loadDatabase() {
    showLoading('Lade Plex Datenbank...');
    
    try {
        const response = await fetch('/api/load-database', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        dbPath = result.dbPath;
        await loadSeries();
    } catch (error) {
        alert('Fehler beim Laden der Datenbank: ' + error.message);
        hideLoading();
    }
}

async function loadSeries() {
    showLoading('Lade Serien...');
    
    try {
        const response = await fetch('/api/get-series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dbPath })
        });
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        allSeries = result.data;
        
        // Lade gespeicherte Analysen
        allSeries.forEach(series => {
            const key = `${series.title}_${series.year || 'unknown'}`;
            if (analysisCache[key]) {
                series.analysis = analysisCache[key];
            }
        });
        
        displaySeries();
        updateStats();
        updateHeaderStats();
        
        // Starte schrittweise Analyse für nicht analysierte Serien
        startIncrementalAnalysis();
        
    } catch (error) {
        alert('Fehler beim Laden der Serien: ' + error.message);
        hideLoading();
    }
}

async function startIncrementalAnalysis() {
    const unanalyzed = allSeries.filter(s => !s.analysis || !s.analysis.hasAIAnalysis);
    analyzeQueue = [...unanalyzed];
    
    document.getElementById('statusMessage').textContent = `${unanalyzed.length} Serien zur Analyse bereit`;
    
    if (analyzeQueue.length > 0 && !isAnalyzing) {
        isAnalyzing = true;
        processAnalysisQueue();
    }
}

async function processAnalysisQueue() {
    while (analyzeQueue.length > 0 && isAnalyzing) {
        const series = analyzeQueue.shift();
        updateStatus(`Analysiere ${series.title}... (${analyzeQueue.length} verbleibend)`);
        
        try {
            const response = await fetch('/api/analyze-series', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dbPath,
                    seriesIds: series.ids,
                    title: series.title,
                    year: series.year,
                    locations: series.locations
                })
            });
            const result = await response.json();
            
            if (result.success) {
                series.analysis = result.data;
                
                // Speichere Analyse
                const key = `${series.title}_${series.year || 'unknown'}`;
                await saveAnalysis(key, result.data);
                
                // Update Anzeige
                displaySeries();
                updateStats();
                updateHeaderStats();
            }
        } catch (error) {
            console.error(`Fehler bei ${series.title}:`, error);
        }
        
        // Kleine Pause zwischen Anfragen
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    isAnalyzing = false;
    updateStatus('Analyse abgeschlossen');
    document.getElementById('exportBtn').disabled = false;
}

async function saveAnalysis(seriesKey, data) {
    analysisCache[seriesKey] = data;
    
    try {
        await fetch('/api/save-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesKey, data })
        });
    } catch (error) {
        console.error('Fehler beim Speichern der Analyse:', error);
    }
}

function displaySeries() {
    const container = document.getElementById('seriesList');
    container.innerHTML = '';
    
    let filteredSeries = allSeries;
    
    switch (currentFilter) {
        case 'complete':
            filteredSeries = allSeries.filter(s => s.analysis?.isComplete);
            break;
        case 'incomplete':
            filteredSeries = allSeries.filter(s => s.analysis && !s.analysis.isComplete);
            break;
        case 'ended':
            filteredSeries = allSeries.filter(s => s.analysis?.isEnded);
            break;
    }
    
    filteredSeries.forEach(series => {
        const card = createSeriesCard(series);
        container.appendChild(card);
    });
}

function createSeriesCard(series) {
    const card = document.createElement('div');
    card.className = 'series-card';
    if (series.analysis?.hasAIAnalysis) {
        card.classList.add('ai-analyzed');
    }
    card.onclick = () => showDetails(series);
    
    const info = document.createElement('div');
    info.className = 'series-info';
    
    const title = document.createElement('h3');
    title.textContent = series.title;
    if (series.year) title.textContent += ` (${series.year})`;
    
    const details = document.createElement('p');
    details.textContent = `${series.season_count} Staffeln • ${series.episode_count} Episoden`;
    
    const locations = document.createElement('div');
    locations.className = 'locations';
    locations.textContent = `Ordner: ${series.locations.join(', ')}`;
    
    info.appendChild(title);
    info.appendChild(details);
    info.appendChild(locations);
    
    const badge = document.createElement('div');
    badge.className = 'completion-badge';
    
    if (series.analysis) {
        const percentage = series.analysis.completionPercentage || 0;
        badge.textContent = `${Math.round(percentage)}%`;
        
        if (percentage >= 100) {
            badge.classList.add('complete');
        } else if (percentage >= 80) {
            badge.classList.add('incomplete');
        } else {
            badge.classList.add('critical');
        }
    } else {
        badge.textContent = '?';
        badge.classList.add('critical');
    }
    
    card.appendChild(info);
    card.appendChild(badge);
    
    return card;
}

function showDetails(series) {
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    title.textContent = series.title;
    
    let html = '';
    
    html += `<p><strong>Speicherorte:</strong> ${series.locations.join(', ')}</p>`;
    html += `<p><strong>Vorhandene Staffeln:</strong> ${series.season_count}</p>`;
    
    if (series.analysis) {
        const { isComplete, isEnded, completionPercentage, missing, metadata, hasAIAnalysis } = series.analysis;
        
        if (hasAIAnalysis) {
            html += '<p style="color: #4CAF50;">✓ Mit AI analysiert</p>';
        }
        
        html += `<p><strong>Status:</strong> ${isEnded ? 'Serie beendet' : 'Serie läuft noch'}</p>`;
        html += `<p><strong>Vollständigkeit:</strong> ${Math.round(completionPercentage)}%</p>`;
        
        if (metadata) {
            html += `<p><strong>Erwartet:</strong> ${metadata.totalSeasons} Staffeln, ${metadata.totalEpisodes} Episoden</p>`;
        }
        
        html += `<p><strong>Vorhanden:</strong> ${series.season_count} Staffeln, ${series.episode_count} Episoden</p>`;
        
        if (missing && missing.length > 0) {
            html += '<div class="missing-episodes">';
            html += '<h4>Fehlende Episoden:</h4>';
            html += '<ul class="episode-list">';
            
            missing.forEach(ep => {
                html += `<li>Staffel ${ep.season}, Episode ${ep.episode}</li>`;
            });
            
            html += '</ul></div>';
        }
    } else {
        html += '<p>Keine Analysedaten verfügbar</p>';
    }
    
    content.innerHTML = html;
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}

function updateStats() {
    const total = allSeries.length;
    const complete = allSeries.filter(s => s.analysis?.isComplete).length;
    const percentage = total > 0 ? Math.round(complete / total * 100) : 0;
    
    document.getElementById('totalSeries').textContent = `${total} Serien`;
    document.getElementById('completionRate').textContent = `${percentage}% komplett`;
}

function updateHeaderStats() {
    const total = allSeries.length;
    const complete = allSeries.filter(s => s.analysis?.isComplete).length;
    const analyzed = allSeries.filter(s => s.analysis?.hasAIAnalysis).length;
    const totalEpisodes = allSeries.reduce((sum, s) => sum + s.episode_count, 0);
    const ended = allSeries.filter(s => s.analysis?.isEnded).length;
    
    const statsHtml = `
        <div><span>${total}</span> Serien</div>
        <div><span>${totalEpisodes}</span> Episoden</div>
        <div><span>${complete}</span> Komplett</div>
        <div><span>${ended}</span> Beendet</div>
        <div><span>${analyzed}</span> Analysiert</div>
    `;
    
    document.getElementById('headerStats').innerHTML = statsHtml;
}

function showLoading(message) {
    const container = document.getElementById('seriesList');
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function hideLoading() {
    document.getElementById('seriesList').innerHTML = '';
}

function updateStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}

function updateProgress(percentage) {
    document.getElementById('progressBar').style.width = percentage + '%';
}

async function exportMissing() {
    const incomplete = allSeries.filter(s => s.analysis && !s.analysis.isComplete);
    
    let csv = 'Serie,Jahr,Bibliotheken,Staffeln,Vollständigkeit,Fehlende Episoden\n';
    
    incomplete.forEach(series => {
        const missing = series.analysis.missing.map(ep => `S${ep.season}E${ep.episode}`).join('; ');
        csv += `"${series.title}",${series.year || ''},${series.locations.join('|')},${series.season_count},${series.analysis.completionPercentage}%,"${missing}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plex-missing-episodes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// Modal schließen bei Klick außerhalb
window.onclick = function(event) {
    const modal = document.getElementById('detailModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}