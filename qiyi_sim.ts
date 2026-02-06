
import { CubieCube } from './src/lib/bluetooth/core/mathlib';

// --- MOCK UTILS ---
const giikerutil = {
    log: (...args: any[]) => console.log(...args),
    updateBattery: () => { },
};

class GiikerCube {
    static callback: any = (facelet: string, moves: string[]) => {
        console.log(`[CALLBACK] Moves: ${moves.join(' ')} | Facelet: ${facelet}`);
    };
}

// --- COPIED & ADAPTED LOGIC FROM qiyicube.ts ---

let curCubie = new CubieCube();
let prevCubie = new CubieCube();
let prevMoves: string[] = [];
let lastTs = 0;
let batteryLevel = 0;
let _deviceName: string | undefined = "QiYi Test";

// Helper to construct Qiyi Message
function createMsg(opcode: number, ts: number, moves: { move: number, ts: number }[], battery = 100): number[] {
    const msg = new Array(92).fill(0); // Qiyi messages are long? Code implies index 91 check.
    msg[0] = 0xfe;
    msg[2] = opcode;
    // timestamp
    msg[3] = (ts >> 24) & 0xff;
    msg[4] = (ts >> 16) & 0xff;
    msg[5] = (ts >> 8) & 0xff;
    msg[6] = ts & 0xff;

    if (opcode === 0x3 && moves.length > 0) {
        const latest = moves[0];
        msg[34] = latest.move;

        // History in reverse? 
        // 221: const off = 91 - 5 * todoMoves.length;
        // The code builds todoMoves from the message.
        // We need to POPULATE the message so the code can read it.
        // moves[0] is latest.
        // moves[1] is previous.

        // Code reads loops: while len < 10.
        // off = 91 - 5*len.
        // So first history item (previous move) should be at 91 - 5*1 = 86.
        // record[0] = msg[34] (latest).

        for (let i = 1; i < moves.length && i < 10; i++) {
            const m = moves[i];
            const off = 91 - 5 * i;
            // TS
            msg[off] = (m.ts >> 24) & 0xff;
            msg[off + 1] = (m.ts >> 16) & 0xff;
            msg[off + 2] = (m.ts >> 8) & 0xff;
            msg[off + 3] = m.ts & 0xff;
            // Move
            msg[off + 4] = m.move;
        }
    }

    // Set Facelet?
    // Code lines 252: parseFacelet(msg.slice(7, 34))
    // We need to set facelet data if we want to test that path.
    // For now, let's leave facelet empty/random and see if the MOVE LOGIC calculates it.
    // Actually the code relies on `newFacelet` (from msg) to correct specific drift. 
    // If we leave it 0, it might map to a weird facelet.

    return msg;
}

// FIX: Track moves processed at the current lastTs
let lastMovesAtTs: number[] = [];

