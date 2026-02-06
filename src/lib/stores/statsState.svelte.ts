export interface StatEntry {
    date: number;
    time: number;
    inspectionTime?: number;
    executionTime?: number;
    moveCount?: number;
    result: 'CORRECT' | 'FAIL';
    case: string;
    mode?: string;
}

export interface CaseStats {
    correct: number;
    seen: number;
    times: number[];
    inspTimes?: number[];
    execTimes?: number[];
    moveCounts?: number[];
}

class StatsState {
    // Current session stats
    session = $state<Record<string, CaseStats>>({});
    // Detailed history
    history = $state<StatEntry[]>([]);

    constructor() {
        if (typeof localStorage !== 'undefined') {
            const s = localStorage.getItem('pll_v2_session');
            if (s) {
                try {
                    this.session = JSON.parse(s);
                } catch (e) {
                    console.error('Failed to load session', e);
                }
            }

            const h = localStorage.getItem('pll_v2_history');
            if (h) {
                try {
                    this.history = JSON.parse(h);
                } catch (e) {
                    console.error('Failed to load history', e);
                }
            }
        }
    }

    addResult(
        caseName: string,
        time: number,
        result: 'CORRECT' | 'FAIL',
        mode?: string,
        inspectionTime?: number,
        executionTime?: number,
        moveCount?: number
    ) {
        // Update Session
        if (!this.session[caseName]) {
            this.session[caseName] = { correct: 0, seen: 0, times: [], inspTimes: [], execTimes: [], moveCounts: [] };
        }

        const s = this.session[caseName];
        s.seen++;
        if (result === 'CORRECT') {
            s.correct++;
            s.times.push(time);
            if (inspectionTime !== undefined) {
                if (!s.inspTimes) s.inspTimes = [];
                s.inspTimes.push(inspectionTime);
            }
            if (executionTime !== undefined) {
                if (!s.execTimes) s.execTimes = [];
                s.execTimes.push(executionTime);
            }
            if (moveCount !== undefined) {
                if (!s.moveCounts) s.moveCounts = [];
                s.moveCounts.push(moveCount);
            }
        }

        // Update History
        this.history.push({
            date: Date.now(),
            time,
            inspectionTime,
            executionTime,
            moveCount, // Store it
            result,
            case: caseName,
            mode
        });

        this.persist();
    }
    // ...

    deleteEntry(date: number) {
        const index = this.history.findIndex(h => h.date === date);
        if (index === -1) return;

        const entry = this.history[index];
        this.history.splice(index, 1);

        // Update Session Stats if possible
        const s = this.session[entry.case];
        if (s) {
            if (s.seen > 0) s.seen--;
            if (entry.result === 'CORRECT') {
                if (s.correct > 0) s.correct--;
                // Remove one instance of the time
                const tIndex = s.times.indexOf(entry.time);
                if (tIndex !== -1) {
                    s.times.splice(tIndex, 1);
                    if (entry.inspectionTime !== undefined && s.inspTimes) {
                        const iIndex = s.inspTimes.indexOf(entry.inspectionTime);
                        if (iIndex !== -1) s.inspTimes.splice(iIndex, 1);
                    }
                    if (entry.executionTime !== undefined && s.execTimes) {
                        const eIndex = s.execTimes.indexOf(entry.executionTime);
                        if (eIndex !== -1) s.execTimes.splice(eIndex, 1);
                    }
                }
            }
            // Cleanup empty keys
            if (s.seen === 0) {
                delete this.session[entry.case];
            }
        }

        this.persist();
    }

    persist() {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem('pll_v2_session', JSON.stringify(this.session));
        localStorage.setItem('pll_v2_history', JSON.stringify(this.history));
    }

    resetSession() {
        this.session = {};
        this.persist();
    }
}

export const statsState = new StatsState();
