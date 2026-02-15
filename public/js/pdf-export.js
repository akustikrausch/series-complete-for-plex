// PDF Export functionality for missing episodes
// Uses jsPDF library for PDF generation

function exportMissingEpisodesPDF(seriesData) {
    // Initialize jsPDF with A4 format
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // A4 dimensions: 210mm x 297mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    const lineHeight = 7;
    const titleFontSize = 24;
    const headerFontSize = 14;
    const normalFontSize = 10;
    
    // Colors (converting from hex to RGB)
    const plexOrange = [229, 160, 13];
    const darkGray = [63, 64, 69];
    const lightGray = [153, 153, 153];
    const black = [0, 0, 0];
    
    // Filter series with missing episodes
    const incompleteSeries = seriesData.filter(series => {
        if (!series.totalEpisodes) return false;
        const completion = Math.round((series.episode_count / series.totalEpisodes) * 100);
        return completion < 100;
    }).sort((a, b) => {
        // Sort by completion percentage (lowest first)
        const compA = (a.episode_count / a.totalEpisodes) * 100;
        const compB = (b.episode_count / b.totalEpisodes) * 100;
        return compA - compB;
    });
    
    if (incompleteSeries.length === 0) {
        alert('No missing episodes found! All analyzed series are complete.');
        return;
    }
    
    let currentY = margin;
    let pageNumber = 1;
    
    // Add header function
    function addHeader() {
        // Logo/Title
        doc.setFontSize(titleFontSize);
        doc.setTextColor(...plexOrange);
        doc.setFont(undefined, 'bold');
        doc.text('Series Complete for Plex', margin, currentY);
        
        // Subtitle
        doc.setFontSize(12);
        doc.setTextColor(...lightGray);
        doc.setFont(undefined, 'normal');
        doc.text('Missing Episodes Report', margin, currentY + 8);
        
        // Date and page
        doc.setFontSize(10);
        const date = new Date().toLocaleDateString('de-DE', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        doc.text(date, pageWidth - margin - 40, currentY);
        doc.text(`Page ${pageNumber}`, pageWidth - margin - 40, currentY + 5);
        
        // Separator line
        currentY += 15;
        doc.setDrawColor(...plexOrange);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        
        currentY += 10;
    }
    
    // Add footer function
    function addFooter() {
        const footerY = pageHeight - 15;
        doc.setFontSize(8);
        doc.setTextColor(...lightGray);
        doc.setFont(undefined, 'italic');
        doc.text('© 2025-2026 by Akustikrausch', pageWidth / 2, footerY, { align: 'center' });
        doc.text('Generated with Series Complete for Plex', pageWidth / 2, footerY + 3, { align: 'center' });
    }
    
    // Add summary statistics
    function addSummary() {
        doc.setFontSize(headerFontSize);
        doc.setTextColor(...black);
        doc.setFont(undefined, 'bold');
        doc.text('Summary', margin, currentY);
        currentY += 8;
        
        doc.setFontSize(normalFontSize);
        doc.setFont(undefined, 'normal');
        
        const totalSeries = seriesData.length;
        const analyzedSeries = seriesData.filter(s => s.totalEpisodes).length;
        const completeSeries = seriesData.filter(s => {
            if (!s.totalEpisodes) return false;
            return s.episode_count >= s.totalEpisodes;
        }).length;
        
        const totalMissing = incompleteSeries.reduce((sum, series) => {
            return sum + (series.totalEpisodes - series.episode_count);
        }, 0);
        
        // Create summary box
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, currentY, contentWidth, 40, 3, 3, 'F');
        
        currentY += 8;
        doc.text(`Total Series in Library: ${totalSeries}`, margin + 5, currentY);
        currentY += 7;
        doc.text(`Analyzed Series: ${analyzedSeries}`, margin + 5, currentY);
        currentY += 7;
        doc.text(`Complete Series: ${completeSeries}`, margin + 5, currentY);
        currentY += 7;
        doc.text(`Incomplete Series: ${incompleteSeries.length}`, margin + 5, currentY);
        doc.setTextColor(...plexOrange);
        doc.setFont(undefined, 'bold');
        doc.text(`Total Missing Episodes: ${totalMissing}`, margin + 100, currentY - 21);
        
        doc.setTextColor(...black);
        doc.setFont(undefined, 'normal');
        currentY += 15;
    }
    
    // Add series entry
    function addSeriesEntry(series, index) {
        const missingEpisodes = series.totalEpisodes - series.episode_count;
        const completion = Math.round((series.episode_count / series.totalEpisodes) * 100);
        
        // Check if we need a new page
        if (currentY > pageHeight - 50) {
            doc.addPage();
            pageNumber++;
            currentY = margin;
            addHeader();
        }
        
        // Series header with number
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(margin, currentY - 5, contentWidth, 10, 2, 2, 'F');
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...darkGray);
        doc.text(`${index + 1}. ${series.title}`, margin + 2, currentY);
        
        // Year and status on the right
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const yearText = series.year ? `(${series.year}${series.endYear && series.endYear !== series.year ? '-' + series.endYear : ''})` : '';
        doc.text(yearText, pageWidth - margin - 30, currentY);
        
        currentY += 7;
        
        // Progress bar
        const barWidth = 100;
        const barHeight = 4;
        const barX = margin + 2;
        
        // Background
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(barX, currentY - 3, barWidth, barHeight, 1, 1, 'F');
        
        // Progress
        const progressWidth = (completion / 100) * barWidth;
        if (completion >= 75) {
            doc.setFillColor(76, 175, 80); // Green
        } else if (completion >= 50) {
            doc.setFillColor(255, 193, 7); // Yellow
        } else {
            doc.setFillColor(244, 67, 54); // Red
        }
        doc.roundedRect(barX, currentY - 3, progressWidth, barHeight, 1, 1, 'F');
        
        // Completion text
        doc.setFontSize(10);
        doc.setTextColor(...black);
        doc.text(`${completion}% Complete`, barX + barWidth + 5, currentY);
        
        currentY += 6;
        
        // Episode details
        doc.setFontSize(9);
        doc.setTextColor(...darkGray);
        doc.text(`Episodes: ${series.episode_count} of ${series.totalEpisodes} (Missing: ${missingEpisodes})`, margin + 2, currentY);
        
        if (series.season_count && series.totalSeasons) {
            doc.text(`Seasons: ${series.season_count} of ${series.totalSeasons}`, margin + 80, currentY);
        }
        
        currentY += 6;
        
        // Folder locations if available
        if (series.folders && series.folders.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(...lightGray);
            doc.setFont(undefined, 'italic');
            const folderText = 'Location: ' + series.folders[0].substring(0, 70);
            doc.text(folderText, margin + 2, currentY);
            currentY += 5;
        }
        
        currentY += 8;
    }
    
    // Generate PDF
    addHeader();
    addSummary();
    
    // Add missing episodes section
    doc.setFontSize(headerFontSize);
    doc.setTextColor(...black);
    doc.setFont(undefined, 'bold');
    doc.text('Incomplete Series Details', margin, currentY);
    currentY += 10;
    
    // Add each incomplete series
    incompleteSeries.forEach((series, index) => {
        addSeriesEntry(series, index);
    });
    
    // Add footer to last page
    addFooter();
    
    // Generate filename with date
    const today = new Date().toISOString().split('T')[0];
    const filename = `SeriesComplete_Missing_Episodes_${today}.pdf`;
    
    // Save the PDF
    doc.save(filename);
}

// Export function to be called from main app
window.exportMissingEpisodes = function() {
    if (!window.state || !window.state.series || window.state.series.length === 0) {
        showNotification('error', 'No series data available. Please scan your library first.');
        return;
    }
    
    // Close settings modal if open
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) modal.remove();
    
    showNotification('info', 'Generating PDF report...');
    
    setTimeout(() => {
        try {
            exportMissingEpisodesPDF(window.state.series);
            showNotification('success', 'PDF report downloaded successfully!');
        } catch (error) {
            console.error('PDF generation error:', error);
            showNotification('error', 'Failed to generate PDF: ' + error.message);
        }
    }, 500);
};