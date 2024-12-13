/**
 * Methods that compute the actual fingerprint.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-11
 */
import {smoothPeak} from "./Smooth";
import {getCellVolume} from "./Helpers";
import type {FingerprintingParameters, PositionType} from "@/types";
import type {StructureReduced} from "./Accumulator";

export const nullMethod = (structure: StructureReduced,
                           expansion: PositionType,
                           params: FingerprintingParameters): void => {

    console.log("Null method");
    void structure;
    void expansion;
    void params;
    structure.fingerprint.length = 0;
};

export const perElementRdfHistogram = (structure: StructureReduced,
                                       expansion: PositionType,
                                       params: FingerprintingParameters): void => {

    console.log("Per Element Rdf Histogram method"); // TBD

    // Access the parameters
    const {areNanoclusters, cutoffDistance, binSize, peakWidth} = params;
    const {basis, atomsPosition: coords, atomsZ, species, fingerprint, weights} = structure;

    const atomsIdx = new Map<number, number>();
	let pos = 0;
    for(const key of species.keys()) atomsIdx.set(key, pos++);

	// Compute fingerprint sizes
    const countSpecies = species.size;
	const countSections = (countSpecies*(countSpecies+1))/2;
	const nbins = Math.ceil(cutoffDistance/binSize);
	const fpLength = nbins*countSections;
    fingerprint.length = fpLength;
    for(let i=0; i < fpLength; ++i) fingerprint[i] = -1;
	const delta = cutoffDistance/nbins;

    const cellVolume = getCellVolume(basis, areNanoclusters);

	// Create the infinite slab
	const natoms = atomsZ.length;

	// Create the table to decode the fused loop
	const ex = expansion[0];
	const ey = expansion[1];
	const ez = expansion[2];
	let iorig;
	const imax = (2*ex+1)*(2*ey+1)*(2*ez+1)*3;
    const dd = Array(imax) as number[];

	let n = 0;
    for(let di = -ex; di <= ex; ++di) {
		for(let dj = -ey; dj <= ey; ++dj) {
			for(let dk = -ez; dk <= ez; ++dk) {
				dd[n++] = di;
				dd[n++] = dj;
				dd[n++] = dk;

				if(di === 0 && dj === 0 && dk === 0) iorig = n-3;
			}
		}
	}

    // Prepare temporary list to compute interatomic distances
    const dp: [number, number][] = [];
    dp.length = imax/3;

    for(let ii=0; ii < imax; ii += 3) {

        // Copy the atoms in the unit cell replicas
		for(let a=0; a < natoms; ++a) {

            const x = coords[3*a];
            const y = coords[3*a+1];
            const z = coords[3*a+2];

            const Zi = atomsZ[a];
            const Ni = species.get(Zi)!;
            const Pi = atomsIdx.get(Zi)!;

            if(ii === iorig) {

                for(let b=a+1; b < natoms; ++b) {

                    const dx = coords[3*b]   - x;
                    const dy = coords[3*b+1] - y;
                    const dz = coords[3*b+2] - z;

                    const distSquared = dx*dx+dy*dy+dz*dz;
                    const Zj = atomsZ[b];
                    const Nj = species.get(Zj)!;
                    const Pj = atomsIdx.get(Zj)!;

                    // Compute the peak value Fing
                    let fing = areNanoclusters ?
                                        1/(Nj*Ni*binSize) :
                                        1/(4*Math.PI*distSquared*(Nj/cellVolume)*2*Ni*binSize);

                    // The components AA, BB, etc. should be counted twice
                    if(Zi === Zj) fing *= 2;

                    // Compute the section index for this part
                    const idxSection = (Pj >= Pi) ?
                                            Pi*countSpecies-(Pi*(Pi+1))/2+Pj :
                                            Pj*countSpecies-(Pj*(Pj+1))/2+Pi;

                    // Smooth the peak and accumulate
                    const dist = Math.sqrt(distSquared);
                    smoothPeak(fing, dist, delta, nbins, fingerprint, idxSection*nbins, peakWidth);

                    // Save the interatomic distance
                    dp[ii/3] = [a, dist];
                }
            }
            else {

                const di = dd[ii];
                const dj = dd[ii+1];
                const dk = dd[ii+2];

                const ox = x + di*basis[0] + dj*basis[3] + dk*basis[6];
                const oy = y + di*basis[1] + dj*basis[4] + dk*basis[7];
                const oz = z + di*basis[2] + dj*basis[5] + dk*basis[8];

                for(let b=0; b < natoms; ++b) {

                    const dx = coords[3*b+0] - ox;
                    const dy = coords[3*b+1] - oy;
                    const dz = coords[3*b+2] - oz;

                    const distSquared = dx*dx+dy*dy+dz*dz;
                    const Zj = atomsZ[b];
                    const Nj = species.get(Zj)!;
                    const Pj = atomsIdx.get(Zj)!;

                    // Compute the peak value Fing
                    let fing = areNanoclusters ?
                                        1/(Nj*Ni*binSize) :
                                        1/(4*Math.PI*distSquared*(Nj/cellVolume)*2*Ni*binSize);

                    // The components AA, BB, etc. should be counted twice
                    if(Zi === Zj) fing *= 2;

                    // Compute the section index for this part
                    const idxSection = (Pj >= Pi) ?
                                            Pi*countSpecies-(Pi*(Pi+1))/2+Pj :
                                            Pj*countSpecies-(Pj*(Pj+1))/2+Pi;

                    // Smooth the peak and accumulate
                    const dist = Math.sqrt(distSquared);
                    smoothPeak(fing, dist, delta, nbins, fingerprint, idxSection*nbins, peakWidth);

                    // Save the interatomic distance
                    dp[ii/3] = [a, dist];
                }
            }
        }
    }

	// Compute weights
    const counts = [...species.entries()].sort((a, b) => a[0] - b[0]);

    weights.length = 0;
    for(const ci of counts) {
        for(const cj of counts) {
            weights.push(ci[1]*cj[1]);
        }
    }

	// Normalize the weights and store them
	let w = 0;
	for(let i=0; i < countSections; ++i) w += weights[i];
	for(let i=0; i < countSections; ++i) weights[i] /= w;

	// Prepare the interatomic distances array
	const interatomicDistances: number[][] = [];
    interatomicDistances.length = natoms;
	for(let ii=0; ii < natoms; ++ii) {
        interatomicDistances[ii] = [];
    }

	// Store the interatomic distances
	for(let ii=0; ii < imax/3; ++ii) {

        for(const entry of dp) {
            interatomicDistances[entry[0]].push(entry[1]);
        }
    }
};
