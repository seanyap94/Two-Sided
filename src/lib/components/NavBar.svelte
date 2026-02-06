<script lang="ts">
  import { appState } from "../stores/appState.svelte";
</script>

<nav>
  <div class="left">
    <button class="logo" onclick={() => appState.setView("MENU")}
      >Two Sided</button
    >
  </div>
  <div class="right">
    <button
      onclick={() => appState.setView("STATS")}
      class:active={appState.view === "STATS"}>Stats</button
    >
    <button
      onclick={() => appState.setView("SETTINGS")}
      class:active={appState.view === "SETTINGS"}>Settings</button
    >
  </div>
</nav>

<style>
  nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 60px;
    background: #151515;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    box-sizing: border-box;
    z-index: 100;
  }
  button {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.5rem 1rem;
    transition: color 0.2s;
  }
  button:hover {
    color: #eee;
  }
  button.logo {
    color: #3498db;
    font-weight: bold;
    font-size: 1.2rem;
  }
  button.active {
    color: #fff;
    font-weight: bold;
  }
</style>
