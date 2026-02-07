<script lang="ts">
    import { onMount, onDestroy, untrack } from "svelte";
    import { appState } from "../stores/appState.svelte";
    import { bluetoothState } from "$lib/bluetooth/store.svelte";
    import { CubieCube } from "$lib/bluetooth/core/mathlib";
    import { statsState } from "../stores/statsState.svelte";
    import {
        PLL_ALGS,
        OLL_ALGS,
        F2L_ALGS,
        COLORS,
        OPPOSITES,
        ORIENT_TO_TOP,
    } from "$lib/data/algs";
    import { getScramble, getRandomAuf, invert } from "$lib/logic/scramble";
    import BluetoothConnect from "./BluetoothConnect.svelte";
    import * as THREE from "three";
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

    // 3D Variables
    let canvasContainer = $state<HTMLElement>();
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;
    let cubeGroup: THREE.Group;
    let cubies: THREE.Mesh[] = [];
    let animFrame: number;

    // Game Logic State
    let mode = $state<"MANUAL" | "BLUETOOTH">(
        import.meta.env.DEV ? "MANUAL" : "BLUETOOTH",
    );
    // Trainer Mode: PLL, OLL, F2L, LL, LSLL
    // Derived from appState.view usually, but we can pass it in or read it.
    let trainerMode = $derived(appState.view.replace("_TRAINER", "")); // 'PLL', 'OLL', etc.
    let currentCrossColor = $state<
        "white" | "yellow" | "red" | "orange" | "green" | "blue"
    >("white");

    let status = $state("PRESS SPACE OR TAP CUBE");
    let timerDisplay = $state("0.00");
    let roundStartTime = 0;
    let firstMoveTime = $state(0);
    let buffer = $state("");
    let currentCase = $state("");
    let lastResult = $state<"CORRECT" | "FAIL" | null>(null);
    let cycleMode = $state(false); // Free Play / Cycle
    let currentMoveCount = 0;

    // Timer State
    let startTime = 0;
    let timerInt: any = null;
    let isWaiting = $state(true);
    let isPaused = $state(false);
    let isInitializing = false; // Guard for async startRound
    let isReady = $state(false);

    // Bluetooth Logic
    let btState = $state<"INSPECTION" | "SOLVING">("INSPECTION");
    let virtualCube: CubieCube;
    let solvedStates: CubieCube[] = []; // for PLL checking

    // Time Attack State
    let timeAttackSequence = $state<string[]>([]);
    let timeAttackIndex = $state(0);
    let totalTime = $state(0);
    let timeAttackStarted = $state(false);
    let f2lAttackResults = $state<
        { case: string; time: number; moveCount: number }[]
    >([]);

    // --- 3D & Logic ---

    const MOVE_MAP: any = {
        U: { a: "y", v: 1, d: -1 },
        D: { a: "y", v: -1, d: 1 },
        R: { a: "x", v: 1, d: -1 },
        L: { a: "x", v: -1, d: 1 },
        F: { a: "z", v: 1, d: -1 },
        B: { a: "z", v: -1, d: 1 },
        u: { a: "y", v: [0, 1], d: -1 },
        d: { a: "y", v: [0, -1], d: 1 },
        r: { a: "x", v: [0, 1], d: -1 },
        l: { a: "x", v: [0, -1], d: 1 },
        f: { a: "z", v: [0, 1], d: -1 },
        b: { a: "z", v: [0, -1], d: 1 },
        M: { a: "x", v: 0, d: 1 },
        x: { a: "x", v: "all", d: -1 },
        y: { a: "y", v: "all", d: -1 },
        z: { a: "z", v: "all", d: -1 },
    };

    function init3D() {
        if (!canvasContainer || renderer) return;

        scene = new THREE.Scene();
        const aspect =
            canvasContainer.clientWidth / canvasContainer.clientHeight;
        camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
        camera.position.set(7, 5.5, 11);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(
            canvasContainer.clientWidth,
            canvasContainer.clientHeight,
        );
        canvasContainer.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        initCubeMesh();
        loop();

        window.addEventListener("resize", onResize);
    }

    function onResize() {
        if (!canvasContainer || !camera) return;
        const aspect =
            canvasContainer.clientWidth / canvasContainer.clientHeight;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(
            canvasContainer.clientWidth,
            canvasContainer.clientHeight,
        );
    }

    let f2lSolvedLatch = $state(false);

    // Determines current masking mode
    function getMaskMode(): "NONE" | "GRAY" | "DIM" {
        if (trainerMode === "F2L" || trainerMode === "F2L_TIME_ATTACK")
            return "GRAY";
        if (["LSLL", "LL"].includes(trainerMode)) {
            // LL might also want this? Usually LL is usually full view. User said "For Last Slot Last Layer..."
            // Let's stick to LSLL for now as requested.
            if (trainerMode === "LSLL" && !f2lSolvedLatch) return "DIM";
        }
        return "NONE";
    }

    // Helper to get materials based on mask
    function getMaterialsForCubie(
        originalColors: number[],
        mask: "NONE" | "GRAY" | "DIM",
        llColor: number,
    ) {
        // Identify if this is a Last Layer piece.
        // A piece is "LL" if it has the LL color (Opposite of Cross) on any face.
        const isLLPiece = originalColors.includes(llColor);

        return originalColors.map((c) => {
            const mat = new THREE.MeshBasicMaterial({ color: 0x111111 }); // base black
            // If it's a valid face color (not null/black placeholder)
            if (c !== 0x111111) {
                if (isLLPiece && mask !== "NONE") {
                    if (mask === "GRAY") {
                        mat.color.setHex(0x333333); // Grayed out
                    } else if (mask === "DIM") {
                        mat.color.setHex(c);
                        mat.color.multiplyScalar(0.25); // Dimmed
                    }
                } else {
                    mat.color.setHex(c);
                }
            }
            return mat;
        });
    }

    function initCubeMesh() {
        if (cubeGroup) scene.remove(cubeGroup);
        cubeGroup = new THREE.Group();
        scene.add(cubeGroup);
        cubies = [];
        const geom = new THREE.BoxGeometry(0.92, 0.92, 0.92);

        const cross = currentCrossColor;
        const llColor = COLORS[OPPOSITES[cross] as keyof typeof COLORS];
        const mask = getMaskMode();

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    // Determine Original Colors
                    const cols = Array(6).fill(0x111111);
                    if (x === 1) cols[0] = COLORS.red;
                    if (x === -1) cols[1] = COLORS.orange;
                    if (y === 1) cols[2] = COLORS.white;
                    if (y === -1) cols[3] = COLORS.yellow;
                    if (z === 1) cols[4] = COLORS.green;
                    if (z === -1) cols[5] = COLORS.blue;

                    const mats = getMaterialsForCubie(cols, mask, llColor);
                    const mesh = new THREE.Mesh(geom, mats);
                    mesh.position.set(x, y, z);
                    mesh.userData = { originalColors: cols }; // Store for dynamic updates

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
    }

    function updatePieceMaterials() {
        if (!cubies.length) return;
        const cross = currentCrossColor;
        const llColor = COLORS[OPPOSITES[cross] as keyof typeof COLORS];
        const mask = getMaskMode();

        cubies.forEach((c) => {
            const cols = c.userData.originalColors;
            // Dispose old materials? (ThreeJS memory mgmt)
            // Ideally we reuse or dispose. For now, simple replace.
            if (Array.isArray(c.material))
                c.material.forEach((m: any) => m.dispose());
            c.material = getMaterialsForCubie(cols, mask, llColor);
        });
    }

    const _wp = new THREE.Vector3();
    const _wn = new THREE.Vector3();

    function applyAlgo(str: string) {
        if (!str) return;
        for (let t of str.split(/\s+/)) {
            if (!t) continue;
            let data = MOVE_MAP[t[0]];
            if (!data) continue;
            let d = t.includes("'") ? -data.d : data.d;

            const pivot = new THREE.Group();
            if (scene) scene.add(pivot);

            const axis = data.a as "x" | "y" | "z";
            const moving = cubies.filter((c) => {
                const coord = Math.round(c.position[axis]);
                if (data.v === "all") return true;
                if (Array.isArray(data.v)) return data.v.includes(coord);
                return coord === data.v;
            });

            moving.forEach((c) => pivot.attach(c));
            const angle = (Math.PI / 2) * d * (t.includes("2") ? 2 : 1);
            (pivot.rotation as any)[axis] = angle;
            pivot.updateMatrixWorld();
            moving.forEach((c) => cubeGroup.attach(c));

            // Round positions AND rotations to prevent drift
            cubies.forEach((c) => {
                c.position.set(
                    Math.round(c.position.x),
                    Math.round(c.position.y),
                    Math.round(c.position.z),
                );
                // Round rotation to nearest PI/2
                c.rotation.set(
                    Math.round(c.rotation.x / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(c.rotation.y / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(c.rotation.z / (Math.PI / 2)) * (Math.PI / 2),
                );
                c.updateMatrixWorld();
            });

            if (scene) scene.remove(pivot);
        }
    }

    function loop() {
        animFrame = requestAnimationFrame(loop);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    // --- Game Flow ---

    async function startRound() {
        if (isInitializing) return;
        isInitializing = true;

        console.log(`[Trainer] startRound. isReady=${isReady}`);

        // Reset state
        isWaiting = false;
        f2lSolvedLatch = false;
        buffer = "";
        lastResult = null;
        firstMoveTime = 0;
        btState = "INSPECTION";

        // 1. Initial Solved State (If Not Ready)
        if (!isReady) {
            console.log("[Trainer] Showing solved state, waiting for user...");
            const colors = appState.settings.crossColors;
            currentCrossColor = colors[0] || "white"; // Default to first for preview
            initCubeMesh();
            status = "READY? Click or Press Space";
            isInitializing = false;
            return;
        }

        // 2. Normal Scramble Logic
        const colors = appState.settings.crossColors;
        currentCrossColor = colors[Math.floor(Math.random() * colors.length)];
        f2lSolvedLatch = false; // Reset Latch BEFORE init
        initCubeMesh();
        status = "SCRAMBLING...";
        if (timerInt && !timeAttackStarted) clearInterval(timerInt);
        isPaused = false;
        isWaiting = false;
        lastResult = null;
        buffer = "";
        if (trainerMode !== "PLL") {
            mode = "BLUETOOTH";
        }
        // Only clear timer if we are NOT in the middle of a continuous Time Attack run
        status = cycleMode ? "FREE PLAY - Solving..." : "SOLVING...";
        firstMoveTime = 0; // Reset split
        currentMoveCount = 0;

        // Start timer immediately for inspection
        roundStartTime = Date.now();
        if (!timeAttackStarted) {
            startTime = roundStartTime;
            if (timerInt) clearInterval(timerInt);
            timerInt = setInterval(() => {
                timerDisplay = ((Date.now() - startTime) / 1000).toFixed(2);
            }, 10);
        }

        // Scramble Generation
        console.log(`[StartRound] mode=${mode}, trainerMode=${trainerMode}`);
        let result;
        if (trainerMode.endsWith("TIME_ATTACK")) {
            if (!timeAttackStarted) {
                // Initialize sequence
                if (trainerMode === "PLL_TIME_ATTACK") {
                    const savedOrder = appState.settings.timeAttackOrder;
                    if (savedOrder && savedOrder.length === 21) {
                        timeAttackSequence = [...savedOrder];
                    } else {
                        timeAttackSequence = Object.keys(PLL_ALGS).sort();
                    }
                } else if (trainerMode === "F2L_TIME_ATTACK") {
                    timeAttackSequence = Object.keys(F2L_ALGS).sort();
                    f2lAttackResults = [];
                }

                timeAttackIndex = 0;
                totalTime = 0;
                timeAttackStarted = true;
                startTime = Date.now();
                console.log("[Time Attack] Set started, timer initialized.");
                if (timerInt) clearInterval(timerInt);
                timerInt = setInterval(() => {
                    timerDisplay = ((Date.now() - startTime) / 1000).toFixed(2);
                }, 10);
            }
            const caseName = timeAttackSequence[timeAttackIndex];

            // Generate Scramble
            if (trainerMode === "PLL_TIME_ATTACK") {
                const prefs = appState.settings.pllPreferences[caseName] || {
                    pre: "",
                    post: "",
                };
                const baseAlg = PLL_ALGS[caseName];
                result = {
                    caseName,
                    scramble:
                        `${prefs.post} ${invert(baseAlg)} ${prefs.pre}`.trim(),
                };
            } else {
                // F2L Time Attack
                const baseAlg = F2L_ALGS[caseName];
                result = {
                    caseName,
                    scramble: invert(baseAlg),
                };
            }
        } else {
            const tm = trainerMode as any;
            result = getScramble(tm);
        }
        currentCase = result.caseName;
        const scramble = result.scramble;

        // Orientation
        // Orientation and Scramble Strings
        const cross = currentCrossColor;
        const orientStr = ORIENT_TO_TOP[OPPOSITES[cross]];

        let scrambleStr = scramble;
        if (trainerMode !== "PLL_TIME_ATTACK") {
            const preAuf = getRandomAuf();
            const postAuf = getRandomAuf();
            scrambleStr = `${preAuf} ${scramble} ${postAuf}`.trim();
        }

        let yRotCount = 0;
        if (
            trainerMode !== "F2L" &&
            trainerMode !== "LSLL" &&
            trainerMode !== "PLL_TIME_ATTACK"
        ) {
            yRotCount = Math.floor(Math.random() * 4);
        }

        // Apply to 3D View
        applyAlgo(orientStr);
        applyAlgo(scrambleStr);
        for (let i = 0; i < yRotCount; i++) applyAlgo("y");

        // Initialize Logic
        if (mode === "BLUETOOTH") {
            // 1. Establish orientation of the "Solved" base
            const base = new CubieCube(); // Default White-Top
            for (const m of orientStr.split(/\s+/)) if (m) base.selfMoveStr(m);
            for (let i = 0; i < yRotCount; i++) base.selfMoveStr("y");

            // 2. Derive the 4 possible solved AUF states at this orientation
            solvedStates = [];
            const temp = new CubieCube().init(base.ca, base.ea);
            for (let i = 0; i < 4; i++) {
                solvedStates.push(new CubieCube().init(temp.ca, temp.ea));
                temp.selfMoveStr("U");
            }

            // 3. Initialize virtualCube at this orientation and apply scramble
            virtualCube = new CubieCube().copy(base);
            console.log(`[StartRound] Applying scramble: ${scrambleStr}`);
            for (const m of scrambleStr.split(/\s+/))
                if (m) virtualCube.selfMoveStr(m);

            console.log(
                `[StartRound] VirtualCube initialized. Solved? ${virtualCube.isSolvedAny()}`,
            );

            btState = "INSPECTION";
            if (!cycleMode) status = "INSPECTION";
            // ... existing code ...
        } else {
            if (!cycleMode) {
                startTime = Date.now();
                if (timerInt) clearInterval(timerInt);
                timerInt = setInterval(() => {
                    timerDisplay = ((Date.now() - startTime) / 1000).toFixed(2);
                }, 10);
            } else {
                timerDisplay = "0.00";
            }
        }
        isInitializing = false;
    }

    function submitKeyboard(guess: string) {
        if (isWaiting) return;

        // If cycle mode, we don't validate correctness of button presses, we just cycle?
        // OR we just assume if they clicked it, they think it's right.

        // For LL/LSLL, we don't have a "guess" string usually, just "Solved".
        // But in Manual Mode, user might want to click "I'm done" or spacebar.
        // If "LL" or "LSLL", there are no specific buttons, just a "Next" or "Solved" action.

        // If trainerMode is PLL/OLL/F2L, we validate.
        const isStandard = ["PLL", "OLL", "F2L"].includes(trainerMode);

        if (isStandard && !cycleMode) {
            const elapsed = (Date.now() - startTime) / 1000;
            if (guess === currentCase) {
                status = "CORRECT!";
                lastResult = "CORRECT";
                statsState.addResult(
                    currentCase,
                    elapsed,
                    "CORRECT",
                    trainerMode,
                );
                handleSuccess(elapsed);
            } else {
                status = `FAIL: ${currentCase}`;
                lastResult = "FAIL";
                statsState.addResult(currentCase, elapsed, "FAIL", trainerMode);
                isWaiting = true;
                clearInterval(timerInt);
            }
        } else {
            // Cycle mode or LL/LSLL manual 'done'
            startRound();
        }
    }

    function handleSuccess(time: number) {
        status = `CORRECT! Time: ${time.toFixed(2)}`;
        isWaiting = true;
        if (timerInt) clearInterval(timerInt);
        setTimeout(() => {
            if (isWaiting && !isPaused) startRound();
        }, appState.settings.transitionDelay);
    }

    function handleManualClick(alg: string) {
        if (mode !== "MANUAL" || isWaiting) return;
        buffer = alg;
        submitKeyboard(alg);
    }

    function triggerRoundSuccess() {
        if (isWaiting) return;
        const now = Date.now();
        const totalElapsed = (now - startTime) / 1000;

        if (trainerMode.endsWith("TIME_ATTACK")) {
            isWaiting = true; // Lock for transition

            // Store F2L Result (Split)
            if (trainerMode === "F2L_TIME_ATTACK") {
                const splitTime = (now - roundStartTime) / 1000;
                f2lAttackResults.push({
                    case: timeAttackSequence[timeAttackIndex],
                    time: splitTime,
                    moveCount: currentMoveCount,
                });
            }

            timeAttackIndex++;
            if (timeAttackIndex < timeAttackSequence.length) {
                status = `Case ${timeAttackIndex}/${timeAttackSequence.length} Solved! Next Up...`;
                startRound();
            } else {
                if (timerInt) clearInterval(timerInt);
                status = `COMPLETE! Total Time: ${totalElapsed.toFixed(2)}s`;
                timerDisplay = totalElapsed.toFixed(2);

                // Finalize Stats
                if (trainerMode === "PLL_TIME_ATTACK") {
                    statsState.addResult(
                        "PLL_TIME_ATTACK",
                        totalElapsed,
                        "CORRECT",
                        "PLL_TIME_ATTACK",
                    );
                } else if (trainerMode === "F2L_TIME_ATTACK") {
                    const totalMoves = f2lAttackResults.reduce(
                        (acc, r) => acc + r.moveCount,
                        0,
                    );
                    const avgMoves =
                        totalMoves / (f2lAttackResults.length || 1);
                    status = `COMPLETE! Avg Moves: ${avgMoves.toFixed(2)}. Check Console.`;
                    console.table(f2lAttackResults);
                }

                timeAttackStarted = false;
                isWaiting = true;
            }
        } else if (!cycleMode) {
            let inspection = 0;
            let execution = totalElapsed;

            if (firstMoveTime) {
                inspection = (firstMoveTime - startTime) / 1000;
                execution = (now - firstMoveTime) / 1000;
            }

            const statKey = ["LL", "LSLL"].includes(trainerMode)
                ? trainerMode
                : currentCase;
            statsState.addResult(
                statKey,
                totalElapsed,
                "CORRECT",
                trainerMode,
                inspection,
                execution,
                currentMoveCount,
            );
            handleSuccess(totalElapsed);
        } else {
            status = "SOLVED!";
            setTimeout(startRound, 500);
        }
    }

    function skip() {
        startRound();
    }

    // Input Handling
    function onKeyDown(e: KeyboardEvent) {
        if (!appState.isSolving) return;

        // Handle space key
        if (e.key === " ") {
            e.preventDefault();

            // If not ready yet, confirm ready
            if (!isReady) {
                isReady = true;
                startRound();
                return;
            }

            // Otherwise, use skip functionality
            skip();
            return;
        }

        if (mode === "MANUAL") {
            submitKeyboard(e.key);
        }
    }

    function onCanvasClick() {
        if (!isReady && appState.isSolving) {
            isReady = true;
            startRound();
        }
    }

    /**
     * Checks if the 3D cube model is "visually" solved by examining the colors on its 6 faces.
     * This is the most intuitive "What You See Is What You Get" solve detection.
     */
    interface CubieCache {
        c: THREE.Mesh;
        wp: THREE.Vector3;
        q: THREE.Quaternion;
    }

    function getCubieCache(): CubieCache[] {
        // Force scene matrix update to ensure getWorldPosition is accurate
        if (scene) scene.updateMatrixWorld(true);
        return cubies.map((c) => {
            const wp = new THREE.Vector3();
            c.getWorldPosition(wp);
            return { c, wp, q: c.quaternion.clone() };
        });
    }

    function isVisualSolved(cache?: CubieCache[]): boolean {
        if (!cubies.length) return false;
        const cubieData = cache || getCubieCache();

        const localNormals = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1),
        ];

        const faceDefinitions = [
            { axis: "x", coord: 1 },
            { axis: "x", coord: -1 },
            { axis: "y", coord: 1 },
            { axis: "y", coord: -1 },
            { axis: "z", coord: 1 },
            { axis: "z", coord: -1 },
        ];

        const worldNormal = new THREE.Vector3();

        for (const face of faceDefinitions) {
            const faceNormal = new THREE.Vector3();
            (faceNormal as any)[face.axis] = face.coord;

            const centerCubie = cubieData.find((d) => {
                return (
                    Math.round(d.wp.x) ===
                        (face.axis === "x" ? face.coord : 0) &&
                    Math.round(d.wp.y) ===
                        (face.axis === "y" ? face.coord : 0) &&
                    Math.round(d.wp.z) === (face.axis === "z" ? face.coord : 0)
                );
            });
            if (!centerCubie) return false;
            // 2. Get target color
            let goalColor = -1;
            // Use userData.originalColors to bypass masking (DIM/GRAY)
            const centerOriginals = centerCubie.c.userData.originalColors;

            for (let i = 0; i < 6; i++) {
                worldNormal
                    .copy(localNormals[i])
                    .applyQuaternion(centerCubie.q);
                if (worldNormal.dot(faceNormal) > 0.9) {
                    goalColor = centerOriginals[i];
                    break;
                }
            }
            if (goalColor === -1) return false;

            // 3. Match 9 pieces
            const faceCubies = cubieData.filter((d) => {
                return (
                    Math.round(d.wp[face.axis as "x" | "y" | "z"]) ===
                    face.coord
                );
            });
            if (faceCubies.length !== 9) return false;

            for (const d of faceCubies) {
                const originals = d.c.userData.originalColors;
                let pieceColor = -1;
                for (let i = 0; i < 6; i++) {
                    worldNormal.copy(localNormals[i]).applyQuaternion(d.q);
                    if (worldNormal.dot(faceNormal) > 0.9) {
                        pieceColor = originals[i];
                        break;
                    }
                }
                if (pieceColor !== goalColor) return false;
            }
        }
        return true;
    }

    /**
     * Checks if the F2L (First Two Layers) is visually solved.
     * Requires the bottom face to be monochromatic and the bottom two rows of side faces to match their centers.
     */
    function isVisualF2LSolved(cache?: CubieCache[]): boolean {
        if (!cubies.length) return false;
        const cubieData = cache || getCubieCache();

        const crossColor = currentCrossColor;
        const faceDefinitions = [
            { name: "U", axis: "y", coord: 1 },
            { name: "D", axis: "y", coord: -1 },
            { name: "L", axis: "x", coord: -1 },
            { name: "R", axis: "x", coord: 1 },
            { name: "F", axis: "z", coord: 1 },
            { name: "B", axis: "z", coord: -1 },
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

        // 1. Identify which one is the "Bottom" face by its center piece color.
        let bottomAxis = "";
        let bottomCoord = 0;

        for (const face of faceDefinitions) {
            const centerCubie = cubieData.find((d) => {
                return (
                    Math.round(d.wp.x) ===
                        (face.axis === "x" ? face.coord : 0) &&
                    Math.round(d.wp.y) ===
                        (face.axis === "y" ? face.coord : 0) &&
                    Math.round(d.wp.z) === (face.axis === "z" ? face.coord : 0)
                );
            });
            if (!centerCubie) continue;

            const mats = centerCubie.c.material as THREE.MeshBasicMaterial[];
            const fn = new THREE.Vector3();
            (fn as any)[face.axis] = face.coord;

            for (let i = 0; i < 6; i++) {
                worldNormal
                    .copy(localNormals[i])
                    .applyQuaternion(centerCubie.q);
                if (worldNormal.dot(fn) > 0.9) {
                    const col = mats[i].color.getHex();
                    if (col === COLORS[crossColor as keyof typeof COLORS]) {
                        bottomAxis = face.axis;
                        bottomCoord = face.coord;
                    }
                }
            }
        }

        if (!bottomAxis) return false;

        // 2. Check Bottom Face Monochromaticity
        const bottomCubies = cubieData.filter((d) => {
            return (
                Math.round(d.wp[bottomAxis as "x" | "y" | "z"]) === bottomCoord
            );
        });
        const bottomColor = COLORS[crossColor as keyof typeof COLORS];
        for (const d of bottomCubies) {
            const mats = d.c.material as THREE.MeshBasicMaterial[];
            const fn = new THREE.Vector3();
            (fn as any)[bottomAxis] = bottomCoord;
            let found = false;
            for (let i = 0; i < 6; i++) {
                worldNormal.copy(localNormals[i]).applyQuaternion(d.q);
                if (worldNormal.dot(fn) > 0.9) {
                    if (mats[i].color.getHex() !== bottomColor) return false;
                    found = true;
                }
            }
            if (!found) return false;
        }

        // 3. Check Side Faces (Bottom 2 layers)
        const sideFaces = faceDefinitions.filter((f) => f.axis !== bottomAxis);
        for (const face of sideFaces) {
            const faceCubies = cubieData.filter((d) => {
                return (
                    Math.round(d.wp[face.axis as "x" | "y" | "z"]) ===
                    face.coord
                );
            });

            const centerCubie = faceCubies.find((d) => {
                const otherAxes = ["x", "y", "z"].filter(
                    (a) => a !== face.axis,
                );
                return (
                    Math.round(d.wp[otherAxes[0] as "x" | "y" | "z"]) === 0 &&
                    Math.round(d.wp[otherAxes[1] as "x" | "y" | "z"]) === 0
                );
            });
            if (!centerCubie) return false;
            const mats = centerCubie.c.material as THREE.MeshBasicMaterial[];
            const fn = new THREE.Vector3();
            (fn as any)[face.axis] = face.coord;
            let centerColor = 0;
            for (let i = 0; i < 6; i++) {
                worldNormal
                    .copy(localNormals[i])
                    .applyQuaternion(centerCubie.q);
                if (worldNormal.dot(fn) > 0.9) {
                    centerColor = mats[i].color.getHex();
                }
            }

            for (const d of faceCubies) {
                if (
                    Math.round(d.wp[bottomAxis as "x" | "y" | "z"]) ===
                    -bottomCoord
                )
                    continue;
                const mats = d.c.material as THREE.MeshBasicMaterial[];
                let found = false;
                for (let i = 0; i < 6; i++) {
                    worldNormal.copy(localNormals[i]).applyQuaternion(d.q);
                    if (worldNormal.dot(fn) > 0.9) {
                        if (mats[i].color.getHex() !== centerColor)
                            return false;
                        found = true;
                    }
                }
                if (!found) return false;
            }
        }

        return true;
    }

    /**
     * Checks if OLL (Orientation of Last Layer) is visually solved.
     * Requires F2L to be solved and the top face to be monochromatic.
     */
    function isVisualOLLSolved(cache?: CubieCache[]): boolean {
        const cubieData = cache || getCubieCache();
        if (!isVisualF2LSolved(cubieData)) return false;

        const crossColor = currentCrossColor;
        const llColor = COLORS[OPPOSITES[crossColor] as keyof typeof COLORS];
        const worldNormal = new THREE.Vector3();
        const localNormals = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1),
        ];

        // Bottom face detection again (to find Top)
        const faceDefinitions = [
            { axis: "x", coord: 1 },
            { axis: "x", coord: -1 },
            { axis: "y", coord: 1 },
            { axis: "y", coord: -1 },
            { axis: "z", coord: 1 },
            { axis: "z", coord: -1 },
        ];

        let bottomAxis = "";
        let bottomCoord = 0;
        for (const face of faceDefinitions) {
            const centerCubie = cubieData.find((d) => {
                return (
                    Math.round(d.wp.x) ===
                        (face.axis === "x" ? face.coord : 0) &&
                    Math.round(d.wp.y) ===
                        (face.axis === "y" ? face.coord : 0) &&
                    Math.round(d.wp.z) === (face.axis === "z" ? face.coord : 0)
                );
            });
            if (!centerCubie) continue;
            const mats = centerCubie.c.material as THREE.MeshBasicMaterial[];
            const fn = new THREE.Vector3();
            (fn as any)[face.axis] = face.coord;
            for (let i = 0; i < 6; i++) {
                worldNormal
                    .copy(localNormals[i])
                    .applyQuaternion(centerCubie.q);
                if (worldNormal.dot(fn) > 0.9) {
                    if (
                        mats[i].color.getHex() ===
                        COLORS[crossColor as keyof typeof COLORS]
                    ) {
                        bottomAxis = face.axis;
                        bottomCoord = face.coord;
                    }
                }
            }
        }
        if (!bottomAxis) return false;

        const topAxis = bottomAxis;
        const topCoord = -bottomCoord;
        const topCubies = cubieData.filter((d) => {
            return Math.round(d.wp[topAxis as "x" | "y" | "z"]) === topCoord;
        });

        const fn = new THREE.Vector3();
        (fn as any)[topAxis] = topCoord;

        for (const d of topCubies) {
            const mats = d.c.material as THREE.MeshBasicMaterial[];
            let found = false;
            for (let i = 0; i < 6; i++) {
                worldNormal.copy(localNormals[i]).applyQuaternion(d.q);
                if (worldNormal.dot(fn) > 0.9) {
                    if (mats[i].color.getHex() !== llColor) return false;
                    found = true;
                }
            }
            if (!found) return false;
        }

        return true;
    }

    function handleBluetoothMove(move: string) {
        console.log(
            `[handleBluetoothMove] move=${move}, btState=${btState}, virtualCube=${!!virtualCube}`,
        );
        if (!virtualCube) {
            console.error("virtualCube is undefined during Bluetooth move!");
            return;
        }
        if (btState === "INSPECTION" && !cycleMode) {
            if (!move.startsWith("U")) {
                btState = "SOLVING";
                status = "SOLVING...";
                if (!firstMoveTime) firstMoveTime = Date.now();
                console.log("[Timer] First move detected, execution started.");
            }
        }

        virtualCube.selfMoveStr(move);
        if (btState === "SOLVING") {
            currentMoveCount++;
        }
        console.log(`[BT Move] ${move} | Logic: ${virtualCube.toString()}`);

        const cache = getCubieCache(); // Get cache ONCE per move

        // Update latch for LSLL to unmask
        if (["LSLL"].includes(trainerMode) && !f2lSolvedLatch) {
            if (isVisualF2LSolved(cache)) {
                console.log("[Latch] F2L detected, unmasking!");
                f2lSolvedLatch = true;
                updatePieceMaterials();
                status = "F2L SOLVED - Finish the case!";
            }
        }

        let isSolved = false;
        let logicSolved = false;

        if (trainerMode === "F2L") {
            isSolved = isVisualF2LSolved(cache);
        } else if (trainerMode === "OLL") {
            isSolved = isVisualOLLSolved(cache);
        } else {
            // PLL, LL, LSLL, ZBLL - Check Full Solve
            isSolved = isVisualSolved(cache);
            logicSolved = virtualCube.isSolvedAny();

            if (isSolved || logicSolved) {
                console.log(
                    `[SUCCESS] Mode=${trainerMode} | Visual=${isSolved} | Logic=${logicSolved}`,
                );
            }
        }

        if ((isSolved || logicSolved) && !isWaiting) {
            triggerRoundSuccess();
        }
    }

    // Automatic 3D Init Effect
    $effect(() => {
        if (appState.isSolving && canvasContainer) {
            untrack(() => {
                init3D();
                startRound();
            });
        } else if (!appState.isSolving && renderer) {
            untrack(() => {
                // Cleanup on exit
                renderer.dispose();
                renderer = undefined as any;
                scene = undefined as any;
                camera = undefined as any;
                cubeGroup = undefined as any;
                cubies = [];
                if (animFrame) cancelAnimationFrame(animFrame);
            });
        }
    });

    // Handle Trainer Mode changes while active
    let hasEnteredMode = false;
    $effect(() => {
        const isTrainer =
            appState.isSolving &&
            (appState.view.endsWith("_TRAINER") ||
                appState.view.endsWith("TIME_ATTACK"));

        if (isTrainer) {
            untrack(() => {
                console.log(
                    `[Trainer] Mode active: ${appState.view}. hasEnteredMode=${hasEnteredMode}`,
                );
                // Only show Ready prompt on first entry or returning from other screens, not between cases
                if (!hasEnteredMode) {
                    isReady = false;
                    hasEnteredMode = true;
                }
                startRound();
            });
        } else {
            hasEnteredMode = false;
        }
    });

    $effect(() => {
        if (!appState.isSolving) {
            timeAttackStarted = false;
        }
    });

    // Enforce Bluetooth mode for non-PLL trainers
    $effect(() => {
        if (trainerMode !== "PLL" && mode !== "BLUETOOTH") {
            mode = "BLUETOOTH";
        }
    });

    onMount(() => {
        window.addEventListener("keydown", onKeyDown);

        // Direct subscription for faster response times (0 microtask delay)
        bluetoothState.subscribeToMoves(
            "trainer",
            (move) => {
                if (
                    appState.isSolving &&
                    mode === "BLUETOOTH" &&
                    bluetoothState.isConnected
                ) {
                    // If not ready, use the first move to confirm ready (don't apply it)
                    if (!isReady) {
                        console.log(
                            "[Trainer] Bluetooth move detected, confirming ready...",
                        );
                        isReady = true;
                        startRound();
                        return;
                    }

                    // Normal move processing
                    applyAlgo(move);
                    handleBluetoothMove(move);
                }
            },
            10,
        );
    });

    onDestroy(() => {
        if (timerInt) clearInterval(timerInt);
        if (animFrame) cancelAnimationFrame(animFrame);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("resize", onResize);
        bluetoothState.unsubscribeFromMoves("trainer");
        if (renderer) {
            renderer.dispose();
            renderer = undefined as any;
        }
    });

    // Buttons List
    let gridAlgs = $derived.by(() => {
        if (mode === "BLUETOOTH") return [];
        if (trainerMode === "PLL") return Object.keys(PLL_ALGS).sort();
        // User requested no manual grid for others
        return [];
    });
