// Initialize critical functions immediately for event delegation
// This file MUST be loaded before app.js

window.openSettings = function() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4';
    modal.innerHTML = `
        <div class="glass-effect rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-plex-white flex items-center">
                    <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    Settings
                </h2>
                <button data-action="close-modal" class="text-plex-light hover:text-purple-500 transition" title="Close settings">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <!-- Configuration -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-purple-500 mb-3">Configuration</h3>
                <div class="space-y-3">
                    <button id="manage-api-keys-btn" title="Configure API keys for enhanced metadata" 
                            class="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                        </svg>
                        Manage API Keys
                    </button>
                    
                    <button id="database-settings-btn" 
                            class="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:bg-orange-600 transition flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M3 7l9 9 9-9"/>
                        </svg>
                        Plex Database Settings
                    </button>
                    
                    <button id="open-docs-btn" 
                            class="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                        Open User Manual
                    </button>
                </div>
            </div>
            
            <!-- Library Actions -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-purple-500 mb-3">Library</h3>
                <div class="space-y-3">
                    <button id="settings-scan-btn" 
                            class="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        Scan Library
                    </button>
                    
                    <button id="settings-analyze-all-btn" 
                            class="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg hover:from-orange-500 hover:to-orange-600 transition shadow-md flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                        </svg>
                        Analyze All Series
                    </button>
                    
                    <button id="settings-cleanup-btn" 
                            class="w-full py-3 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7m-1-3h-3.5l-1-1h-5l-1 1H5m14 0v-.5A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5V4"/>
                        </svg>
                        Cleanup Library
                    </button>
                </div>
            </div>
            
            <!-- System -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-purple-500 mb-3">System</h3>
                <div class="space-y-3">
                    <button id="settings-clear-cache-btn" 
                            class="w-full py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center">
                        <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Clear Cache
                    </button>
                </div>
            </div>
            
            <div class="pt-4 border-t border-plex-gray text-center">
                <p class="text-xs text-plex-light mb-4">
                    <span class="text-purple-500 font-semibold">Series Complete for Plex</span> v2.5.1
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close modal when clicking outside or on close button
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-action="close-modal"]')) {
            modal.remove();
        }
    });
    
    // Event delegation will handle all button clicks
    // No need for individual event listeners here
};

console.log('[init-settings.js] openSettings function defined globally');