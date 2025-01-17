/**
 * Table of coefficients for the Chemical Scale weights for the diffraction spectra.
 *
 * @packageDocumentation
 *
 * @remarks The table is extracted from Table 2 of:
 *
 * Zahed Allahyari and Artem R. Oganov, Nonempirical Definition of the Mendeleev Numbers: Organizing the
 * Chemical Space, The Journal of Physical Chemistry C 2020 124 (43), 23867-23878,
 * DOI: 10.1021/acs.jpcc.0c07857

 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-17
 */
const chemicalScale: number[] = [
	/*  0 "Xx" */ -1.000,
	/*  1 "H"  */  0.000,
	/*  2 "He" */  0.077,
	/*  3 "Li" */  0.272,
	/*  4 "Be" */  0.411,
	/*  5 "B"  */  0.486,
	/*  6 "C"  */  0.606,
	/*  7 "N"  */  0.662,
	/*  8 "O"  */  0.827,
	/*  9 "F"  */  0.834,
	/* 10 "Ne" */  0.843,
	/* 11 "Na" */  0.871,
	/* 12 "Mg" */  0.892,
	/* 13 "Al" */  0.984,
	/* 14 "Si" */  1.011,
	/* 15 "P"  */  1.012,
	/* 16 "S"  */  1.041,
	/* 17 "Cl" */  1.061,
	/* 18 "Ar" */  1.063,
	/* 19 "K"  */  1.071,
	/* 20 "Ca" */  1.081,
	/* 21 "Sc" */  1.091,
	/* 22 "Ti" */  1.094,
	/* 23 "V"  */  1.101,
	/* 24 "Cr" */  1.107,
	/* 25 "Mn" */  1.116,
	/* 26 "Fe" */  1.141,
	/* 27 "Co" */  1.144,
	/* 28 "Ni" */  1.218,
	/* 29 "Cu" */  1.232,
	/* 30 "Zn" */  1.257,
	/* 31 "Ga" */  1.263,
	/* 32 "Ge" */  1.266,
	/* 33 "As" */  1.276,
	/* 34 "Se" */  1.281,
	/* 35 "Br" */  1.304,
	/* 36 "Kr" */  1.385,
	/* 37 "Rb" */  1.396,
	/* 38 "Sr" */  1.397,
	/* 39 "Y"  */  1.401,
	/* 40 "Zr" */  1.416,
	/* 41 "Nb" */  1.425,
	/* 42 "Mo" */  1.433,
	/* 43 "Tc" */  1.442,
	/* 44 "Ru" */  1.449,
	/* 45 "Rh" */  1.458,
	/* 46 "Pd" */  1.477,
	/* 47 "Ag" */  1.502,
	/* 48 "Cd" */  1.503,
	/* 49 "In" */  1.513,
	/* 50 "Sn" */  1.514,
	/* 51 "Sb" */  1.517,
	/* 52 "Te" */  1.560,
	/* 53 "I"  */  1.566,
	/* 54 "Xe" */  1.571,
	/* 55 "Cs" */  1.594,
	/* 56 "Ba" */  1.601,
	/* 57 "La" */  1.620,
	/* 58 "Ce" */  1.646,
	/* 59 "Pr" */  1.661,
	/* 60 "Nd" */  1.676,
	/* 61 "Pm" */  1.702,
	/* 62 "Sm" */  1.710,
	/* 63 "Eu" */  1.710,
	/* 64 "Gd" */  1.733,
	/* 65 "Tb" */  1.735,
	/* 66 "Dy" */  1.750,
	/* 67 "Ho" */  1.760,
	/* 68 "Er" */  1.804,
	/* 69 "Tm" */  1.810,
	/* 70 "Yb" */  1.824,
	/* 71 "Lu" */  1.827,
	/* 72 "Hf" */  1.845,
	/* 73 "Ta" */  1.847,
	/* 74 "W"  */  1.877,
	/* 75 "Re" */  1.885,
	/* 76 "Os" */  1.890,
	/* 77 "Ir" */  1.905,
	/* 78 "Pt" */  1.913,
	/* 79 "Au" */  1.931,
	/* 80 "Hg" */  1.937,
	/* 81 "Tl" */  1.953,
	/* 82 "Pb" */  1.970,
	/* 83 "Bi" */  1.973,
	/* 84 "Po" */  1.997,
	/* 85 "At" */  2.027,
	/* 86 "Rn" */  2.106,
	/* 87 "Fr" */  2.116,
	/* 88 "Ra" */  2.120,
	/* 89 "Ac" */  2.332,
	/* 90 "Th" */  2.366,
	/* 91 "Pa" */  2.373,
	/* 92 "U"  */  2.418,
	/* 93 "Np" */  2.430,
	/* 94 "Pu" */  2.675,
	/* 95 "Am" */  2.849,
	/* 96 "Cm" */  3.080,
];

const MAX_CHEMICAL_SCALE_Z = chemicalScale.length-1;

/**
 * Get the chemical scale correction for a given atom type
 *
 * @param z - Atom Z value
 * @returns The chemical scale correction
 */
export const MapChemicalScale = (z: number): number =>
    (z > MAX_CHEMICAL_SCALE_Z ? 0 : chemicalScale[z]);