</script>

<div class="trainer-container">
    {#if !appState.isSolving}
        <div class="mode-selector">
            <h2>{trainerMode.replace(/_/g, " ")}</h2>
            <div class="buttons">
                {#if trainerMode === "PLL" && import.meta.env.DEV}
                    <button
                        class:active={mode === "MANUAL"}
                        onclick={() => (mode = "MANUAL")}
                        >Manual / Keyboard</button
                    >
                {/if}
                {#if import.meta.env.DEV}
                    <button
                        class:active={mode === "BLUETOOTH" ||
                            trainerMode !== "PLL"}
                        onclick={() => (mode = "BLUETOOTH")}
                        >Bluetooth Cube</button
                    >
                {/if}
            </div>

            {#if trainerMode !== "PLL_TIME_ATTACK"}
                <div class="cycle-toggle">
                    <label>
                        <input type="checkbox" bind:checked={cycleMode} />
                        Cycle / Free Play (No Stats)
                    </label>
                </div>
            {/if}

            {#if mode === "BLUETOOTH" || trainerMode !== "PLL"}
                <div class="bt-status">
                    <BluetoothConnect />
                </div>
            {/if}

            {#if trainerMode === "PLL_TIME_ATTACK"}
                <div class="attack-settings">
                    <button
                        onclick={() => {
                            const all = Object.keys(PLL_ALGS).sort();
                            for (let i = all.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [all[i], all[j]] = [all[j], all[i]];
                            }
                            appState.updateSettings({ timeAttackOrder: all });
                        }}>Shuffle Order</button
                    >
                    <button
                        onclick={() => {
                            appState.updateSettings({
                                timeAttackOrder: Object.keys(PLL_ALGS).sort(),
                            });
                        }}>Alphabetical Order</button
                    >
                </div>
            {/if}

            <button
                class="start-btn"
                onclick={() => (appState.isSolving = true)}
                disabled={mode === "BLUETOOTH" && !bluetoothState.isConnected}
                >{mode === "BLUETOOTH" && !bluetoothState.isConnected
                    ? "CONNECT CUBE TO START"
                    : "START TRAINING"}</button
            >
            <button class="back-btn" onclick={() => appState.setView("MENU")}
                >Back to Menu</button
            >
        </div>
    {:else}
        <div class="game-ui">
            <div
                id="canvas-container"
                bind:this={canvasContainer}
                onclick={onCanvasClick}
                role="button"
                tabindex="0"
                aria-label="Start Training"
            ></div>
            <div class="controls">
                <div class="timer">{timerDisplay}</div>
                <div class="status" class:ready-pulse={!isReady}>
                    {status}
                    {#if btState === "INSPECTION" && !cycleMode && !isWaiting}
                        <br /><small>INSPECTION (Execute on Cube)</small>
                    {/if}
                </div>

                {#if trainerMode === "PLL_TIME_ATTACK"}
                    <div class="time-attack-ui">
                        <div class="current-idx">
                            Case {timeAttackIndex + 1} of {timeAttackSequence.length}:
                            <span class="case-highlight"
                                >{currentCase.replace("PLL_", "")}</span
                            >
                        </div>

                        <div class="pref-editor">
                            <div class="pref-field">
                                <label for="pre-auf-select">Pre AUF</label>
                                <select
                                    id="pre-auf-select"
                                    value={appState.settings.pllPreferences[
                                        currentCase
                                    ]?.pre || ""}
                                    onchange={(e) => {
                                        const cur = appState.settings
                                            .pllPreferences[currentCase] || {
                                            pre: "",
                                            post: "",
                                        };
                                        appState.updatePllPreference(
                                            currentCase,
                                            {
                                                ...cur,
                                                pre: (
                                                    e.target as HTMLSelectElement
                                                ).value,
                                            },
                                        );
                                    }}
                                >
                                    <option value="">None</option>
                                    <option value="U">U</option>
                                    <option value="U'">U'</option>
                                    <option value="U2">U2</option>
                                </select>
                            </div>
                            <div class="pref-field">
                                <label for="post-auf-select">Post AUF</label>
                                <select
                                    id="post-auf-select"
                                    value={appState.settings.pllPreferences[
                                        currentCase
                                    ]?.post || ""}
                                    onchange={(e) => {
                                        const cur = appState.settings
                                            .pllPreferences[currentCase] || {
                                            pre: "",
                                            post: "",
                                        };
                                        appState.updatePllPreference(
                                            currentCase,
                                            {
                                                ...cur,
                                                post: (
                                                    e.target as HTMLSelectElement
                                                ).value,
                                            },
                                        );
                                    }}
                                >
                                    <option value="">None</option>
                                    <option value="U">U</option>
                                    <option value="U'">U'</option>
                                    <option value="U2">U2</option>
                                </select>
                            </div>
                        </div>

                        <div class="upcoming">
                            <span class="label">Next Up:</span>
                            {#each timeAttackSequence.slice(timeAttackIndex + 1, timeAttackIndex + 6) as next}
                                <span class="case-tag"
                                    >{next.replace("PLL_", "")}</span
                                >
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if trainerMode === "F2L_TIME_ATTACK" && !timeAttackStarted && f2lAttackResults.length > 0}
                    <div class="f2l-results">
                        <h3>F2L Attack Results</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Case</th>
                                    <th>Time</th>
                                    <th>Moves</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each f2lAttackResults as r}
                                    <tr>
                                        <td>{r.case.replace("F2L_", "")}</td>
                                        <td>{r.time.toFixed(2)}s</td>
                                        <td>{r.moveCount}</td>
                                    </tr>
                                {/each}
                                <tr class="total">
                                    <td>Total / Avg</td>
                                    <td
                                        >{f2lAttackResults
                                            .reduce((a, b) => a + b.time, 0)
                                            .toFixed(2)}s</td
                                    >
                                    <td
                                        >{(
                                            f2lAttackResults.reduce(
                                                (a, b) => a + b.moveCount,
                                                0,
                                            ) / f2lAttackResults.length
                                        ).toFixed(1)}</td
                                    >
                                </tr>
                            </tbody>
                        </table>
                    </div>
                {/if}

                {#if ["PLL"].includes(trainerMode)}
                    <div class="buffer">
                        {buffer
                            .replace("PLL_", "")
                            .replace("OLL_", "")
                            .replace("F2L_", "")}
                    </div>
                {:else if cycleMode}
                    <div class="info">
                        Case: {currentCase
                            .replace("PLL_", "")
                            .replace("OLL_", "")
                            .replace("F2L_", "")}
                    </div>
                {:else}
                    <div class="info">Goal: Solve Cube</div>
                {/if}

                {#if mode === "BLUETOOTH" && appState.isSolving}
                    <div class="bt-mini-status">
                        <BluetoothConnect />
                    </div>
                {/if}

                {#if gridAlgs.length > 0}
                    <div class="alg-grid">
                        {#each gridAlgs as alg}
                            <button
                                class="alg-btn"
                                class:active={buffer && alg.startsWith(buffer)}
                                class:matched={lastResult === "CORRECT" &&
                                    alg === buffer}
                                class:wrong={lastResult === "FAIL" &&
                                    alg === buffer}
                                class:correct={lastResult === "FAIL" &&
                                    alg === currentCase}
                                onclick={() => handleManualClick(alg)}
                            >
                                {alg
                                    .replace("PLL_", "")
                                    .replace("OLL_", "")
                                    .replace("F2L_", "")}
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="manual-controls">
                        {#if !cycleMode && mode === "MANUAL"}
                            <button
                                class="action-btn"
                                onclick={() => submitKeyboard("SOLVED")}
                                >Spacebar to Finish</button
                            >
                        {/if}
                        <button class="action-btn" onclick={skip}
                            >Skip / Next</button
                        >
                    </div>
                {/if}

                <button
                    class="exit-btn"
                    onclick={() => (appState.isSolving = false)}>Exit</button
                >
            </div>
        </div>
    {/if}
</div>

<style>
    .trainer-container {
        height: calc(100dvh - 60px);
        display: flex;
        flex-direction: column;
    }

    .mode-selector {
        text-align: center;
        padding-top: 4rem;
    }
    .mode-selector .buttons button {
        margin: 10px;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        cursor: pointer;
        background: #222;
        border: 1px solid #444;
        color: #888;
        border-radius: 8px;
    }
    .mode-selector button.active {
        background: #3498db;
        color: white;
        border-color: #3498db;
    }
    .start-btn {
        display: block;
        margin: 2rem auto;
        background: #2ecc71;
        color: white;
        border: none;
        font-weight: bold;
        padding: 1rem 3rem;
        font-size: 1.2rem;
        border-radius: 8px;
        cursor: pointer;
    }
    .start-btn:disabled {
        background: #34495e;
        color: #7f8c8d;
        cursor: not-allowed;
    }
    .back-btn {
        background: none;
        border: none;
        text-decoration: underline;
        color: #666;
        cursor: pointer;
    }
    .cycle-toggle {
        margin: 1rem;
        font-size: 1.1rem;
        color: #aaa;
    }
    .cycle-toggle input {
        transform: scale(1.2);
        margin-right: 0.5rem;
    }

    .game-ui {
        flex-grow: 1;
        display: flex;
        flex-direction: row;
        height: 100%;
        overflow: hidden;
    }
    #canvas-container {
        flex-grow: 1;
        background: #080808;
        position: relative;
    }

    .controls {
        width: 320px;
        background: #151515;
        padding: 1rem;
        border-left: 1px solid #333;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex-shrink: 0;
    }
    .timer {
        font-size: 3rem;
        font-family: monospace;
        color: #f1c40f;
        font-weight: bold;
        text-align: center;
    }
    .status {
        text-align: center;
        font-weight: bold;
        color: #3498db;
        min-height: 1.5em;
    }

    .time-attack-ui {
        margin: 1rem 0;
        background: #222;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #333;
        text-align: center;
    }
    .current-idx {
        font-size: 1.1rem;
        color: #eee;
        margin-bottom: 0.8rem;
        font-weight: bold;
    }
    .upcoming {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
        justify-content: center;
    }
    .upcoming .label {
        color: #666;
        font-size: 0.75rem;
        text-transform: uppercase;
    }
    .case-tag {
        background: #111;
        color: #3498db;
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
    }
    .case-highlight {
        color: #3498db;
        text-decoration: underline;
    }

    .pref-editor {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 1rem;
        padding: 0.5rem;
        background: #1a1a1a;
        border-radius: 6px;
    }
    .pref-field {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
    }
    .pref-field label {
        font-size: 0.7rem;
        color: #666;
        text-transform: uppercase;
    }
    .pref-field select {
        background: #333;
        color: white;
        border: 1px solid #444;
        border-radius: 4px;
        font-size: 0.9rem;
        padding: 0.1rem 0.3rem;
    }

    .attack-settings {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin: 1rem 0;
    }
    .attack-settings button {
        background: #333 !important;
        border: 1px solid #444 !important;
        color: #aaa !important;
        padding: 0.4rem 0.8rem !important;
        border-radius: 4px !important;
        cursor: pointer;
        font-size: 0.9rem !important;
        margin: 0 !important;
    }
    .attack-settings button:hover {
        background: #444 !important;
        color: white !important;
    }
    .buffer {
        text-align: center;
        font-size: 2rem;
        color: #eee;
        min-height: 1.5em;
        letter-spacing: 2px;
    }
    .info {
        text-align: center;
        color: #888;
        font-style: italic;
    }

    .alg-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
        overflow-y: auto;
        flex-grow: 1;
        padding-right: 0.5rem;
    }
    .alg-btn {
        background: #222;
        border: 1px solid #333;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        color: #666;
        font-weight: bold;
        padding: 0.5rem;
        cursor: pointer;
    }
    .alg-btn.active {
        background: #3498db22;
        border-color: #3498db;
        color: white;
    }
    .alg-btn.matched {
        background: #2ecc71;
        color: white;
        border-color: #2ecc71;
    }
    .alg-btn.wrong {
        background: #e74c3c;
        color: white;
        border-color: #e74c3c;
    }
    .alg-btn.correct {
        background: #27ae60;
        color: white;
        border-color: #27ae60;
        animation: pulse 1s infinite;
    }

    .manual-controls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 2rem;
    }
    .action-btn {
        padding: 1rem;
        background: #444;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1rem;
    }

    .ready-pulse {
        color: #3498db !important;
        font-weight: bold;
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.6;
            transform: scale(1.05);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }

    .exit-btn {
        margin-top: auto;
        background: #e74c3c;
        color: white;
        border: none;
        padding: 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
    }

    .bt-status,
    .bt-mini-status {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin: 1rem 0;
        min-height: 3rem;
    }

    .f2l-results {
        background: #222;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
        max-height: 200px;
        overflow-y: auto;
    }
    .f2l-results h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
        color: #ddd;
    }
    .f2l-results table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }
    .f2l-results th,
    .f2l-results td {
        padding: 4px;
        text-align: center;
        border-bottom: 1px solid #333;
    }
    .f2l-results .total {
        font-weight: bold;
        color: #f1c40f;
    }

    @media (max-width: 768px) {
        .game-ui {
            flex-direction: column;
        }
        #canvas-container {
            height: 40%;
            flex-grow: 0;
            flex-shrink: 0;
        }
        .controls {
            width: 100%;
            height: 60%;
            flex-grow: 1;
            border-left: none;
            border-top: 1px solid #333;
        }
    }
</style>
