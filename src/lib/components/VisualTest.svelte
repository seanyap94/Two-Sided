<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { appState } from "../stores/appState.svelte";
    import * as THREE from "three";
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
    import { CubieCube } from "$lib/bluetooth/core/mathlib";
    import { COLORS } from "$lib/data/algs";

    // H-Perm Expansion
    const M2_EXP = ["R'", "L", "R'", "L"];
    const U = ["U"];
    const U2 = ["U", "U"];
    const H_PERM = [
        ...M2_EXP,
        ...U,
        ...M2_EXP,
        ...U2,
        ...M2_EXP,
        ...U,
        ...M2_EXP,
    ];

    let testResults = $state<string[]>([]);
    let isRunning = $state(false);
    let currentMove = $state(0);
    let totalMoves = H_PERM.length * 2;
    let manualMove = $state("");

    // 3D Scene (Matching Trainer.svelte)
    let canvasContainer: HTMLDivElement;
    let scene: THREE.Scene;
    let camera: THREE.OrthographicCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;
    let cubeGroup: THREE.Group;
    let cubies: THREE.Mesh[] = [];
    let virtualCube: CubieCube;
    let animFrame: number;

    const MOVE_MAP: any = {
        U: { a: "y", v: 1, d: -1 },
        D: { a: "y", v: -1, d: 1 },
        R: { a: "x", v: 1, d: -1 },
        L: { a: "x", v: -1, d: 1 },
        F: { a: "z", v: 1, d: -1 },
        B: { a: "z", v: -1, d: 1 },
        M: { a: "x", v: 0, d: 1 },
    };

    function init3D() {
        if (!canvasContainer || renderer) return;

        scene = new THREE.Scene();
        const aspect =
            canvasContainer.clientWidth / canvasContainer.clientHeight;
        camera = new THREE.OrthographicCamera(
            -5 * aspect,
            5 * aspect,
            5,
            -5,
            1,
            1000,
        );
        camera.position.set(10, 7, 16);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(
            canvasContainer.clientWidth,
            canvasContainer.clientHeight,
        );
        renderer.setClearColor(0x121212);
        canvasContainer.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        initCubeMesh();
        loop();
    }

    function initCubeMesh() {
        if (cubeGroup) scene.remove(cubeGroup);
        cubeGroup = new THREE.Group();
        scene.add(cubeGroup);
        cubies = [];
        const geom = new THREE.BoxGeometry(0.92, 0.92, 0.92);

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const mats = Array(6)
                        .fill(null)
                        .map((_, i) => {
                            let color = 0x111111;
                            if (i === 0 && x === 1) color = COLORS.red;
                            if (i === 1 && x === -1) color = COLORS.orange;
                            if (i === 2 && y === 1) color = COLORS.white;
                            if (i === 3 && y === -1) color = COLORS.yellow;
                            if (i === 4 && z === 1) color = COLORS.green;
                            if (i === 5 && z === -1) color = COLORS.blue;
                            return new THREE.MeshBasicMaterial({ color });
                        });

                    const mesh = new THREE.Mesh(geom, mats);
                    mesh.position.set(x, y, z);
                    mesh.add(
                        new THREE.LineSegments(
                            new THREE.EdgesGeometry(geom),
                            new THREE.LineBasicMaterial({ color: 0x000000 }),
                        ),
                    );

                    cubeGroup.add(mesh);
                    cubies.push(mesh);
                }
            }
        }
        virtualCube = new CubieCube();
    }

    function applyMove(str: string) {
        if (!str) return;
        for (let t of str.split(/\s+/)) {
            if (!t) continue;
            let data = MOVE_MAP[t[0]];
            if (!data) continue;
            let d = t.includes("'") ? -data.d : data.d;

            const pivot = new THREE.Group();
            scene.add(pivot);

            const axis = data.a as "x" | "y" | "z";
            const moving = cubies.filter(
                (c) => Math.round(c.position[axis]) === data.v,
            );

            moving.forEach((c) => pivot.attach(c));
            const angle = (Math.PI / 2) * d * (t.includes("2") ? 2 : 1);
            (pivot.rotation as any)[axis] = angle;
            pivot.updateMatrixWorld();
            moving.forEach((c) => cubeGroup.attach(c));

            cubies.forEach((c) => {
                c.position.set(
                    Math.round(c.position.x),
                    Math.round(c.position.y),
                    Math.round(c.position.z),
                );
                c.rotation.set(
                    Math.round(c.rotation.x / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(c.rotation.y / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(c.rotation.z / (Math.PI / 2)) * (Math.PI / 2),
                );
                c.updateMatrixWorld();
            });

            scene.remove(pivot);
            virtualCube.selfMoveStr(t);
        }
    }

    function isVisualSolved(): boolean {
        if (!cubies.length) return false;

        const faces = [
            { axis: "x", coord: 1 },
            { axis: "x", coord: -1 },
            { axis: "y", coord: 1 },
            { axis: "y", coord: -1 },
            { axis: "z", coord: 1 },
            { axis: "z", coord: -1 },
        ];

        const localNormals = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1),
        ];

        const worldNormal = new THREE.Vector3();

        for (const face of faces) {
            const faceColors: number[] = [];

            for (const c of cubies) {
                const posVal = axisToCoord(c.position, face.axis);
                if (Math.round(posVal) === face.coord) {
                    const mats = c.material as THREE.MeshBasicMaterial[];
                    const targetDir = new THREE.Vector3();
                    (targetDir as any)[face.axis] = face.coord;

                    for (let i = 0; i < 6; i++) {
                        worldNormal
                            .copy(localNormals[i])
                            .applyQuaternion(c.quaternion);
                        if (worldNormal.dot(targetDir) > 0.9) {
                            faceColors.push(mats[i].color.getHex());
                        }
                    }
                }
            }

            if (faceColors.length !== 9) return false;
            if (!faceColors.every((c) => c === faceColors[0])) return false;
        }
        return true;
    }

    function axisToCoord(v: THREE.Vector3, axis: string): number {
        if (axis === "x") return v.x;
        if (axis === "y") return v.y;
        return v.z;
    }

    function loop() {
        animFrame = requestAnimationFrame(loop);
        if (controls) controls.update();
        renderer.render(scene, camera);
    }

    async function runTest() {
        if (isRunning) return;
        isRunning = true;
        testResults = ["🔄 Starting Trainer-Matched Visual Test...", ""];
        currentMove = 0;
        initCubeMesh();

        // Scramble
        testResults.push("STEP 1: Scrambling...");
        for (const move of H_PERM) {
            applyMove(move);
            currentMove++;
            await new Promise((r) => setTimeout(r, 10));
        }
        testResults.push(
            `Scrambled! Visual: ${isVisualSolved()}, Logic: ${virtualCube.isSolvedAny()}`,
        );
        testResults.push("");

        // Solve at high TPS
        testResults.push("STEP 2: Solving at 15 TPS...");
        await new Promise((r) => setTimeout(r, 500));

        const startTime = Date.now();
        for (let i = 0; i < H_PERM.length; i++) {
            const move = H_PERM[i];
            applyMove(move);
            currentMove++;
            testResults.push(
                `  [${i + 1}/${H_PERM.length}] ${move} → Visual: ${isVisualSolved()}, Logic: ${virtualCube.isSolvedAny()}`,
            );
            await new Promise((r) => setTimeout(r, 66));
        }

        const duration = (Date.now() - startTime) / 1000;
        testResults.push("", `⏱️ Completed in ${duration.toFixed(2)}s`);
        testResults.push(
            `FINAL Visual Solved: ${isVisualSolved() ? "✅" : "❌"}`,
        );
        testResults.push(
            `FINAL Logic Solved: ${virtualCube.isSolvedAny() ? "✅" : "❌"}`,
        );
        isRunning = false;
    }

    onMount(() => init3D());
    onDestroy(() => {
        if (animFrame) cancelAnimationFrame(animFrame);
        if (renderer) renderer.dispose();
    });

    function handleManualMove() {
        if (manualMove) {
            applyMove(manualMove);
            manualMove = "";
        }
    }
