/**
 * Computes the X-Ray diffraction pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-10-26
 */

import {Lattice} from "./Lattice";
import {ReciprocalLattice, type ReciprocalPoint} from "./ReciprocalLattice";
import {ATOMIC_SCATTERING_PARAMS} from "./AtomicScatteringParams";
import {getAtomicSymbol} from "./AtomData";
import type {Structure, PositionType} from "@/types";

/** Type of the XRD calculator output */
export interface DiffractionPatternResult {

    /** Peak position */
	twoTheta: number[];

    /** Peak intensity */
	intensity: number[];

    /** Label with hkl values and related multiplicity */
    label: string[];
}

/** XRD wavelengths in angstroms */
const WAVELENGTHS: Record<string, number> = {
    CuKa:  1.54184,
    CuKa2: 1.54439,
    CuKa1: 1.54056,
    CuKb1: 1.39222,
    MoKa:  0.71073,
    MoKa2: 0.71359,
    MoKa1: 0.70930,
    MoKb1: 0.63229,
    CrKa:  2.29100,
    CrKa2: 2.29361,
    CrKa1: 2.28970,
    CrKb1: 2.08487,
    FeKa:  1.93735,
    FeKa2: 1.93998,
    FeKa1: 1.93604,
    FeKb1: 1.75661,
    CoKa:  1.79026,
    CoKa2: 1.79285,
    CoKa1: 1.78896,
    CoKb1: 1.63079,
    AgKa:  0.560885,
    AgKa2: 0.563813,
    AgKa1: 0.559421,
    AgKb1: 0.497082,
};

/**
 * Compute the X-Ray diffraction pattern of a crystal structure
 */
export class XRDCalculator {

    /** Wavelength for the X-Ray radiation. Defaults to "CuKa", i.e, Cu K_alpha radiation */
	private wavelength = WAVELENGTHS.CuKa;

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
       Defaults to "CuKa", i.e, Cu K_alpha radiation.
	 * @param scaled - Whether to return scaled intensities. The maximum peak is set to a value of 100.
       Defaults to true. Use false if you need the absolute values to combine XRD plots.
	 * @param thetaLow - Low value for range of two_thetas to calculate in degrees. Defaults to 0.
	 * @param thetaHigh - High value for range of two_thetas to calculate in degrees. Defaults to 90.
	 * @returns The computed diffraction pattern
     * @throws Error.
     * Unable to calculate XRD pattern as there is no scattering coefficients for specie
	 */
    getDiffractionPattern(structure: Structure,
                          wavelengthCode="CuKa",
                          scaled=true,
                          thetaLow=0,
                          thetaHigh=90,
                          wavelengthNumeric=1.5): DiffractionPatternResult {

        // Convert the wavelength symbol to the numeric wavelength
        this.wavelength = wavelengthCode === "Manual" ?
                                wavelengthNumeric :
                                (WAVELENGTHS[wavelengthCode] ?? WAVELENGTHS.CuKa);

        // Obtained from Bragg condition.
		// Remember that reciprocal lattice vector length is 1 / d_hkl.
        // rLimits is [min_r, max_r]
        const rLimits = [2 * Math.sin((thetaLow  * Math.PI/180) / 2) / this.wavelength,
                         2 * Math.sin((thetaHigh * Math.PI/180) / 2) / this.wavelength];

		// Load the structure and check if it is hexagonal
		const lattice = new Lattice(structure);
		const isHex = lattice.isHexagonal();

        // Obtain crystallographic reciprocal lattice points within range
        const reciprocalLattice = new ReciprocalLattice(lattice);
        let reciprocalPoints = reciprocalLattice.getPointsInSphereOrigin(rLimits[1]);
        if(rLimits[0]) reciprocalPoints = reciprocalPoints.filter((pt: ReciprocalPoint) => pt.dist >= rLimits[0]);

        // Create a flattened array of zs, coeffs, frac_coords and occus. This is used to perform
        // vectorized computation of atomic scattering factors later. Note that these are not
        // necessarily the same size as the structure as each partially occupied specie occupies its
        // own position in the flattened array.
        const zs: number[] = [];
        const coeffs: number[][][] = [];
        const fracCoords: PositionType[] = [];
        const occus: number[] = [];
        const dwFactors: number[] = [];
        for(const atom of structure.atoms) {
			zs.push(atom.atomZ);
			const symbol = getAtomicSymbol(atom.atomZ);
			const scatteringParams = ATOMIC_SCATTERING_PARAMS[symbol];
			if(!scatteringParams) throw Error(`Unable to calculate XRD pattern as there is no scattering coefficients for ${symbol}.`);

			coeffs.push(scatteringParams);
			fracCoords.push(lattice.toFractionalCoordinates(atom.position));
            occus.push(1);
            dwFactors.push(0);
		}

        const peaks: Record<string, [number, [number[]], number]> = {};
        const twoThetas: number[] = [];
        const TOL = 1e-17;

        reciprocalPoints.sort((a, b) => {

            let delta = a.dist - b.dist;
            if(delta !== 0) return delta;
            delta = b.coord[0] - a.coord[0];
            if(delta !== 0) return delta;
            delta = b.coord[10] - a.coord[1];
            if(delta !== 0) return delta;
            delta = b.coord[2] - a.coord[2];
            if(delta !== 0) return delta;
            return 0;
        });

        for(const pt of reciprocalPoints) {

            const gHKL = pt.dist;
            if(gHKL < TOL) continue;

            // Force miller indices to be integers
            let hkl = [Math.round(pt.coord[0]), Math.round(pt.coord[1]), Math.round(pt.coord[2])];

            // Bragg condition
            const halfDist = gHKL / 2;
            const theta = Math.asin(this.wavelength * halfDist);

            // Store s^2 since we are using it a few times
            const halfDistSquared = halfDist**2;

            // Computation of g.r for all fractional coords and hkl
            const gDotR: number[] = [];
            for(const fc of fracCoords) {
                gDotR.push(fc[0]*hkl[0]+fc[1]*hkl[1]+fc[2]*hkl[2]);
            }

            // Computation of atomic scattering factors.
            const fs: number[] = [];
            for(let i=0; i < zs.length; ++i) {

                let sum = 0;
                for(const c of coeffs[i]) sum += c[0]*Math.exp(-c[1]*halfDistSquared);
                fs.push(zs[i] - 41.78214 * halfDistSquared * sum);
            }
            const dwCorrection = dwFactors.map((dwf) => Math.exp(-dwf * halfDistSquared));

            // Structure factor = sum of atomic scattering factors (with
            // position factor exp(2j * pi * g.r and occupancies).
            // The two elements of the tuple are the real and imaginary parts
            const fHKL: [number, number] = [0, 0];
            for(let i=0; i < fs.length; ++i) {
                const multiplier = fs[i] * occus[i] * dwCorrection[i];
                const value = Math.PI*2*gDotR[i];
                fHKL[0] += multiplier*Math.cos(value);
                fHKL[1] += multiplier*Math.sin(value);
            }

            // Lorentz polarization correction for hkl
            const lorentzFactor = (1 + Math.cos(2 * theta) ** 2) / (Math.sin(theta) ** 2 * Math.cos(theta));

            // Intensity for hkl is modulus square of structure factor
            const iHKL = fHKL[0] * fHKL[0] + fHKL[1] * fHKL[1];

            const twoTheta = 2 * theta * 180 / Math.PI;

            // Use Miller-Bravais indices for hexagonal lattices
            if(isHex) {
                hkl = [hkl[0], hkl[1], -hkl[0] - hkl[1], hkl[2]];
            }
            const inds: number[] = [];
            for(let i=0; i < twoThetas.length; ++i) {
                const delta = twoThetas[i] - twoTheta;
                if(delta < 1e-5 && delta > -1e-5) inds.push(i);
            }

            // Deal with floating point precision issues
            if(inds.length > 0) {
                const key = twoThetas[inds[0]].toString();
                peaks[key][0] += iHKL * lorentzFactor;
                peaks[key][1].push(hkl);
            }
            else {
                peaks[twoTheta.toString()] = [iHKL * lorentzFactor, [hkl], 1 / gHKL];
                twoThetas.push(twoTheta);
            }
        }

        let maxIntensity = -1;
        const keys: string[] = [];
        for(const key in peaks) {

            const intensity = peaks[key][0];
            if(intensity > maxIntensity) maxIntensity = intensity;
            keys.push(key);
        }

        const toSort: {twoTheta: number; intensity: number; label: string}[] = [];
        // Changed from const SCALED_INTENSITY_TOL = 0.001; to reduce the chart noise
        const SCALED_INTENSITY_TOL = 1;
        for(const key of keys) {

            const scaledIntensity = peaks[key][0] / maxIntensity * 100;
            if(scaledIntensity > SCALED_INTENSITY_TOL) {

                toSort.push({twoTheta: Number.parseFloat(key),
                             intensity: scaled ? scaledIntensity : peaks[key][0],
                             label: this.getUniqueFamilies(peaks[key][1])});
            }
        }

        // Sort peaks in ascending order
        toSort.sort((a, b) => a.twoTheta - b.twoTheta);

        const dp: DiffractionPatternResult = {twoTheta: [], intensity: [], label: []};
        for(const entry of toSort) {
            dp.twoTheta.push(entry.twoTheta);
            dp.intensity.push(entry.intensity);
            dp.label.push(entry.label);
        }

		return dp;
	}

