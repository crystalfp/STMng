/**
 * Computes the XRD pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-26
 */

import type {Structure} from "../src/types"; // TBD
// import type {Structure} from "@/types";
import {Lattice} from "./Lattice";
import {ReciprocalLattice} from "./ReciprocalLattice";
import {ATOMIC_SCATTERING_PARAMS} from "./AtomicScatteringParams";
// import {getAtomicSymbol} from "./AtomData";
const getAtomicSymbol = (_Z: number): string => "Si"; // TBD

interface DiffractionPattern {
	twoTheta: number[];
	intensity: number[];
}

// XRD wavelengths in angstroms
const WAVELENGTHS: Record<string, number> = {
    "CuKa": 1.54184,
    "CuKa2": 1.54439,
    "CuKa1": 1.54056,
    "CuKb1": 1.39222,
    "MoKa": 0.71073,
    "MoKa2": 0.71359,
    "MoKa1": 0.70930,
    "MoKb1": 0.63229,
    "CrKa": 2.29100,
    "CrKa2": 2.29361,
    "CrKa1": 2.28970,
    "CrKb1": 2.08487,
    "FeKa": 1.93735,
    "FeKa2": 1.93998,
    "FeKa1": 1.93604,
    "FeKb1": 1.75661,
    "CoKa": 1.79026,
    "CoKa2": 1.79285,
    "CoKa1": 1.78896,
    "CoKb1": 1.63079,
    "AgKa": 0.560885,
    "AgKa2": 0.563813,
    "AgKa1": 0.559421,
    "AgKb1": 0.497082,
};

export class XRDCalculator {

	private readonly wavelength;