function parseCubeData(msg: number[]) {
    // const locTime = Date.now();
    const locTime = 0;
    if (msg[0] !== 0xfe) {
        giikerutil.log('[qiyicube] error cube data', msg);
        return;
    }
    const opcode = msg[2];
    const ts = (msg[3] << 24) | (msg[4] << 16) | (msg[5] << 8) | msg[6];
    if (opcode === 0x2) {
        // Hello
    } else if (opcode === 0x3) {
        // state change
        const todoMoves: [number, number][] = [[msg[34], ts]];
        while (todoMoves.length < 10) {
            const off = 91 - 5 * todoMoves.length;
            const hisTs = (msg[off] << 24) | (msg[off + 1] << 16) | (msg[off + 2] << 8) | msg[off + 3];
            const hisMv = msg[off + 4];

            // FIX LOGIC:
            if (hisTs < lastTs) {
                break;
            }
            if (hisTs === lastTs && lastMovesAtTs.includes(hisMv)) {
                break;
            }
            todoMoves.push([hisMv, hisTs]);
        }

        // Filter: Use a new array to store only truly new moves
        // The loop above breaks early, but the first element (msg[34]) is always added.
        // We must check if msg[34] itself is a duplicate.
        const validMoves: [number, number][] = [];
        for (const [mv, t] of todoMoves) {
            if (t > lastTs || (t === lastTs && !lastMovesAtTs.includes(mv))) {
                validMoves.push([mv, t]);
            }
        }

        if (todoMoves.length > 1) {
            // giikerutil.log('[qiyicube] miss history moves', JSON.stringify(todoMoves), lastTs);
        }

        const toCallback: [string, string[], [number, number], string?][] = [];
        let curFacelet: string = '';

        // Iterate validMoves backwards (Oldest -> Newest)
        for (let i = validMoves.length - 1; i >= 0; i--) {
            const [mv, t] = validMoves[i];

            const axis = [4, 1, 3, 0, 2, 5][(mv - 1) >> 1];
            // const power = [0, 2][todoMoves[i][0] & 1]; // Original logic seems to map odd/even to 0/2.
            // Let's copy exact logic
            const power = [0, 2][mv & 1];

            // const m = axis * 3 + power; 
            // wait, CubieCube.moveCube index?
            // U, U2, U' -> 0, 1, 2
            // R -> 3,4,5
            // F -> 6,7,8
            // D -> 9,10,11
            // L -> 12,13,14
            // B -> 15,16,17
            // axis check: 0=U (3), 1=R (1), 2=F (4), 3=D (2), 4=L (0), 5=B (5)
            // URFDLB -> 012345
            // axis values from array: 4(L), 1(R), 3(D), 0(U), 2(F), 5(B).

            // Re-calc:
            const m = axis * 3 + power;
            CubieCube.CubeMult(prevCubie, CubieCube.moveCube[m], curCubie);
            prevMoves.unshift('URFDLB'.charAt(axis) + " 2'".charAt(power));
            prevMoves = prevMoves.slice(0, 8);
            curFacelet = curCubie.toFaceCube();

            toCallback.push([
                curFacelet,
                prevMoves.slice(),
                [Math.trunc(t / 1.6), locTime],
                _deviceName || undefined
            ]);

            const tmp = curCubie;
            curCubie = prevCubie;
            prevCubie = tmp;

            // Update State (Simulating the end-of-function update)
            if (t > lastTs) {
                lastTs = t;
                lastMovesAtTs = [mv];
            } else if (t === lastTs) {
                if (!lastMovesAtTs.includes(mv)) lastMovesAtTs.push(mv);
            }
        }

        // Skipping facelet correction check for this pure-move-logic test
        // Assumes the calculation is correct.
        for (let i = 0; i < toCallback.length; i++) {
            GiikerCube.callback.apply(null, toCallback[i]);
        }
    }
    // lastTs = ts; // REMOVED: Managed incrementally inside the loop
}

// --- TEST SCENARIO ---

// Mapping for reference:
// 1: L'
// 2: L
// 3: R'
// 4: R

// Scenario: "M slice moves are only showing moving the R or L face"
// M' = R L' x'. (F -> U).
// M = R' L x. (U -> F).
// If user does M, they do R' and L.
// R' = 3.
// L = 2.

async function runScenario() {
    console.log("Starting Qiyi Protocol Simulation...");

    // 1. Send R' (3) at TS 100
    console.log("\n--- PACKET 1: R' (3) TS 100 ---");
    let msg1 = createMsg(0x3, 100, [{ move: 3, ts: 100 }]);
    parseCubeData(msg1);

    // 2. Send L (2) at TS 100 (Simultaneous)
    // History should ideally contain R'(3) at TS 100.
    console.log("\n--- PACKET 2: L (2) TS 100 (Simult) ---");
    // NOTE: If timestamps are identical, current logic might SKIP the second one if timestamps are used as high-water mark.
    let msg2 = createMsg(0x3, 100, [
        { move: 2, ts: 100 }, // Latest
        { move: 3, ts: 100 }  // History
    ]);
    parseCubeData(msg2);

    // 3. Send L (2) at TS 101 (Sequential but fast)
    console.log("\n--- PACKET 3: L (2) TS 101 (Seq) ---");
    // Reset lastTs to 100 to simulate we processed P1 already.
    lastTs = 100;
    let msg3 = createMsg(0x3, 101, [
        { move: 2, ts: 101 },
        { move: 3, ts: 100 }
    ]);
    parseCubeData(msg3);

    console.log("\nSimulation Complete.");
}

runScenario();
