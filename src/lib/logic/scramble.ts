import { PLL_ALGS, OLL_ALGS, F2L_ALGS, OCLL_NAMES } from "../data/algs";

export function invert(alg: string): string {
    if (!alg) return "";
    return alg
        .replace(/[()]/g, "")
        .trim()
        .split(/\s+/)
        .reverse()
        .map((m) => {
            if (m.endsWith("2")) return m;
            if (m.endsWith("'")) return m.slice(0, -1);
            return m + "'";
        })
        .join(" ");
}

function getRandomKey(obj: Record<string, string>): string {
    const keys = Object.keys(obj);
    return keys[Math.floor(Math.random() * keys.length)];
}

export function getRandomAuf(): string {
    return ["", "U", "U'", "U2"][Math.floor(Math.random() * 4)];
}

export function getScramble(
    mode: "PLL" | "OLL" | "F2L" | "LL" | "LSLL" | "ZBLL",
    specificCase?: string,
): { scramble: string; caseName: string } {
    let scramble = "";
    let caseName = "";

    switch (mode) {
        case "PLL":
            caseName = specificCase || getRandomKey(PLL_ALGS);
            scramble = invert(PLL_ALGS[caseName]);
            break;

        case "OLL":
            caseName = specificCase || getRandomKey(OLL_ALGS);
            scramble = invert(OLL_ALGS[caseName]);
            break;

        case "F2L":
            caseName = specificCase || getRandomKey(F2L_ALGS);
            scramble = invert(F2L_ALGS[caseName]);
            break;

        case "LL":
            // Random OLL + Random PLL
            const pll = getRandomKey(PLL_ALGS);
            const oll = getRandomKey(OLL_ALGS);
            caseName = `LL Random`;
            // Add random AUF between stages
            scramble = `${invert(PLL_ALGS[pll])} ${getRandomAuf()} ${invert(OLL_ALGS[oll])}`;
            break;

        case "ZBLL":
            // Only OCLL-type OLLs
            const ocllKeys = Object.keys(OCLL_NAMES);
            const zoll = ocllKeys[Math.floor(Math.random() * ocllKeys.length)];
            const zpll = getRandomKey(PLL_ALGS);
            caseName = `ZBLL_${OCLL_NAMES[zoll]}`;
            scramble = `${invert(PLL_ALGS[zpll])} ${getRandomAuf()} ${invert(OLL_ALGS[zoll])}`;
            break;

        case "LSLL":
            // Random LL + Random F2L
            const llPll = getRandomKey(PLL_ALGS);
            const llOll = getRandomKey(OLL_ALGS);
            const f2l = getRandomKey(F2L_ALGS);
            caseName = `LSLL Random`;

            // Apply inverse Pll -> AUF -> inverse OLL -> AUF -> inverse F2L -> AUF
            scramble = `${invert(PLL_ALGS[llPll])} ${getRandomAuf()} ${invert(OLL_ALGS[llOll])} ${getRandomAuf()} ${invert(F2L_ALGS[f2l])}`;
            break;
    }

    return { scramble, caseName };
}
