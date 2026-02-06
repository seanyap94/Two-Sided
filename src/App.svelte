<script lang="ts">
  import { appState } from "./lib/stores/appState.svelte";
  import NavBar from "./lib/components/NavBar.svelte";
  import Menu from "./lib/components/Menu.svelte";
  import Trainer from "./lib/components/Trainer.svelte";
  import Settings from "./lib/components/Settings.svelte";
  import Stats from "./lib/components/Stats.svelte";
  import VisualTest from "./lib/components/VisualTest.svelte";

  // Placeholder components
  const Placeholder = (name: string) => ({
    render: () => {
      return `<div style="padding:20px;"><h2>${name}</h2><p>Coming Soon</p></div>`;
    },
  });
</script>

<NavBar />

<main>
  {#if appState.view === "MENU"}
    <Menu />
  {:else if ["PLL_TRAINER", "OLL_TRAINER", "F2L_TRAINER", "LL_TRAINER", "LSLL_TRAINER", "ZBLL_TRAINER", "PLL_TIME_ATTACK"].includes(appState.view)}
    <Trainer />
  {:else if appState.view === "SETTINGS"}
    <Settings />
  {:else if appState.view === "STATS"}
    <Stats />
  {:else if appState.view === "VISUAL_TEST"}
    <VisualTest />
  {:else}
    <div style="padding:2rem;">
      <h2>{appState.view}</h2>
      <p>Coming Soon</p>
      <button onclick={() => appState.setView("MENU")}>Back to Menu</button>
    </div>
  {/if}
</main>

<style>
  main {
    padding-top: 60px; /* Space for NavBar */
    height: calc(100vh - 60px);
    overflow: hidden;
  }
</style>
