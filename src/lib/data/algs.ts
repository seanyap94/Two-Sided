export const PLL_ALGS: Record<string, string> = {
    PLL_Aa: "x R' U R' D2 R U' R' D2 R2 x'",
    PLL_Ab: "x R2 D2 R U R' D2 R U' R x'",
    PLL_E: "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
    PLL_F: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
    PLL_Ga: "R2 u R' U R' U' R u' R2 y' R' U R",
    PLL_Gb: "R' U' R y R2 u R' U R U' R u' R2",
    PLL_Gc: "R2 u' R U' R U R' u R2 y R U' R'",
    PLL_Gd: "R U R' y' R2 u' R U' R' U R' u R2",
    PLL_H: "M2 U M2 U2 M2 U M2",
    PLL_Ja: "R' U L' U2 R U' R' U2 R L",
    PLL_Jb: "R U R' F' R U R' U' R' F R2 U' R'",
    PLL_Na: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
    PLL_Nb: "R' U L' U2 R U' L R' U L' U2 R U' L U",
    PLL_Ra: "R U' R' U' R U R D R' U' R D' R' U2 R' U'",
    PLL_Rb: "R2 F R U R U' R' F' R U2 R' U2 R",
    PLL_T: "R U R' U' R' F R2 U' R' U' R U R' F'",
    PLL_Ua: "M2 U M U2 M' U M2",
    PLL_Ub: "M2 U' M U2 M' U' M2",
    PLL_V: "R' U R' d' R' F' R2 U' R' U R' F R F",
    PLL_Y: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    PLL_Z: "M2 U M2 U M' U2 M2 U2 M'",
};

export const OLL_ALGS: Record<string, string> = {
    // All Edges Oriented (OCLL)
    OLL_21: "R U2 R' U' R U R' U' R U' R'",
    OLL_22: "R U2 R2 U' R2 U' R2 U2 R",
    OLL_23: "R2 D' R U2 R' D R U2 R",
    OLL_24: "r U R' U' r' F R F'",
    OLL_25: "F' r U r' U' r' F r",
    OLL_26: "R U2 R' U' R U' R'",
    OLL_27: "R U R' U R U2 R'",

    // T Shapes
    OLL_33: "R U R' U' R' F R F'",
    OLL_45: "F R U R' U' F'",

    // Squares
    OLL_5: "l' U2 L U L' U l",
    OLL_6: "r U2 R' U' R U' r'",

    // C Shapes
    OLL_34: "R U R2 U' R' F R U R U' F'",
    OLL_46: "R' U' R' F R F' U R",

    // W Shapes
    OLL_36: "L' U' L U' L' U L U L F' L' F",
    OLL_38: "R U R' U R U' R' U' R' F R F'",

    // I Shapes
    OLL_51: "f R U R' U' f'",
    OLL_52: "R' U' R U' R' d R' U R B",
    OLL_55: "R U2 R2 U' R U' R' U2 F R F'",
    OLL_56: "r U r' U R U' R' U R U' R' r U' r'",

    // Fish
    OLL_9: "R U R' U' R' F R2 U R' U' F'",
    OLL_10: "R U R' U R' F R F' R U2 R'",
    OLL_35: "R U2 R2 F R F' R U2 R'",
    OLL_37: "F R' F' R U R U' R'",

    // Big Lightning
    OLL_39: "L F' L' U' L U F U' L'",
    OLL_40: "R' F R U R' U' F' U R",

    // Small Lightning
    OLL_7: "r U R' U R U2 r'",
    OLL_8: "r' U' R U' R' U2 r",
    OLL_11: "r U R' U R' F R F' R U2 r'",
    OLL_12: "M' R' U' R U' R' U2 R U' M",

    // Knight
    OLL_13: "F U R U' R2 F' R U R U' R'",
    OLL_14: "R' F R U R' F' R F U' F'",
    OLL_15: "l' U' l L' U' L U l' U l",
    OLL_16: "r U r' R U R' U' r U' r'",

    // Awkward
    OLL_29: "R U R' U' R U' R' F' U' F R U R'",
    OLL_30: "F U R U2 R' U' R U R' F'",
    OLL_41: "R U R' U R U2 R' F R U R' U' F'",
    OLL_42: "R' U' R U' R' U2 R F R U R' U' F'",

    // P Shapes
    OLL_31: "R' U' F U R U' R' F' R",
    OLL_32: "L U F' U' L' U L F L'",
    OLL_43: "f' L' U' L U f",
    OLL_44: "f R U R' U' f'",

    // Dot
    OLL_1: "R U2 R2 F R F' U2 R' F R F'",
    OLL_2: "F R U R' U' F' f R U R' U' f'",
    OLL_3: "f R U R' U' f' U' F R U R' U' F'",
    OLL_4: "f R U R' U' f' U F R U R' U' F'",
    OLL_17: "R U R' U R' F R F' U2 R' F R F'",
    OLL_18: "r U R' U R U2 r2 U' R U' R' U2 r",
    OLL_19: "r' R U R U R' U' M' R' F R F'",
    OLL_20: "r U R' U' M2 U R U' R' U' M'",
};

