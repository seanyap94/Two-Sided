<script lang="ts">
    import { bluetoothState } from "$lib/bluetooth/store.svelte";
    import { connectNewCube, disconnectCube } from "$lib/bluetooth/actions";

    async function toggle() {
        if (bluetoothState.isConnected) {
            await disconnectCube();
        } else {
            await connectNewCube();
        }
    }
</script>

<button
    class="bt-btn"
    class:connected={bluetoothState.isConnected}
    onclick={toggle}
    disabled={bluetoothState.isConnecting}
>
    {#if bluetoothState.isConnecting}
        Connecting...
    {:else if bluetoothState.isConnected}
        Connected: {bluetoothState.deviceName || "Cube"} (Disconnect)
    {:else}
        Connect Cube
    {/if}
</button>

{#if bluetoothState.errorMessage}
    <p class="error">{bluetoothState.errorMessage}</p>
{/if}

<style>
    .bt-btn {
        padding: 0.8rem 1.5rem;
        border-radius: 8px;
        border: 1px solid #444;
        background: #222;
        color: #eee;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;
    }
    .bt-btn:hover:not(:disabled) {
        background: #333;
        border-color: #666;
    }
    .bt-btn.connected {
        background: rgba(52, 152, 219, 0.2);
        border-color: #3498db;
        color: #3498db;
    }
    .bt-btn:disabled {
        opacity: 0.5;
        cursor: wait;
    }
    .error {
        color: #e74c3c;
        font-size: 0.8rem;
        margin-top: 0.5rem;
    }
</style>
