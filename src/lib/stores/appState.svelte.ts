export type AppView = 'MENU' | 'PLL_TRAINER' | 'OLL_TRAINER' | 'F2L_TRAINER' | 'LSLL_TRAINER' | 'ZBLL_TRAINER' | 'LL_TRAINER' | 'PLL_TIME_ATTACK' | 'F2L_TIME_ATTACK' | 'SETTINGS' | 'STATS' | 'VISUAL_TEST';

interface AppSettings {
    crossColors: ('white' | 'yellow' | 'red' | 'orange' | 'green' | 'blue')[];
    transitionDelay: number; // ms
    pllPreferences: Record<string, { pre: string, post: string }>;
    timeAttackOrder: string[];
}

class AppState {
    view = $state<AppView>('MENU');
    previousView = $state<AppView>('MENU');
    lastActiveTrainer = $state<AppView | null>(null);
    isSolving = $state(false);
    settings = $state<AppSettings>({
        crossColors: ['white'],
        transitionDelay: 500,
        pllPreferences: {},
        timeAttackOrder: []
    });

    constructor() {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('app_settings');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Migration for old crossColor setting
                    if (parsed.crossColor && !parsed.crossColors) {
                        parsed.crossColors = [parsed.crossColor];
                        delete parsed.crossColor;
                    }
                    this.settings = { ...this.settings, ...parsed };
                } catch (e) {
                    console.error("Failed to load app settings", e);
                }
            }
        }
    }

    setView(v: AppView) {
        if (this.view === v) return;

        // Track last trainer visited
        if (this.view.endsWith('_TRAINER') || this.view === 'PLL_TIME_ATTACK') {
            this.lastActiveTrainer = this.view;
        }

        this.previousView = this.view;
        this.view = v;
    }

    updateSettings(s: Partial<AppSettings>) {
        this.settings = { ...this.settings, ...s };
        this.persist();
    }

    updatePllPreference(caseName: string, prefs: { pre: string, post: string }) {
        this.settings.pllPreferences[caseName] = prefs;
        this.persist();
    }

    persist() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('app_settings', JSON.stringify(this.settings));
        }
    }
}

export const appState = new AppState();
