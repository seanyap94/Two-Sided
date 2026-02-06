<script lang="ts">
  import { appState } from "../stores/appState.svelte";
</script>

<div class="menu-container">
  <h1>Select Training Mode</h1>

  <div class="modes-grid">
    <button
      class="mode-card primary"
      onclick={() => appState.setView("PLL_TRAINER")}
    >
      <h2>PLL Trainer</h2>
      <p>Permutation of Last Layer</p>
    </button>

    <button
      class="mode-card accent"
      onclick={() => appState.setView("PLL_TIME_ATTACK")}
    >
      <h2>PLL Time Attack</h2>
      <p>Speed-run all 21 PLLs</p>
    </button>

    <button class="mode-card" onclick={() => appState.setView("OLL_TRAINER")}>
      <h2>OLL Trainer</h2>
      <p>Orientation of Last Layer</p>
    </button>

    <button class="mode-card" onclick={() => appState.setView("F2L_TRAINER")}>
      <h2>F2L Trainer</h2>
      <p>First Two Layers</p>
    </button>

    <button
      class="mode-card accent"
      onclick={() => appState.setView("F2L_TIME_ATTACK")}
    >
      <h2>F2L Time Attack</h2>
      <p>Speed-run all F2L cases</p>
    </button>

    <button class="mode-card" onclick={() => appState.setView("LL_TRAINER")}>
      <h2>Full Last Layer</h2>
      <p>OLL + PLL Combined</p>
    </button>

    <button class="mode-card" onclick={() => appState.setView("LSLL_TRAINER")}>
      <h2>Last Slot + LL</h2>
      <p>F2L + OLL + PLL</p>
    </button>
    <button class="mode-card" onclick={() => appState.setView("ZBLL_TRAINER")}>
      <h2>ZBLL Trainer</h2>
      <p>Edges Oriented LL</p>
    </button>
    {#if import.meta.env.DEV}
      <button
        class="mode-card"
        style="border-color: #e74c3c;"
        onclick={() => appState.setView("VISUAL_TEST")}
      >
        <h2>Visual Test</h2>
        <p>Debug High-TPS Solve Detection</p>
      </button>
    {/if}
  </div>
</div>

<style>
  .menu-container {
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
  }
  .modes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }
  .mode-card {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 2rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .mode-card:hover {
    border-color: #3498db;
    transform: translateY(-2px);
    background: #202020;
  }
  h1 {
    font-size: 2rem;
    margin-bottom: 2rem;
  }
  h2 {
    font-size: 1.5rem;
    margin: 0;
    color: #eee;
  }
  p {
    color: #888;
    margin: 0;
  }
</style>