// Standard F2L Algorithms (1-41)
export const F2L_ALGS: Record<string, string> = {
    // 1. Basic Inserts
    F2L_1: "U R U' R'",
    F2L_2: "F' U' F",

    // 2. Corner in bottom, Edge in top
    F2L_3: "R U R' U' R U R'",
    F2L_4: "F' U' F U F' U' F",
    F2L_5: "U' R U R' U2 R U' R'",
    F2L_6: "U' F' U2 F U' F' U F",

    // 3. Corner in top, Edge in bottom
    F2L_7: "U' R U R' U R U R'",
    F2L_8: "U R U' R' U' R U' R'",
    F2L_9: "U' R U' R' U F' U F",
    F2L_10: "U2 R U R' U F' U' F",

    // 4. Corner in bottom, Edge in bottom
    F2L_11: "U' R U' R' U2 R U' R'", // Edge solved, Corner twisted
    F2L_12: "U R U R' U2 R U R'",
    F2L_13: "U R U' R' U' F' U F",
    F2L_14: "U' F' U F U R U' R'",

    // 5. Corner in top, Edge in top (Separated)
    F2L_15: "U' R U R' U F' U' F",
    F2L_16: "U R U' R' U' R U' R'",
    F2L_17: "R U2 R' U' R U R'",
    F2L_18: "F' U2 F U F' U' F",

    // Connected
    F2L_19: "U R U2 R' U R U' R'",
    F2L_20: "U' F' U2 F U' F' U F",
    F2L_21: "U2 R U R' U R U' R'",
    F2L_22: "U2 F' U' F U' F' U F",

    // Touching (Corner and Edge match color on top)
    F2L_23: "U R U' R' U' R U' R' U R U' R'",
    F2L_24: "R U R' U2 R U R'",
    F2L_25: "F' U' F U2 F' U' F",
    F2L_26: "U R U' R' U' F' U F",

    // Split/Misoriented
    F2L_27: "R U' R' U R U' R'",
    F2L_28: "F' U F U' F' U F",
    F2L_29: "R U R' U' R U R' U' R U R'",
    F2L_30: "F' U' F U F' U' F U F' U' F", // "Triple Sledge" equivalent

    // Corner/Edge Stuck
    F2L_31: "U' R U' R' U F' U F",
    F2L_32: "U R U R' U' F' U' F",
    F2L_33: "U R U' R' U' R U R'",
    F2L_34: "U' F' U F U F' U' F",

    // Misc
    F2L_35: "U R U R' U2 R U R'",
    F2L_36: "U' F' U' F U2 F' U' F",
    F2L_37: "R2 U2 F R2 F' U2 R' U R'",
    F2L_38: "R U R' U' R U2 R' U' R U R'",
    F2L_39: "R U R' U2 R U' R' U R U R'",
    F2L_40: "R U' R' U F' U2 F",
    F2L_41: "R U' R' r U' r' U2 r U r'",
};

export const COLORS = {
    white: 0xffffff,
    yellow: 0xffff00,
    red: 0xb71234,
    orange: 0xff5800,
    green: 0x009b48,
    blue: 0x0046ad,
};

export const OPPOSITES: any = {
    white: "yellow",
    yellow: "white",
    red: "orange",
    orange: "red",
    green: "blue",
    blue: "green",
};

export const ORIENT_TO_TOP: any = {
    white: "",
    yellow: "x2",
    green: "x",
    blue: "x'",
    red: "z'",
    orange: "z",
};

export const OCLL_NAMES: Record<string, string> = {
    OLL_21: "H",
    OLL_22: "Pi",
    OLL_23: "U",
    OLL_24: "T",
    OLL_25: "L",
    OLL_26: "As",
    OLL_27: "S",
};
