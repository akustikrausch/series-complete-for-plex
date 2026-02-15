// Initialize critical functions immediately for event delegation
// This file MUST be loaded before app.js

window.openSettings = function() {
    // Prevent duplicate modals (multiple handlers may call this)
    if (document.getElementById('settings-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'settings-title');
    modal.innerHTML = `
        <div class="glass-effect rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up" style="animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)">
            <!-- Header -->
            <div class="flex items-center justify-between p-5 pb-0">
                <h2 id="settings-title" class="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                        <svg class="w-4 h-4 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </div>
                    Settings
                </h2>
                <button id="settings-close-btn" class="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-white/[0.06] transition-all" aria-label="Close settings">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div class="p-5 space-y-5">
                <!-- Configuration Section -->
                <div>
                    <h3 class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Configuration</h3>
                    <div class="space-y-1.5">
                        <button id="manage-api-keys-btn" title="Configure API keys for enhanced metadata"
                                class="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white hover:bg-white/[0.06] hover:border-primary-500/20 transition-all flex items-center gap-3 group">
                            <div class="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                </svg>
                            </div>
                            <div class="text-left">
                                <div class="text-sm font-medium">API Keys</div>
                                <div class="text-xs text-surface-500">Configure TMDb & TheTVDB</div>
                            </div>
                            <svg class="w-4 h-4 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>

                        <button id="database-settings-btn"
                                class="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white hover:bg-white/[0.06] hover:border-white/10 transition-all flex items-center gap-3 group">
                            <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
                                </svg>
                            </div>
                            <div class="text-left">
                                <div class="text-sm font-medium">Database</div>
                                <div class="text-xs text-surface-500">Plex database path</div>
                            </div>
                            <svg class="w-4 h-4 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>

                        <button id="open-docs-btn"
                                class="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white hover:bg-white/[0.06] hover:border-white/10 transition-all flex items-center gap-3 group">
                            <div class="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                </svg>
                            </div>
                            <div class="text-left">
                                <div class="text-sm font-medium">User Manual</div>
                                <div class="text-xs text-surface-500">Documentation & guides</div>
                            </div>
                            <svg class="w-4 h-4 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Library Section -->
                <div>
                    <h3 class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Library</h3>
                    <div class="space-y-1.5">
                        <button id="settings-scan-btn"
                                class="w-full py-2.5 px-3.5 rounded-xl bg-primary-500/8 border border-primary-500/15 text-white hover:bg-primary-500/15 hover:border-primary-500/25 transition-all flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                            </div>
                            <span class="text-sm font-medium">Scan Library</span>
                        </button>

                        <button id="settings-analyze-all-btn"
                                class="w-full py-2.5 px-3.5 rounded-xl bg-primary-500/8 border border-primary-500/15 text-white hover:bg-primary-500/15 hover:border-primary-500/25 transition-all flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                                </svg>
                            </div>
                            <span class="text-sm font-medium">Analyze All Series</span>
                        </button>

                        <button id="settings-cleanup-btn"
                                class="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white hover:bg-white/[0.06] hover:border-white/10 transition-all flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-surface-700/50 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7m-1-3h-3.5l-1-1h-5l-1 1H5m14 0v-.5A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5V4"/>
                                </svg>
                            </div>
                            <span class="text-sm font-medium">Cleanup Library</span>
                        </button>
                    </div>
                </div>

                <!-- Danger Zone -->
                <div>
                    <h3 class="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2.5">System</h3>
                    <button id="settings-clear-cache-btn"
                            class="w-full py-2.5 px-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/15 text-red-300 hover:bg-red-500/[0.12] hover:border-red-500/25 transition-all flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </div>
                        <span class="text-sm font-medium">Clear Cache</span>
                    </button>
                </div>

                <!-- Footer -->
                <div class="pt-3 border-t border-white/[0.06] text-center space-y-1.5">
                    <a href="https://github.com/akustikrausch/series-complete-for-plex" target="_blank" rel="noopener noreferrer"
                       class="inline-flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-primary-400 transition-colors">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                        GitHub
                    </a>
                    <p class="text-[11px] text-surface-600">
                        <span class="text-primary-500/70 font-medium">Series Complete for Plex</span>
                        <span class="mx-1.5 text-surface-700">&middot;</span>
                        v2.6.3
                    </p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Cleanup function to remove modal and event listener
    const closeModal = () => {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
    };

    // Direct close button handler (reliable, no delegation needed)
    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        };
    }

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Escape key to close (stopImmediatePropagation prevents app.js global ESC from double-firing)
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            e.stopImmediatePropagation();
            closeModal();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Also cleanup when close button removes the modal via data-action
    const observer = new MutationObserver(() => {
        if (!document.body.contains(modal)) {
            document.removeEventListener('keydown', escHandler);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true });
};