	/**
	 * Initialize the XRD calculator with a given radiation.
	 *
	 * @param wavelength - The wavelength can be specified as either a
                number or a string. If it is a string, it must be one of the
                supported definitions. If it is a number, it is interpreted as a wavelength in
                angstroms. Defaults to "CuKa", i.e, Cu K_alpha radiation.
	 */
	constructor(wavelength?: string | number) {

		if(typeof wavelength === "number") {
			this.wavelength = wavelength;
		}
		else if(typeof wavelength === "string") {
			this.wavelength = WAVELENGTHS[wavelength] ?? WAVELENGTHS["CuKa"];
		}
		else {
			this.wavelength = WAVELENGTHS["CuKa"];
		}
	}

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
	 * @param scaled - Whether to return scaled intensities. The maximum
                peak is set to a value of 100. Defaults to true. Use false if
                you need the absolute values to combine XRD plots.
	 * @param twoThetaRange - Tuple for range of
                two_thetas to calculate in degrees. Defaults to (0, 90). Set to
                undefined if you want all diffracted beams within the limiting
                sphere of radius 2 / wavelength.
	 * @returns The Diffraction Pattern
	 */
    getDiffractionPattern(structure: Structure, scaled=true, twoThetaRange=[0, 90]): DiffractionPattern {

		// Load the structure and check if it is hexagonal
		const lattice = new Lattice(structure);
		const isHex = lattice.isHexagonal();

        // Obtained from Bragg condition.
		// Note that reciprocal lattice vector length is 1 / d_hkl.
        // rLimits is [min_r, max_r]
        const rLimits = twoThetaRange === undefined ? [0, 2 / this.wavelength] :
            [2 * Math.sin((twoThetaRange[0] * Math.PI/180) / 2) / this.wavelength,
             2 * Math.sin((twoThetaRange[1] * Math.PI/180) / 2) / this.wavelength];

        // Obtain crystallographic reciprocal lattice points within range
        const reciprocalLattice = new ReciprocalLattice(lattice);
        let reciprocalPoints = reciprocalLattice.getPointsInSphereOrigin(rLimits[1]);
        if(rLimits[0]) reciprocalPoints = reciprocalPoints.filter((pt) => pt[1] >= rLimits[0]);
console.log(reciprocalPoints)
        // Create a flattened array of zs, coeffs, frac_coords and occus. This is used to perform
        // vectorized computation of atomic scattering factors later. Note that these are not
        // necessarily the same size as the structure as each partially occupied specie occupies its
        // own position in the flattened array.
        const zs: number[] = [];
        const coeffs: number[][][] = [];
        const frac_coords: number[][] = [];
        const occus: number[] = [];
        const dw_factors: number[] = [];
        for(const atom of structure.atoms) {
			zs.push(atom.atomZ);
			const symbol = getAtomicSymbol(atom.atomZ);
			const scatteringParams = ATOMIC_SCATTERING_PARAMS[symbol];
			if(!scatteringParams) throw Error(`Unable to calculate XRD pattern as there is no scattering coefficients for ${symbol}.`);

			coeffs.push(scatteringParams);
			frac_coords.push(lattice.toFractionalCoordinates(atom.position));
            occus.push(1);
            dw_factors.push(0);
		}

        // const peaks: dict[float, list[float | list[tuple[int, ...]]]] = {}
        const peaks = {};
        const two_thetas: number[] = [];
        const TOL = 1e-17

        reciprocalPoints.sort((a, b) => {

            let delta = a.dist - b.dist;
            // if(delta > TOL || delta < -TOL) return delta;
            if(delta !== 0) return delta;
            delta = b.coord[0] - a.coord[0]
            if(delta !== 0) return delta;
            delta = b.coord[10] - a.coord[1]
            if(delta !== 0) return delta;
            delta = b.coord[2] - a.coord[2]
            if(delta !== 0) return delta;
            return 0;
        })

        for(const pt of reciprocalPoints) {

            const g_hkl = pt.dist;
            if(g_hkl < TOL) continue;

            // Force miller indices to be integers
            let hkl = [Math.round(pt.coord[0]), Math.round(pt.coord[1]), Math.round(pt.coord[2])];

            // Bragg condition
            const s = g_hkl / 2;
            const theta = Math.asin(this.wavelength * s);

            // Store s^2 since we are using it a few times
            const s2 = s**2

            // Computation of g.r for all fractional coords and hkl
            const g_dot_r: number[] = [];
            for(const fc of frac_coords) {
                g_dot_r.push(fc[0]*hkl[0]+fc[1]*hkl[1]+fc[2]*hkl[2]);
            }

            // Computation of atomic scattering factors.
            const fs: number[] = [];
            for(let i=0; i < zs.length; ++i) {

                let sum = 0
                // for(const c of coeffs[i]) console.log("Z", hkl, zs[i], c)
                for(const c of coeffs[i]) sum += c[0]*Math.exp(-c[1]*s2)
                // const value = zs[i] - 41.78214 * s2 * sum;
                fs.push(zs[i] - 41.78214 * s2 * sum);
            }
            const dw_correction = dw_factors.map((dwf) => Math.exp(-dwf * s2))

            // Structure factor = sum of atomic scattering factors (with
            // position factor exp(2j * pi * g.r and occupancies).
            // The two elements of the tuple are the real and imaginary parts
            const f_hkl: [number, number] = [0, 0];
            for(let i=0; i < fs.length; ++i) {
                const h = fs[i] * occus[i] * dw_correction[i];
                const x = Math.PI*2*g_dot_r[i];
                f_hkl[0] += h*Math.cos(x);
                f_hkl[1] += h*Math.sin(x);
            }

            // Lorentz polarization correction for hkl
            const lorentz_factor = (1 + Math.cos(2 * theta) ** 2) / (Math.sin(theta) ** 2 * Math.cos(theta))

            // Intensity for hkl is modulus square of structure factor
            const i_hkl = f_hkl[0] * f_hkl[0] + f_hkl[1] * f_hkl[1];

            const two_theta = 2 * theta * 180 / Math.PI;

            // Use Miller-Bravais indices for hexagonal lattices
            if(isHex) {
                hkl = [hkl[0], hkl[1], -hkl[0] - hkl[1], hkl[2]];
            }
            const inds: number[] = [];
            for(let i=0; i < two_thetas.length; ++i) {
                const delta = two_thetas[i] - two_theta;
                if(delta < 1e-5 && delta > -1e-5) inds.push(i)
            }

            // Deal with floating point precision issues
            if(inds.length > 0) {
                peaks[two_thetas[inds[0]]][0] += i_hkl * lorentz_factor;
                peaks[two_thetas[inds[0]]][1].push(hkl);
            }
            else {
                peaks[two_theta] = [i_hkl * lorentz_factor, [hkl], 1 / g_hkl]
                two_thetas.push(two_theta)
            }
        }

        let max_intensity = -1;
        const keys: string[] = [];
        const x: number[] = [];
        for(const p in peaks) {
            const pt = peaks[p]
            // console.log(p, pt[0], pt[1], pt[2])
            if(pt[0] > max_intensity) max_intensity = pt[0]
            keys.push(p)
        }
        keys.sort();

        const SCALED_INTENSITY_TOL = 0.001;
        const dp: DiffractionPattern = {twoTheta: [], intensity: []}
        for(const key of keys) {

            const scaledIntensity = peaks[key][0] / max_intensity * 100;
            if(scaledIntensity > SCALED_INTENSITY_TOL) {

                dp.twoTheta.push(Number.parseFloat(key)),
                dp.intensity.push(scaled ? scaledIntensity : peaks[key][0]);
            }
        }

		return dp;
	}
}

// TEST
const testStructure: Structure = {
	crystal: {
		basis: [
			4.916000,   0.000000,   0.000000,
			-2.458000,  4.257381,   0.000000,
			0.000000,   0.000000,   5.405400,
		],
		origin: [0, 0, 0],
		spaceGroup: ""
	},
	atoms: [
		{
			atomZ: 14,
			label: "Si",
			position: [0.000000,   0.000000,   0.000000]
		},
		{
			atomZ: 14,
			label: "Si",
			position: [1.376726,   1.136295,   0.643783]
		}
	],
	bonds: [],
	volume: []
};

const xrd = new XRDCalculator();

const dp = xrd.getDiffractionPattern(testStructure);
console.log(dp);
