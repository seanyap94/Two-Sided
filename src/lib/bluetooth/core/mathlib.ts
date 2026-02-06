/**
 * Minimal TypeScript port of csTimer's mathlib.js
 * Only includes CubieCube class and essential utilities needed for Bluetooth cube integration
 */

export const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * Represents a Rubik's Cube state using corner and edge permutation/orientation
 */
export class CubieCube {
	ca: number[]; // corner array: 8 corners, each stores perm (0-7) and ori (0-2)
	ea: number[]; // edge array: 12 edges, each stores perm (0-11) and ori (0-1)
	ct: number[]; // center array: 6 centers
	ori: number;  // current orientation index (0-23)

	constructor() {
		this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
		this.ea = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
		this.ct = [0, 1, 2, 3, 4, 5];
		this.ori = 0;
	}

	/**
	 * Initialize cube from corner and edge arrays
	 */
	init(ca: number[], ea: number[], ct?: number[], ori?: number): CubieCube {
		this.ca = ca.slice();
		this.ea = ea.slice();
		if (ct) this.ct = ct.slice();
		if (ori !== undefined) this.ori = ori;
		return this;
	}

	/**
	 * Create a deep copy of another cube
	 */
	copy(other: CubieCube): CubieCube {
		return this.init(other.ca, other.ea, other.ct, other.ori);
	}

	/**
	 * Convert state to a simple string for debugging
	 */
	toString(): string {
		return `ori:${this.ori}, ct:[${this.ct?.join(',') || ''}], ca:${this.ca.slice(0, 4).join(',')}..., ea:${this.ea.slice(0, 4).join(',')}...`;
	}

	/**
	 * Check if this cube is equal to another (only parts)
	 */
	isEqual(c: CubieCube): boolean {
		for (let i = 0; i < 8; i++) {
			if (this.ca[i] !== c.ca[i]) return false;
		}
		for (let i = 0; i < 12; i++) {
			if (this.ea[i] !== c.ea[i]) return false;
		}
		return true;
	}

	/**
	 * Inverse of the cube state
	 */
	invFrom(cc: CubieCube): CubieCube {
		for (let edge = 0; edge < 12; edge++) {
			this.ea[cc.ea[edge] >> 1] = (edge << 1) | (cc.ea[edge] & 1);
		}
		for (let corn = 0; corn < 8; corn++) {
			this.ca[cc.ca[corn] & 0x7] = corn | ((0x20 >> (cc.ca[corn] >> 3)) & 0x18);
		}
		return this;
	}

