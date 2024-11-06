/**
 * Computes the XRD pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-26
 */

import type {Structure} from "@/types";
// import {Lattice} from "./Lattice";
// import {ReciprocalLattice} from "./ReciprocalLattice";
// import {ATOMIC_SCATTERING_PARAMS} from "./AtomicScatteringParams";
// import {getAtomicSymbol} from "./AtomData";

/** Type of the XRD calculator output */
export interface DiffractionPatternResult {
	twoTheta: number[];
	intensity: number[];
}

// XRD wavelengths in angstroms
const WAVELENGTHS: Record<string, number> = {
    "CuKa":  1.54184,
    "CuKa2": 1.54439,
    "CuKa1": 1.54056,
    "CuKb1": 1.39222,
    "MoKa":  0.71073,
    "MoKa2": 0.71359,
    "MoKa1": 0.70930,
    "MoKb1": 0.63229,
    "CrKa":  2.29100,
    "CrKa2": 2.29361,
    "CrKa1": 2.28970,
    "CrKb1": 2.08487,
    "FeKa":  1.93735,
    "FeKa2": 1.93998,
    "FeKa1": 1.93604,
    "FeKb1": 1.75661,
    "CoKa":  1.79026,
    "CoKa2": 1.79285,
    "CoKa1": 1.78896,
    "CoKb1": 1.63079,
    "AgKa":  0.560885,
    "AgKa2": 0.563813,
    "AgKa1": 0.559421,
    "AgKb1": 0.497082,
};

export class XRDCalculator {

    /** Wavelength for the X-Ray radiation. Defaults to "CuKa", i.e, Cu K_alpha radiation */
	private wavelength = WAVELENGTHS["CuKa"];

	/**
	 * Returns the list of available wavelengths symbols
	 *
	 * @returns The list of available wavelengths symbols
	 */
	getWavelengthNames(): string[] {

		return Object.keys(WAVELENGTHS);
	}

	/**
	 * Calculates the diffraction pattern for a structure.
	 *
	 * @param structure - Input structure
     * @param wavelengthCode - The symbol that identify the wavelength used.
     *          Defaults to "CuKa", i.e, Cu K_alpha radiation.
	 * @param scaled - Whether to return scaled intensities. The maximum
     *          peak is set to a value of 100. Defaults to true. Use false if
     *          you need the absolute values to combine XRD plots.
	 * @param thetaLow - Low value for range of two_thetas to calculate in degrees. Defaults to 0.
	 * @param thetaHigh - High value for range of two_thetas to calculate in degrees. Defaults to 90.
	 * @returns The computed diffraction pattern
	 */
    getDiffractionPattern(structure: Structure,
                          wavelengthCode="CuKa",
                          scaled=true,
                          thetaLow=0,
                          thetaHigh=90): DiffractionPatternResult {

        // Convert the wavelength symbol to the numeric wavelength
        this.wavelength = WAVELENGTHS[wavelengthCode] ?? WAVELENGTHS["CuKa"];

		// TBD
		void scaled;
        void structure;
        void thetaLow;
        void thetaHigh;
        void this.wavelength;

		return {
			twoTheta:  [28.46772426, 47.34657519, 56.17571327, 69.19895076, 76.45494946, 88.1268895],
			intensity: [100.0000000, 66.64746966, 39.58448396, 10.71251618, 16.34081066, 23.50766372]
		};
	}
}
