import { GiikerCube } from './core/bluetooth';

// Move subscription types
type MoveSubscriber = {
	callback: (move: string) => void;
	priority: number; // Higher priority = takes precedence
};

let isConnected = $state(false);
let isConnecting = $state(false);
let deviceName = $state<string | null>(null);
let deviceId = $state<string | null>(null);
let deviceMac = $state<string | null>(null);
let batteryLevel = $state<number | null>(null);
let facelet = $state<string | null>(null);
let lastMove = $state<string | null>(null);
let moveCounter = $state(0);
let errorMessage = $state<string | null>(null);
const macAddressRequest = $state({
	isOpen: false,
	isWrongKey: false,
	deviceMac: null as string | null,
	defaultMac: null as string | null,
	resolve: null as ((mac: string | undefined) => void) | null
});

let history = $state([] as { move: string; counter: number }[]);
let lastMoveTime = $state(0);

// Move subscribers map (id -> { callback, priority })
const moveSubscribers = new Map<string, MoveSubscriber>();

export const bluetoothState = {
	get isConnected() {
		return isConnected;
	},
	get deviceName() {
		return deviceName;
	},
	get deviceId() {
		return deviceId;
	},
	get deviceMac() {
		return deviceMac;
	},
	get batteryLevel() {
		return batteryLevel;
	},
	get facelet() {
		return facelet;
	},
	get history() {
		return history;
	},
	get lastMove() {
		return lastMove;
	},
	get moveCounter() {
		return moveCounter;
	},
	get errorMessage() {
		return errorMessage;
	},
	setConnected(connected: boolean) {
		isConnected = connected;
		if (connected) {
			errorMessage = null;
		} else {
			facelet = null;
			lastMove = null;
			moveCounter = 0;
			history = [];
		}
	},
	setDeviceName(name: string | null) {
		deviceName = name;
	},
	setDeviceId(id: string | null) {
		deviceId = id;
	},
	setDeviceMac(mac: string | null) {
		deviceMac = mac;
	},
	setBatteryLevel(level: number | null) {
		batteryLevel = level;
	},
	setErrorMessage(msg: string | null) {
		errorMessage = msg;
	},
	// MAC Address Request Handling
	requestMacAddress(
		isWrongKey: boolean,
		deviceMac: string | null,
		defaultMac: string | null,
		resolve: (mac: string | undefined) => void
	) {
		macAddressRequest.isOpen = true;
		macAddressRequest.isWrongKey = isWrongKey;
		macAddressRequest.deviceMac = deviceMac;
		macAddressRequest.defaultMac = defaultMac;
		macAddressRequest.resolve = resolve;
	},
	submitMacAddress(mac: string) {
		if (macAddressRequest.resolve) {
			macAddressRequest.resolve(mac);
		}
		bluetoothState.resetMacAddressRequest();
	},
	cancelMacAddressRequest() {
		if (macAddressRequest.resolve) {
			macAddressRequest.resolve(undefined);
		}
		bluetoothState.resetMacAddressRequest();
		isConnected = false;
	},
	resetMacAddressRequest() {
		macAddressRequest.isOpen = false;
		macAddressRequest.isWrongKey = false;
		macAddressRequest.deviceMac = null;
		macAddressRequest.defaultMac = null;
		macAddressRequest.resolve = null;
	},
	get macAddressRequest() {
		return macAddressRequest;
	},
	handleCubeCallback(newFacelet: string, prevMoves: string[]) {
		facelet = newFacelet;
		const incomingMoves = prevMoves.filter(m => m && m.trim().length > 0);

		if (incomingMoves.length > 0) {
			// Deduplication Logic (Existing)
			const lastSeenMoves = history.slice(-10).map(h => h.move).reverse();
			let newMovesCount = 0;
			if (lastSeenMoves.length === 0) {
				newMovesCount = incomingMoves.length;
			} else {
				let matchIdx = -1;
				for (let i = 0; i <= incomingMoves.length; i++) {
					const suffixLen = incomingMoves.length - i;
					if (suffixLen > lastSeenMoves.length) continue;
					let isMatch = true;
					for (let j = 0; j < suffixLen; j++) {
						if (incomingMoves[i + j] !== lastSeenMoves[j]) {
							isMatch = false;
							break;
						}
					}
					if (isMatch) {
						matchIdx = i;
						break;
					}
				}
				newMovesCount = matchIdx === -1 ? incomingMoves.length : matchIdx;
			}

			// Processing and Dispatch
			for (let i = newMovesCount - 1; i >= 0; i--) {
				const move = incomingMoves[i];
				const now = Date.now();

				// 1. Dispatch the primary move
				lastMove = move;
				moveCounter++;
				history.push({ move, counter: moveCounter });
				if (history.length > 100) history.shift();

				if (moveSubscribers.size > 0) {
					const subs = Array.from(moveSubscribers.values()).sort((a, b) => b.priority - a.priority);
					subs.forEach(s => s.callback(move));
				}

				// 2. Check for Slice/Rotation Logic
				// Limit to 75ms for "simultaneous" detection
				if (history.length >= 2 && (now - lastMoveTime < 75)) {
					// Get the *previous* move. Since we just pushed 'move', it's history[len-2]
					const prev = history[history.length - 2].move;

					let rotation = "";

					// M' = R' L x
					// M = R L' x'
					// M2 = R2 L2 x2

					const isR_L_Pair = (m1: string, m2: string, r1: string, l1: string) =>
						(m1 === r1 && m2 === l1) || (m1 === l1 && m2 === r1);

					if (isR_L_Pair(prev, move, "R'", "L")) rotation = "x";
					else if (isR_L_Pair(prev, move, "R", "L'")) rotation = "x'";
					else if (isR_L_Pair(prev, move, "R2", "L2")) rotation = "x2";

					if (rotation) {
						console.log(`[Store] Detected Slice Pair (${prev}, ${move}) -> Injecting Rotation ${rotation}`);
						if (moveSubscribers.size > 0) {
							const subs = Array.from(moveSubscribers.values()).sort((a, b) => b.priority - a.priority);
							subs.forEach(s => s.callback(rotation));
						}
					}
				}

				lastMoveTime = now;
			}
		}
	},
	getMovesSince(lastCounter: number) {
		return history.filter((h) => h.counter > lastCounter);
	},
	// Connection process state
	get isConnecting() {
		return isConnecting;
	},
	setIsConnecting(connecting: boolean) {
		isConnecting = connecting;
	},
	// Move subscription methods
	subscribeToMoves(id: string, callback: (move: string) => void, priority: number) {
		moveSubscribers.set(id, { callback, priority });
	},
	unsubscribeFromMoves(id: string) {
		moveSubscribers.delete(id);
	}
};
