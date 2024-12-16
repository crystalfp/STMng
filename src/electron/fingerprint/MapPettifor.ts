/**
 * Table of coefficients for the Pettifor correction to the diffraction spectra.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-16
 */

interface PettiforData {
	mendeleevNumber: number;
	chemicalScale: number;
};

const coefficients: PettiforData[] = [
    /*   0  "Xx" */	{mendeleevNumber:  -1, chemicalScale:-1.0000},
    /*   1  "H" */	{mendeleevNumber: 103, chemicalScale: 5.0000},
    /*   2  "He" */	{mendeleevNumber:   1, chemicalScale: 0.0000},
    /*   3  "Li" */	{mendeleevNumber:  12, chemicalScale: 0.4500},
    /*   4  "Be" */	{mendeleevNumber:  77, chemicalScale: 1.5000},
    /*   5  "B" */	{mendeleevNumber:  86, chemicalScale: 2.0000},
    /*   6  "C" */	{mendeleevNumber:  95, chemicalScale: 2.5000},
    /*   7  "N" */	{mendeleevNumber: 100, chemicalScale: 3.0000},
    /*   8  "O" */	{mendeleevNumber: 101, chemicalScale: 3.5000},
    /*   9  "F" */	{mendeleevNumber: 102, chemicalScale: 4.0000},
    /*  10  "Ne" */	{mendeleevNumber:   2, chemicalScale: 0.0400},
    /*  11  "Na" */	{mendeleevNumber:  11, chemicalScale: 0.4000},
    /*  12  "Mg" */	{mendeleevNumber:  73, chemicalScale: 1.2800},
    /*  13  "Al" */	{mendeleevNumber:  80, chemicalScale: 1.6600},
    /*  14  "Si" */	{mendeleevNumber:  85, chemicalScale: 1.9400},
    /*  15  "P" */	{mendeleevNumber:  90, chemicalScale: 2.1800},
    /*  16  "S" */	{mendeleevNumber:  94, chemicalScale: 2.4400},
    /*  17  "Cl" */	{mendeleevNumber:  99, chemicalScale: 2.7000},
    /*  18  "Ar" */	{mendeleevNumber:   3, chemicalScale: 0.0800},
    /*  19  "K" */	{mendeleevNumber:  10, chemicalScale: 0.3500},
    /*  20  "Ca" */	{mendeleevNumber:  16, chemicalScale: 0.6000},
    /*  21  "Sc" */	{mendeleevNumber:  20, chemicalScale: 0.6700},
    /*  22  "Ti" */	{mendeleevNumber:  51, chemicalScale: 0.7900},
    /*  23  "V" */	{mendeleevNumber:  54, chemicalScale: 0.8400},
    /*  24  "Cr" */	{mendeleevNumber:  57, chemicalScale: 0.8900},
    /*  25  "Mn" */	{mendeleevNumber:  60, chemicalScale: 0.9450},
    /*  26  "Fe" */	{mendeleevNumber:  61, chemicalScale: 0.9900},
    /*  27  "Co" */	{mendeleevNumber:  64, chemicalScale: 1.0400},
    /*  28  "Ni" */	{mendeleevNumber:  67, chemicalScale: 1.0900},
    /*  29  "Cu" */	{mendeleevNumber:  72, chemicalScale: 1.2000},
    /*  30  "Zn" */	{mendeleevNumber:  76, chemicalScale: 1.4400},
    /*  31  "Ga" */	{mendeleevNumber:  81, chemicalScale: 1.6800},
    /*  32  "Ge" */	{mendeleevNumber:  84, chemicalScale: 1.9000},
    /*  33  "As" */	{mendeleevNumber:  89, chemicalScale: 2.1600},
    /*  34  "Se" */	{mendeleevNumber:  93, chemicalScale: 2.4000},
    /*  35  "Br" */	{mendeleevNumber:  98, chemicalScale: 2.6400},
    /*  36  "Kr" */	{mendeleevNumber:   4, chemicalScale: 0.1200},
    /*  37  "Rb" */	{mendeleevNumber:   9, chemicalScale: 0.3000},
    /*  38  "Sr" */	{mendeleevNumber:  15, chemicalScale: 0.5500},
    /*  39  "Y" */	{mendeleevNumber:  19, chemicalScale: 0.6600},
    /*  40  "Zr" */	{mendeleevNumber:  49, chemicalScale: 0.7600},
    /*  41  "Nb" */	{mendeleevNumber:  52, chemicalScale: 0.8200},
    /*  42  "Mo" */	{mendeleevNumber:  55, chemicalScale: 0.8800},
    /*  43  "Tc" */	{mendeleevNumber:  58, chemicalScale: 0.9350},
    /*  44  "Ru" */	{mendeleevNumber:  63, chemicalScale: 1.0000},
    /*  45  "Rh" */	{mendeleevNumber:  66, chemicalScale: 1.0600},
    /*  46  "Pd" */	{mendeleevNumber:  69, chemicalScale: 1.1200},
    /*  47  "Ag" */	{mendeleevNumber:  71, chemicalScale: 1.1800},
    /*  48  "Cd" */	{mendeleevNumber:  75, chemicalScale: 1.3600},
    /*  49  "In" */	{mendeleevNumber:  79, chemicalScale: 1.6000},
    /*  50  "Sn" */	{mendeleevNumber:  83, chemicalScale: 1.8400},
    /*  51  "Sb" */	{mendeleevNumber:  88, chemicalScale: 2.0800},
    /*  52  "Te" */	{mendeleevNumber:  92, chemicalScale: 2.3200},
    /*  53  "I" */	{mendeleevNumber:  97, chemicalScale: 2.5600},
    /*  54  "Xe" */	{mendeleevNumber:   5, chemicalScale: 0.1600},
    /*  55  "Cs" */	{mendeleevNumber:   8, chemicalScale: 0.2500},
    /*  56  "Ba" */	{mendeleevNumber:  14, chemicalScale: 0.5000},
    /*  57  "La" */	{mendeleevNumber:  33, chemicalScale: 0.7050},
    /*  58  "Ce" */	{mendeleevNumber:  32, chemicalScale: 0.7025},
    /*  59  "Pr" */	{mendeleevNumber:  31, chemicalScale: 0.7000},
    /*  60  "Nd" */	{mendeleevNumber:  30, chemicalScale: 0.6975},
    /*  61  "Pm" */	{mendeleevNumber:  29, chemicalScale: 0.6950},
    /*  62  "Sm" */	{mendeleevNumber:  28, chemicalScale: 0.6925},
    /*  63  "Eu" */	{mendeleevNumber:  18, chemicalScale: 0.6550},
    /*  64  "Gd" */	{mendeleevNumber:  27, chemicalScale: 0.6900},
    /*  65  "Tb" */	{mendeleevNumber:  26, chemicalScale: 0.6875},
    /*  66  "Dy" */	{mendeleevNumber:  25, chemicalScale: 0.6850},
    /*  67  "Ho" */	{mendeleevNumber:  24, chemicalScale: 0.6825},
    /*  68  "Er" */	{mendeleevNumber:  23, chemicalScale: 0.6800},
    /*  69  "Tm" */	{mendeleevNumber:  22, chemicalScale: 0.6775},
    /*  70  "Yb" */	{mendeleevNumber:  17, chemicalScale: 0.6450},
    /*  71  "Lu" */	{mendeleevNumber:  21, chemicalScale: 0.6750},
    /*  72  "Hf" */	{mendeleevNumber:  50, chemicalScale: 0.7750},
    /*  73  "Ta" */	{mendeleevNumber:  53, chemicalScale: 0.8300},
    /*  74  "W" */	{mendeleevNumber:  56, chemicalScale: 0.8850},
    /*  75  "Re" */	{mendeleevNumber:  59, chemicalScale: 0.9400},
    /*  76  "Os" */	{mendeleevNumber:  62, chemicalScale: 0.9950},
    /*  77  "Ir" */	{mendeleevNumber:  65, chemicalScale: 1.0500},
    /*  78  "Pt" */	{mendeleevNumber:  68, chemicalScale: 1.1050},
    /*  79  "Au" */	{mendeleevNumber:  70, chemicalScale: 1.1600},
    /*  80  "Hg" */	{mendeleevNumber:  74, chemicalScale: 1.3200},
    /*  81  "Tl" */	{mendeleevNumber:  78, chemicalScale: 1.5600},
    /*  82  "Pb" */	{mendeleevNumber:  82, chemicalScale: 1.8000},
    /*  83  "Bi" */	{mendeleevNumber:  87, chemicalScale: 2.0400},
    /*  84  "Po" */	{mendeleevNumber:  91, chemicalScale: 2.2800},
    /*  85  "At" */	{mendeleevNumber:  96, chemicalScale: 2.5200},
    /*  86  "Rn" */	{mendeleevNumber:   6, chemicalScale: 0.2000},
    /*  87  "Fr" */	{mendeleevNumber:   7, chemicalScale: 0.2300},
    /*  88  "Ra" */	{mendeleevNumber:  13, chemicalScale: 0.4800},
    /*  89  "Ac" */	{mendeleevNumber:  48, chemicalScale: 0.7425},
    /*  90  "Th" */	{mendeleevNumber:  47, chemicalScale: 0.7400},
    /*  91  "Pa" */	{mendeleevNumber:  46, chemicalScale: 0.7375},
    /*  92  "U" */	{mendeleevNumber:  45, chemicalScale: 0.7350},
    /*  93  "Np" */	{mendeleevNumber:  44, chemicalScale: 0.7325},
    /*  94  "Pu" */	{mendeleevNumber:  43, chemicalScale: 0.7300},
    /*  95  "Am" */	{mendeleevNumber:  42, chemicalScale: 0.7275},
    /*  96  "Cm" */	{mendeleevNumber:  41, chemicalScale: 0.7250},
    /*  97  "Bk" */	{mendeleevNumber:  40, chemicalScale: 0.7225},
    /*  98  "Cf" */	{mendeleevNumber:  39, chemicalScale: 0.7200},
    /*  99  "Es" */	{mendeleevNumber:  38, chemicalScale: 0.7175},
    /* 100  "Fm" */	{mendeleevNumber:  37, chemicalScale: 0.7150},
    /* 101  "Md" */	{mendeleevNumber:  36, chemicalScale: 0.7125},
    /* 102  "No" */	{mendeleevNumber:  35, chemicalScale: 0.7100},
    /* 103  "Lr" */	{mendeleevNumber:  34, chemicalScale: 0.7075}
];
const MAX_PETTIFOR_Z = coefficients.length-1;

/**
 * Get the Mendeleev number for a given atom type
 *
 * @param z - Atom Z value
 * @returns The Mendeleev number
 */
export const MapMendeleev = (z: number): number =>
    (z > MAX_PETTIFOR_Z ? 0 : coefficients[z].mendeleevNumber);

/**
 * Get the chemical scale correction for a given atom type
 *
 * @param z - Atom Z value
 * @returns The chemical scale correction
 */
export const MapChemScale = (z: number): number =>
    (z > MAX_PETTIFOR_Z ? 0 : coefficients[z].chemicalScale);