	/**
	 * Convert state to facelet string representation
	 */
	toFaceCube(): string {
		const f: string[] = [];
		const cornerFacelet = [
			[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
			[29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]
		];
		const edgeFacelet = [
			[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
			[30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]
		];
		const cornerColor = [
			['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
			['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B']
		];
		const edgeColor = [
			['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
			['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R']
		];

		const res = valuedArray(54, ' ');
		for (let i = 0; i < 6; i++) res[i * 9 + 4] = 'URFDLB'[i];
		for (let i = 0; i < 8; i++) {
			for (let j = 0; j < 3; j++) {
				res[cornerFacelet[i][j]] = cornerColor[this.ca[i] & 7][(j + (3 - (this.ca[i] >> 3))) % 3];
			}
		}
		for (let i = 0; i < 12; i++) {
			for (let j = 0; j < 2; j++) {
				res[edgeFacelet[i][j]] = edgeColor[this.ea[i] >> 1][(j + (this.ea[i] & 1)) % 2];
			}
		}
		return res.join('');
	}

	/**
	 * Initialize cube from facelet string with automatic orientation detection
	 */
	fromFacelet(facelets: string): CubieCube {
		const cornerFacelet = [
			[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
			[29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]
		];
		const edgeFacelet = [
			[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
			[30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]
		];



		const centerU = facelets[4];
		const centerR = facelets[13];
		const centerF = facelets[22];
		const centerD = facelets[31];
		const centerL = facelets[40];
		const centerB = facelets[49];

		// Detect orientation from centers
		const faceCenterIndices = [4, 13, 22, 31, 40, 49];
		const centers = faceCenterIndices.map(idx => 'URFDLB'.indexOf(facelets[idx]));
		const detectedOri = CubieCube.rotCube.findIndex(c =>
			c.ct.every((v, j) => v === centers[j])
		);
		if (detectedOri !== -1) {
			this.ori = detectedOri;
			this.ct = centers.slice();
		}

		for (let i = 0; i < 8; i++) {
			let ori = 0;
			for (; ori < 3; ori++) {
				const col = facelets[cornerFacelet[i][ori]];
				if (col === centerU || col === centerD) break;
			}
			const col0 = facelets[cornerFacelet[i][0]];
			const col1 = facelets[cornerFacelet[i][1]];
			const col2 = facelets[cornerFacelet[i][2]];
			const col = col0 + col1 + col2;
			const cornerMap: Record<string, number> = {
				'URF': 0, 'RFU': 0, 'FUR': 0, 'UFL': 1, 'FLU': 1, 'LUF': 1,
				'ULB': 2, 'LBU': 2, 'BUL': 2, 'UBR': 3, 'BRU': 3, 'RUB': 3,
				'DFR': 4, 'FRD': 4, 'RDF': 4, 'DLF': 5, 'LFD': 5, 'FDL': 5,
				'DBL': 6, 'BLD': 6, 'LDB': 6, 'DRB': 7, 'RBD': 7, 'BDR': 7
			};
			const p = cornerMap[col] || 0;
			this.ca[i] = (ori << 3) | p;
		}

		for (let i = 0; i < 12; i++) {
			const edgeMap: Record<string, number> = {
				'UR': 0, 'RU': 0, 'UF': 1, 'FU': 1, 'UL': 2, 'LU': 2, 'UB': 3, 'BU': 3,
				'DR': 4, 'RD': 4, 'DF': 5, 'FD': 5, 'DL': 6, 'LD': 6, 'DB': 7, 'BD': 7,
				'FR': 8, 'RF': 8, 'FL': 9, 'LF': 9, 'BL': 10, 'LB': 10, 'BR': 11, 'RB': 11
			};
			const f0 = facelets[edgeFacelet[i][0]];
			const f1 = facelets[edgeFacelet[i][1]];
			const col = f0 + f1;
			const p = edgeMap[col] || 0;
			const ori = (f0 === centerU || f0 === centerD ||
				((f0 === centerF || f0 === centerB) &&
					(f1 === centerL || f1 === centerR))) ? 0 : 1;
			this.ea[i] = (p << 1) | ori;
		}
		return this;
	}

	verify(): number {
		let cSum = 0;
		for (let i = 0; i < 8; i++) cSum += this.ca[i] >> 3;
		if (cSum % 3 !== 0) return -1;
		let eSum = 0;
		for (let i = 0; i < 12; i++) eSum += this.ea[i] & 1;
		if (eSum % 2 !== 0) return -2;
		return 0; // Simple verification
	}

	/**
	 * Apply a move string to the cube
	 */
	selfMoveStr(moveStr: string, isInv?: boolean): number | undefined {
		const CubeMoveRE = /^\s*([URFDLB]w?|[urfdlb]|[EMSyxz]|2-2[URFDLB]w)(['2]?)(@\d+)?\s*$/;
		const m = CubeMoveRE.exec(moveStr);
		if (!m) return;

		const face = m[1];
		let pow = "2'".indexOf(m[2] || '-') + 2;
		if (isInv) pow = 4 - pow;

		const faceUpper = face[0].toUpperCase();
		const axis = 'URFDLB'.indexOf(faceUpper);
		const isWide = face.length > 1 || face === face.toLowerCase();

		// axial moves
		if (axis !== -1 && !'EMSyxz'.includes(face)) {
			let move = axis * 3 + (pow % 4) - 1;
			move = CubieCube.rotMulM[this.ori][move];
			CubieCube.CubeMult(this, CubieCube.moveCube[move], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);

			if (isWide) {
				const suffix = m[2] || "";
				const applySlice = (base: string) => {
					let finalMove = base;
					if (suffix === "'") {
						if (finalMove.endsWith("'")) finalMove = finalMove.slice(0, -1);
						else finalMove += "'";
					} else if (suffix === "2") {
						finalMove = finalMove.replace("'", "") + "2";
					}
					this.selfMoveStr(finalMove, isInv);
				};
				if (faceUpper === 'U') applySlice("E'");
				if (faceUpper === 'D') applySlice("E");
				if (faceUpper === 'R') applySlice("M'");
				if (faceUpper === 'L') applySlice("M");
				if (faceUpper === 'F') applySlice("S");
				if (faceUpper === 'B') applySlice("S'");
			}
			return move;
		}

		// rotations and slices
		const rotAxis = 'xyzMES'.indexOf(face);
		if (rotAxis !== -1) {
			const findIdx = (c0: number, c2: number) =>
				CubieCube.rotCube.findIndex(c => c.ct[0] === c0 && c.ct[2] === c2);

			const rotIdxMap: Record<string, number> = {
				'y': 1, 'y2': 2, "y'": 3,
				'x': findIdx(2, 3), "x'": findIdx(5, 0), 'x2': findIdx(3, 5),
				'z': findIdx(0, 1), "z'": findIdx(0, 4), 'z2': findIdx(0, 3)
			};

			const oldOri = this.ori;
			const oldCt = this.ct.slice();

			const applySlices = () => {
				for (let i = 0; i < (pow % 4); i++) {
					if (face === 'M') {
						this.selfMoveStr("x'", false);
						this.selfMoveStr("R'", false);
						this.selfMoveStr("L", false);
					} else if (face === 'E') {
						this.selfMoveStr("y'", false);
						this.selfMoveStr("U", false);
						this.selfMoveStr("D'", false);
					} else if (face === 'S') {
						this.selfMoveStr("z", false);
						this.selfMoveStr("F'", false);
						this.selfMoveStr("B", false);
					} else {
						let key = face;
						const idx = rotIdxMap[key];
						const r = CubieCube.rotCube[idx];
						CubieCube.CubeMult(this, r, tmpCubie);
						CubieCube.CentMult(this, r, tmpCubie);
						this.init(tmpCubie.ca, tmpCubie.ea);
						this.ct = tmpCubie.ct.slice();
						this.ori = CubieCube.rotMult[this.ori][idx];
					}
				}
			};

			applySlices();
			if ('MES'.includes(face)) {
				this.ori = oldOri;
				this.ct = oldCt;
			}
			return 0;
		}
		return undefined;
	}

	hashCode(): number {
		let ret = 0;
		for (let i = 0; i < 20; i++) {
			ret = 0 | (ret * 31 + (i < 12 ? this.ea[i] : this.ca[i - 12]));
		}
		return ret;
	}

	isSolvedAny(): boolean {
		const temp = new CubieCube();
		for (let i = 0; i < 24; i++) {
			const target = CubieCube.rotCube[i];
			temp.init(target.ca, target.ea);
			temp.ori = i;

			for (let j = 0; j < 4; j++) {
				if (this.isEqual(temp)) return true;
				temp.selfMoveStr('U');
			}
		}
		return false;
	}

	// Static Data
	static SOLVED = new CubieCube();
	static moveCube: CubieCube[] = [];
	static rotCube: CubieCube[] = [];
	static rotMulM: number[][] = [];
	static rotMult: number[][] = [];
	static rotMulI: number[][] = [];

	static CornMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let corn = 0; corn < 8; corn++) {
			const ori = ((a.ca[b.ca[corn] & 7] >> 3) + (b.ca[corn] >> 3)) % 3;
			prod.ca[corn] = (a.ca[b.ca[corn] & 7] & 7) | (ori << 3);
		}
	}
	static EdgeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let ed = 0; ed < 12; ed++) {
			prod.ea[ed] = a.ea[b.ea[ed] >> 1] ^ (b.ea[ed] & 1);
		}
	}
	static CentMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		prod.ct = [];
		for (let cent = 0; cent < 6; cent++) {
			prod.ct[cent] = a.ct[b.ct[cent]];
		}
	}
	static CubeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		CubieCube.CornMult(a, b, prod);
		CubieCube.EdgeMult(a, b, prod);
	}
}

const tmpCubie = new CubieCube();

// Setup move cubes
(() => {
	for (let i = 0; i < 18; i++) CubieCube.moveCube[i] = new CubieCube();
	CubieCube.moveCube[0].init([3, 0, 1, 2, 4, 5, 6, 7], [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22]);
	CubieCube.moveCube[3].init([20, 1, 2, 8, 15, 5, 6, 19], [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0]);
	CubieCube.moveCube[6].init([9, 21, 2, 3, 16, 12, 6, 7], [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22]);
	CubieCube.moveCube[9].init([0, 1, 2, 3, 5, 6, 7, 4], [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22]);
	CubieCube.moveCube[12].init([0, 10, 22, 3, 4, 17, 13, 7], [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22]);
	CubieCube.moveCube[15].init([0, 1, 11, 23, 4, 5, 18, 14], [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15]);
	for (let a = 0; a < 18; a += 3) {
		for (let p = 0; p < 2; p++) CubieCube.CubeMult(CubieCube.moveCube[a + p], CubieCube.moveCube[a], CubieCube.moveCube[a + p + 1]);
	}
})();

// Setup rotations
(() => {
	const u4 = new CubieCube().init([3, 0, 1, 2, 7, 4, 5, 6], [6, 0, 2, 4, 14, 8, 10, 12, 23, 17, 19, 21]);
	u4.ct = [0, 5, 1, 3, 2, 4];
	const f2 = new CubieCube().init([5, 4, 7, 6, 1, 0, 3, 2], [12, 10, 8, 14, 4, 2, 0, 6, 18, 16, 22, 20]);
	f2.ct = [3, 4, 2, 0, 1, 5];
	const urf = new CubieCube().init([8, 20, 13, 17, 19, 15, 22, 10], [3, 16, 11, 18, 7, 22, 15, 20, 1, 9, 13, 5]);
	urf.ct = [2, 0, 1, 5, 3, 4];

	const c = new CubieCube(); const d = new CubieCube();
	for (let i = 0; i < 24; i++) {
		CubieCube.rotCube[i] = new CubieCube().init(c.ca, c.ea, c.ct);
		CubieCube.CubeMult(c, u4, d); CubieCube.CentMult(c, u4, d);
		c.init(d.ca, d.ea, d.ct);
		if (i % 4 === 3) { CubieCube.CubeMult(c, f2, d); CubieCube.CentMult(c, f2, d); c.init(d.ca, d.ea, d.ct); }
		if (i % 8 === 7) { CubieCube.CubeMult(c, urf, d); CubieCube.CentMult(c, urf, d); c.init(d.ca, d.ea, d.ct); }
	}

	const movHash = CubieCube.moveCube.map(m => m.hashCode());
	const rotHash = CubieCube.rotCube.map(m => m.hashCode());
	for (let i = 0; i < 24; i++) {
		CubieCube.rotMult[i] = []; CubieCube.rotMulI[i] = []; CubieCube.rotMulM[i] = [];
	}
	for (let i = 0; i < 24; i++) {
		for (let j = 0; j < 24; j++) {
			CubieCube.CubeMult(CubieCube.rotCube[i], CubieCube.rotCube[j], c);
			const k = rotHash.indexOf(c.hashCode());
			CubieCube.rotMult[i][j] = k;
			CubieCube.rotMulI[k][j] = i;
		}
	}
	for (let i = 0; i < 24; i++) {
		for (let j = 0; j < 18; j++) {
			CubieCube.CubeMult(CubieCube.rotCube[CubieCube.rotMulI[0][i]], CubieCube.moveCube[j], c);
			CubieCube.CubeMult(c, CubieCube.rotCube[i], d);
			CubieCube.rotMulM[i][j] = movHash.indexOf(d.hashCode());
		}
	}
})();

function getNPerm(arr: number[], n: number): number {
	let idx = 0; const vall = 0x76543210; let valh = 0xfedcba98;
	for (let i = 0; i < n - 1; i++) {
		const v = arr[i] << 2; idx *= n - i;
		if (v >= 32) { idx += (valh >> (v - 32)) & 0xf; valh -= 0x11111110 << (v - 32); }
		else { idx += (vall >> v) & 0xf; valh -= 0x11111111; }
	}
	return idx;
}
function getNParity(idx: number, n: number): number {
	let p = 0; for (let i = n - 2; i >= 0; --i) { p ^= idx % (n - i); idx = ~~(idx / (n - i)); }
	return p & 1;
}
export function valuedArray<T>(length: number, valueOrFn: T | ((index: number) => T)): T[] {
	const arr: T[] = []; const isFn = typeof valueOrFn === 'function';
	for (let i = 0; i < length; i++) arr[i] = isFn ? (valueOrFn as any)(i) : valueOrFn;
	return arr;
}
