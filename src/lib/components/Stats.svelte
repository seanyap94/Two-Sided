<script lang="ts">
  import { appState } from "../stores/appState.svelte";
  import { statsState } from "../stores/statsState.svelte";

  function calcAoX(
    times: number[],
    n: number,
    inspTimes?: number[],
    execTimes?: number[],
  ): string {
    if (!times || times.length < n) return "-";

    const getCountingMean = (arr: number[]) => {
      const subset = arr.slice(-n).sort((a, b) => a - b);
      const trim = Math.max(1, Math.floor(n * 0.05));
      const counting = subset.slice(trim, -trim);
      if (counting.length === 0) return 0;
      return counting.reduce((a, b) => a + b, 0) / counting.length;
    };

    const total = getCountingMean(times);
    if (total === 0) return "-";

    if (
      inspTimes &&
      execTimes &&
      inspTimes.length >= n &&
      execTimes.length >= n
    ) {
      const insp = getCountingMean(inspTimes);
      const exec = getCountingMean(execTimes);
      return `(${insp.toFixed(2)} / ${exec.toFixed(2)}) ${total.toFixed(2)}`;
    }

    return total.toFixed(2);
  }

  const milestones = [5, 12, 50, 100];

  let selectedMode = $state<
    | "PLL"
    | "OLL"
    | "F2L"
    | "LL"
    | "LSLL"
    | "ZBLL"
    | "PLL_TIME_ATTACK"
    | "F2L_TIME_ATTACK"
  >((appState.lastActiveTrainer?.replace("_TRAINER", "") as any) || "PLL");

  let sortCol = $state<"CASE" | "SEEN" | "CORRECT" | "MEAN" | "MOVES">("CASE");
  let sortDir = $state<1 | -1>(1);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 1 ? -1 : 1;
    } else {
      sortCol = col;
      sortDir = 1;
    }
  }

  function getMean(times: number[]): number {
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  function filterCase(key: string, entry?: { mode?: string }): boolean {
    // Use mode property if available (most reliable)
    if (entry && entry.mode === selectedMode) return true;

    // Fallback for session keys or old history without mode property
    if (selectedMode === "PLL") {
      return (
        key.startsWith("PLL_") ||
        (!key.startsWith("OLL_") &&
          !key.startsWith("F2L_") &&
          !key.includes("Random") &&
          key !== "LL" &&
          key !== "LSLL" &&
          key !== "PLL_TIME_ATTACK")
      );
    }
    if (selectedMode === "OLL") return key.startsWith("OLL_");
    if (selectedMode === "F2L") return key.startsWith("F2L_");
    if (selectedMode === "LL") return key === "LL" || key === "LL Random";
    if (selectedMode === "LSLL") return key === "LSLL" || key === "LSLL Random";
    if (selectedMode === "ZBLL") return key.startsWith("ZBLL_");
    if (selectedMode === "PLL_TIME_ATTACK") return key === "PLL_TIME_ATTACK";
    if (selectedMode === "F2L_TIME_ATTACK") return key === "F2L_TIME_ATTACK";
    return false;
  }

  let sessionKeys = $derived(
    Object.keys(statsState.session)
      .filter((k) => filterCase(k))
      .filter((k) => statsState.session[k].seen > 0)
      .sort((a, b) => {
        const sA = statsState.session[a];
        const sB = statsState.session[b];

        if (sortCol === "CASE") {
          return a.localeCompare(b) * sortDir;
        }
        if (sortCol === "SEEN") {
          return (sA.seen - sB.seen) * sortDir;
        }
        if (sortCol === "CORRECT") {
          return (sA.correct - sB.correct) * sortDir;
        }
        if (sortCol === "MEAN") {
          const meanA = getMean(sA.times);
          const meanB = getMean(sB.times);
          return (meanA - meanB) * sortDir;
        }
        if (sortCol === "MOVES") {
          const meanA = getMean(sA.moveCounts || []);
          const meanB = getMean(sB.moveCounts || []);
          return (meanA - meanB) * sortDir;
        }
        return 0;
      }),
  );

  let filteredHistory = $derived(
    statsState.history
      .filter((h) => filterCase(h.case, h))
      .slice()
      .reverse()
      .slice(0, 50),
  );
</script>

<div class="stats-container">
  <div class="header">
    <h1>Statistics</h1>
    <div class="controls">
      <select bind:value={selectedMode}>
        <option value="PLL">PLL</option>
        <option value="OLL">OLL</option>
        <option value="F2L">F2L</option>
        <option value="LL">Last Layer</option>
        <option value="LSLL">LSLL</option>
        <option value="ZBLL">ZBLL</option>
        <option value="PLL_TIME_ATTACK">PLL Time Attack</option>
        <option value="F2L_TIME_ATTACK">F2L Time Attack</option>
      </select>
      <button
        class="back-btn"
        onclick={() => {
          if (
            appState.previousView.endsWith("_TRAINER") ||
            appState.previousView === "PLL_TIME_ATTACK"
          ) {
            appState.setView(appState.previousView);
          } else {
            appState.setView("MENU");
          }
        }}>Back</button
      >
    </div>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="sortable" onclick={() => toggleSort("CASE")}
            >Case {sortCol === "CASE" ? (sortDir === 1 ? "↑" : "↓") : ""}</th
          >
          <th class="sortable" onclick={() => toggleSort("SEEN")}
            >Seen {sortCol === "SEEN" ? (sortDir === 1 ? "↑" : "↓") : ""}</th
          >
          <th class="sortable" onclick={() => toggleSort("CORRECT")}
            >Correct {sortCol === "CORRECT"
              ? sortDir === 1
                ? "↑"
                : "↓"
              : ""}</th
          >
          <th class="sortable" onclick={() => toggleSort("MEAN")}
            >Mean (Insp/Exec) {sortCol === "MEAN"
              ? sortDir === 1
                ? "↑"
                : "↓"
              : ""}</th
          >
          <th class="sortable" onclick={() => toggleSort("MOVES")}
            >Avg Moves {sortCol === "MOVES"
              ? sortDir === 1
                ? "↑"
                : "↓"
              : ""}</th
          >
          {#each milestones as m}
            <th>Ao{m}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if sessionKeys.length === 0}
          <tr
            ><td colspan={4 + milestones.length}>No stats for {selectedMode}</td
            ></tr
          >
        {/if}
        {#each sessionKeys as k}
          {@const s = statsState.session[k]}
          {@const meanTotal = getMean(s.times)}
          {@const meanInsp = getMean(s.inspTimes || [])}
          {@const meanExec = getMean(s.execTimes || [])}
          <tr>
            <td class="case-name"
              >{k
                .replace("PLL_", "")
                .replace("OLL_", "")
                .replace("F2L_", "")}</td
            >
            <td>{s.seen}</td>
            <td>{s.correct}</td>
            <td class="highlight">
              {#if s.times.length > 0}
                <small style="color: #666"
                  >({meanInsp.toFixed(2)} / {meanExec.toFixed(2)})</small
                >
                {meanTotal.toFixed(2)}
              {:else}
                -
              {/if}
            </td>
            <td>
              {#if (s.moveCounts?.length || 0) > 0}
                {getMean(s.moveCounts || []).toFixed(1)}
              {:else}
                -
              {/if}
            </td>
            {#each milestones as m}
              <td>
                {#if s.times.length >= m}
                  {@const val = calcAoX(s.times, m, s.inspTimes, s.execTimes)}
                  {#if val.includes("(")}
                    {@const parts = val.split(" ")}
                    <small style="color: #666"
                      >{parts[0]} {parts[1]} {parts[2]}</small
                    >
                    {parts[3]}
                  {:else}
                    {val}
                  {/if}
                {:else}
                  -
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="history-list">
    <h3>Recent History ({selectedMode})</h3>
    <ul>
      {#each filteredHistory as h}
        <li class:fail={h.result === "FAIL"}>
          <span class="mode-badge">{h.mode || "-"}</span>
          <span class="date">{new Date(h.date).toLocaleTimeString()}</span>
          <span class="case"
            >{h.case
              .replace("PLL_", "")
              .replace("OLL_", "")
              .replace("F2L_", "")}</span
          >
          <span class="time">
            <small style="color: #666; font-size: 0.7rem">
              ({(h.inspectionTime || 0).toFixed(2)} / {(
                h.executionTime || 0
              ).toFixed(2)})
            </small>
            {h.time.toFixed(2)}s
            {#if h.moveCount}
              <small style="color: #888; margin-left: 0.5rem"
                >{h.moveCount}mv</small
              >
            {/if}
          </span>
          <span class="res">{h.result}</span>
          <button
            class="del-btn"
            onclick={() => statsState.deleteEntry(h.date)}
            aria-label="Delete">×</button
          >
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .stats-container {
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
    color: #eee;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 60px); /* Fill remaining space exactly */
    overflow: hidden; /* Prevent container scroll, force inner scroll */
    gap: 2rem;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  select {
    padding: 0.5rem;
    border-radius: 6px;
    background: #333;
    color: white;
    border: 1px solid #555;
    font-size: 1rem;
  }
  .back-btn {
    padding: 0.8rem 1.5rem;
    background: #333;
    border: none;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
  }

  .table-wrapper {
    overflow-x: auto;
    background: #181818;
    padding: 1rem;
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 600px;
  }
  th,
  td {
    padding: 0.75rem;
    text-align: center;
    border-bottom: 1px solid #333;
  }
  th {
    color: #888;
    font-weight: normal;
    text-transform: uppercase;
    font-size: 0.8rem;
  }
  th.sortable {
    cursor: pointer;
    user-select: none;
  }
  th.sortable:hover {
    color: #fff;
    background: #222;
  }
  .case-name {
    font-weight: bold;
    color: #3498db;
  }
  .highlight {
    color: #f1c40f;
  }

  .history-list {
    flex-grow: 1;
    overflow-y: auto;
    background: #181818;
    padding: 1rem;
    border-radius: 8px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #222;
    font-family: monospace;
  }
  li.fail {
    color: #e74c3c;
  }
  .mode-badge {
    font-size: 0.7rem;
    background: #333;
    padding: 2px 4px;
    border-radius: 4px;
    color: #aaa;
    width: 40px;
    text-align: center;
  }
  .date {
    color: #666;
    font-size: 0.8rem;
  }
  .case {
    width: 50px;
    font-weight: bold;
    text-align: center;
  }
  .time {
    width: 140px;
    text-align: right;
  }
  .res {
    width: 60px;
    text-align: center;
  }
  .del-btn {
    background: none;
    border: none;
    color: #666;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0 0.5rem;
    line-height: 1;
  }
  .del-btn:hover {
    color: #e74c3c;
  }
</style>