    /**
     * Verify if two hkl codes are one the permutation of the other
     *
     * @param hkl1 - First hkl code to compare
     * @param hkl2 - Second hkl code to compare
     * @returns True if one is a permutation of the other
     */
    private static isPermutation(hkl1: number[], hkl2: number[]): boolean {

        const thkl1 = hkl1.map((nn) => (nn < 0 ? -nn : nn)).toSorted((a, b) => (a - b));
        const thkl2 = hkl2.map((nn) => (nn < 0 ? -nn : nn)).toSorted((a, b) => (a - b));

        const len1 = thkl1.length;
        if(len1 !== thkl2.length) return false;
        for(let i=0; i < len1; ++i) if(thkl1[i] !== thkl2[i]) return false;
        return true;
    }

    /**
     * Get unique families of Miller indices. Families must be permutations of each other
     *
     * @param hkls - ([h, k, l]): List of Miller indices
     * @returns Label for the peak
     */
    private getUniqueFamilies(hkls: [number[]]): string {

        const unique: Record<string, {idx: number[]; val: number[][]}> = {};
        for(const hkl of hkls) {

            let found = false;
            for(const key in unique) {

                const item = unique[key];
                if(XRDCalculator.isPermutation(hkl, item.idx)) {
                    found = true;
                    item.val.push(hkl);
                }
            }
            if(!found) unique[hkl.join(",")] = {idx: hkl, val: [hkl]};
        }

        let out = "";
        for(const key in unique) {

            const item = unique[key];

            // Find the maximum
            item.val.sort((a, b) => {
                for(let i=0; i < a.length; ++i) {

                    if(a[i] !== b[i]) return b[i]-a[i];
                }
                return 0;
            });

            if(out !== "") out += "\n";
            out += `(${item.val[0].join(", ")}): ${item.val.length}`;
        }
        return out;
    }
}
