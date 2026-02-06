<script lang="ts">
  import { appState } from "../stores/appState.svelte";

  const colors = ["white", "yellow", "red", "orange", "green", "blue"];
</script>

<div class="settings-container">
  <h1>Settings</h1>

  <div class="setting-group">
    <h3>Cross Color</h3>
    <div class="color-options">
      {#each colors as color}
        <button
          class="color-btn"
          class:active={appState.settings.crossColors.includes(color as any)}
          style="background-color: {color === 'white' ? '#eee' : color}"
          onclick={() => {
            let current = [...appState.settings.crossColors];
            if (current.includes(color as any)) {
              if (current.length > 1) {
                current = current.filter((c) => c !== color);
              }
            } else {
              current.push(color as any);
            }
            appState.updateSettings({ crossColors: current });
          }}
          title={color}
        ></button>
      {/each}
    </div>
  </div>

  <div class="setting-group">
    <h3>Transition Speed (ms)</h3>
    <div class="range-control">
      <input
        type="range"
        min="0"
        max="2000"
        step="100"
        value={appState.settings.transitionDelay}
        oninput={(e) =>
          appState.updateSettings({
            transitionDelay: parseInt(e.currentTarget.value),
          })}
      />
      <span>{appState.settings.transitionDelay}ms</span>
    </div>
  </div>

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
    }}
  >
    Back
  </button>
</div>

<style>
  .settings-container {
    padding: 2rem;
    max-width: 600px;
    margin: 0 auto;
    text-align: left;
  }
  .setting-group {
    margin-bottom: 2rem;
  }
  h3 {
    color: #888;
    font-size: 0.9rem;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }

  .color-options {
    display: flex;
    gap: 1rem;
  }
  .color-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid transparent;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .color-btn.active {
    border-color: #3498db;
    transform: scale(1.1);
  }

  .range-control {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  input[type="range"] {
    flex-grow: 1;
  }

  .back-btn {
    margin-top: 2rem;
    padding: 0.8rem 1.5rem;
    background: #333;
    border: none;
    color: white;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