</script>

<div class="test-page">
    <div class="header">
        <h1>Solve Detection Test (Trainer Match)</h1>
        <button class="back-btn" onclick={() => appState.setView("MENU")}
            >Back to Menu</button
        >
    </div>

    <div class="content">
        <div class="left-panel">
            <div class="cube-container" bind:this={canvasContainer}></div>
            <div class="controls">
                <button class="run-btn" onclick={runTest} disabled={isRunning}>
                    {isRunning ? "Running..." : "Run H-Perm Test"}
                </button>
                <div class="manual">
                    <input
                        type="text"
                        bind:value={manualMove}
                        placeholder="Move (e.g. R')"
                        onkeydown={(e) =>
                            e.key === "Enter" && handleManualMove()}
                    />
                    <button onclick={handleManualMove}>Apply</button>
                </div>
            </div>
            {#if isRunning}
                <div class="progress">Move: {currentMove} / {totalMoves}</div>
            {/if}
        </div>

        <div class="results">
            <h2>Test Results</h2>
            <div class="log">
                {#each testResults as result}
                    <div class="log-line">{result}</div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .test-page {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
        color: #e0e0e0;
        font-family: sans-serif;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }
    .back-btn {
        background: #333;
        color: #fff;
        padding: 0.5rem 1rem;
        border: 1px solid #444;
        border-radius: 4px;
        cursor: pointer;
    }
    .content {
        display: grid;
        grid-template-columns: 400px 1fr;
        gap: 2rem;
    }
    .cube-container {
        width: 400px;
        height: 400px;
        background: #080808;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #333;
    }
    .controls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
    }
    .run-btn {
        padding: 1rem;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
    }
    .run-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
    }
    .manual {
        display: flex;
        gap: 0.5rem;
    }
    .manual input {
        flex: 1;
        padding: 0.5rem;
        background: #1a1a1a;
        border: 1px solid #444;
        color: white;
        border-radius: 4px;
    }
    .manual button {
        padding: 0.5rem 1rem;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .progress {
        margin-top: 0.5rem;
        color: #4caf50;
        font-weight: bold;
    }
    .results h2 {
        margin-top: 0;
    }
    .log {
        background: #050505;
        border: 1px solid #222;
        border-radius: 8px;
        padding: 1rem;
        font-family: monospace;
        font-size: 0.9rem;
        max-height: 600px;
        overflow-y: auto;
    }
    .log-line {
        margin-bottom: 0.2rem;
    }
</style>
