/**
 * The "infinite slab", that is the cell plus replicas to cover cutoff distance
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-14
 */
import {invertBasis} from "../modules/Helpers";
import type {BasisType, PositionType} from "@/types";
import log from "electron-log";

/**
 * Infinite slab abstraction
 */
export class Slab {

    private readonly tryPoints: number[][] = [];
    private inverseBasis: BasisType = [1, 0, 0, 0, 1, 0, 0, 0, 1];

    private readonly cutoff: number;
    private readonly isNanocluster: boolean;

    private originalCellIndex = 0;
    private dd: number[] = [];
    private replicaMaxIndex = 0;
    private distancesFromZ: [atomZ: number, distance: number][] = [];

    /**
     * Create the slab
     *
     * @param cutoff - Cutoff distance
     * @param isNanocluster - If the structure is a nanocluster without a unit cell
     */
    constructor(cutoff: number, isNanocluster=false) {

        this.cutoff = cutoff;
        this.isNanocluster = isNanocluster;

        // Initialize try points
		if(!isNanocluster) this.computeTryPoints(16, 16);
    }

	/**
	 * Compute points on a sphere of radius one
	 *
	 * @param verticalDivisions - Sphere vertical subdivisions
	 * @param horizontalDivisions - Horizontal subdivisions
	 */
	private computeTryPoints(verticalDivisions: number, horizontalDivisions: number): void {

		// Test points on a sphere of radius 1
		this.tryPoints.length = horizontalDivisions*(verticalDivisions-1)+2;

		// Add the North pole
		this.tryPoints[0] = [1, 0, 0];

		// Some constants
		const pivd = Math.PI/verticalDivisions;
		const pihd = Math.PI/horizontalDivisions;

		// Add points along parallel circles
		let j = 1;
		for(let v=1; v < verticalDivisions; ++v) {

			const first = Math.cos(pivd*v);
			for(let h=0; h < horizontalDivisions; ++h) {

				const angle = pihd*h;
				this.tryPoints[j] = [first, Math.cos(angle), Math.sin(angle)];
				++j;
			}
		}

		// Add the South pole
		this.tryPoints[j] = [-1, 0, 0];
	}

	/**
	 * Compute expansions along each base axis to contain a sphere of radius cutoff distance
	 *
	 * @param basis - Structure basis
	 * @param cutoffDistance - The requested cutoff radius
	 * @param expansion - Resulting expansions along each base axis
	 */
	private computeExpansion(basis: Float64Array,
                             cutoffDistance: number,
                             expansion: PositionType): void {

		// Initialize expansion factor
		let ex = 1;
		let ey = 1;
		let ez = 1;

		const basisX = basis[0] + basis[3] + basis[6];
		const basisY = basis[1] + basis[4] + basis[7];
		const basisZ = basis[2] + basis[5] + basis[8];

		for(const point of this.tryPoints) {

			// Enlarge to account for truncation
			const x = basisX + point[0]*cutoffDistance;
			const y = basisY + point[1]*cutoffDistance;
			const z = basisZ + point[2]*cutoffDistance;

			// The end point in fractional coordinates
			const xf = x*this.inverseBasis[0]+y*this.inverseBasis[3]+z*this.inverseBasis[6];
			const yf = x*this.inverseBasis[1]+y*this.inverseBasis[4]+z*this.inverseBasis[7];
			const zf = x*this.inverseBasis[2]+y*this.inverseBasis[5]+z*this.inverseBasis[8];

			if(xf < 0) {
				const n = Math.ceil(-xf);
				if(n > ex) ex = n;
			}
			else if(xf > 2) {
				const n = Math.ceil(xf) - 1;
				if(n > ex) ex = n;
			}
			if(yf < 0) {
				const n = Math.ceil(-yf);
				if(n > ey) ey = n;
			}
			else if(yf > 2) {
				const n = Math.ceil(yf) - 1;
				if(n > ey) ey = n;
			}
			if(zf < 0) {
				const n = Math.ceil(-zf);
				if(n > ez) ez = n;
			}
			else if(zf > 2) {
				const n = Math.ceil(zf) - 1;
				if(n > ez) ez = n;
			}
		}

		// Return results
		expansion[0] = ex;
		expansion[1] = ey;
		expansion[2] = ez;
	}

    /**
     * Prepare supporting data for computing interatomic distances
     *
     * @param basis - Unit cell basis vector
     * @returns On error the error text, on success an empty string
     */
    prepareComputingDistances(basis: Float64Array): string {

        // Compute how many copies of the unit cell are needed to contain the cutoff distance
        const expansion: PositionType = [0, 0, 0];
        if(!this.isNanocluster) {

            // Inverse basis to convert to fractional coordinates
            try {
                this.inverseBasis = invertBasis(basis);
            }
            // eslint-disable-next-line @stylistic/keyword-spacing
            catch {
                const error = "In prepareComputingDistances basis matrix is not invertible";
                log.error(error);
                return error;
            }

            this.computeExpansion(basis, this.cutoff, expansion);
        }

        // Create the table to decode the fused loop
        const ex = expansion[0];
        const ey = expansion[1];
        const ez = expansion[2];
        this.replicaMaxIndex = (2*ex+1)*(2*ey+1)*(2*ez+1)*3;
        this.dd.length = this.replicaMaxIndex;

        let n = 0;
        for(let di = -ex; di <= ex; ++di) {
            for(let dj = -ey; dj <= ey; ++dj) {
                for(let dk = -ez; dk <= ez; ++dk) {
                    this.dd[n++] = di;
                    this.dd[n++] = dj;
                    this.dd[n++] = dk;

                    if(di === 0 && dj === 0 && dk === 0) this.originalCellIndex = n-3;
                }
            }
        }

        return "";
    }

    /**
     * Compute the interatomic distances inside the infinite slab from the given atom type
     *
     * @param fromZ - Atom type from which the distance should be computed
     * @param basis - Unit cell basis vector
     * @param natoms - Number of atoms
     * @param atomsZ - Atoms Z values
     * @param atomsPosition - Atoms coordinates
     * @returns Array of pairs remote atom type, distance
     */
    computeDistancesForZ(fromZ: number,
                         basis: Float64Array,
                         natoms: number,
                         atomsZ: Int32Array,
                         atomsPosition: Float64Array): [atomZ: number, distance: number][] {

        const TOL = 1e-2;
        const TOL_SQUARED = TOL*TOL;
        this.distancesFromZ.length = 0;

        // For each replica (included the original cell)
        for(let replica=0; replica < this.replicaMaxIndex; replica += 3) {

            // Copy the atoms in the unit cell replicas
            for(let i=0, i3=0; i < natoms; ++i, i3+=3) {

                if(atomsZ[i] !== fromZ) continue;

                const x = atomsPosition[i3];
                const y = atomsPosition[i3+1];
                const z = atomsPosition[i3+2];

                if(replica === this.originalCellIndex) {

                    for(let j=i+1, j3=j*3; j < natoms; ++j, j3+=3) {

                        const dx = atomsPosition[j3]   - x;
                        const dy = atomsPosition[j3+1] - y;
                        const dz = atomsPosition[j3+2] - z;

                        const distSquared = dx*dx+dy*dy+dz*dz;
                        if(distSquared >= TOL_SQUARED) {
                            const distance = Math.sqrt(distSquared);
                            const Zj = atomsZ[j];
                            this.distancesFromZ.push([Zj, distance]);
                        }
                    }
                }
                else {
                    const di = this.dd[replica];
                    const dj = this.dd[replica+1];
                    const dk = this.dd[replica+2];

                    const ox = x + di*basis[0] + dj*basis[3] + dk*basis[6];
                    const oy = y + di*basis[1] + dj*basis[4] + dk*basis[7];
                    const oz = z + di*basis[2] + dj*basis[5] + dk*basis[8];

                    for(let j=0, j3=0; j < natoms; ++j, j3+=3) {

                        const dx = atomsPosition[j3+0] - ox;
                        const dy = atomsPosition[j3+1] - oy;
                        const dz = atomsPosition[j3+2] - oz;

                        const distSquared = dx*dx+dy*dy+dz*dz;

                        if(distSquared >= TOL_SQUARED) {
                            const distance = Math.sqrt(distSquared);
                            const Zj = atomsZ[j];
                            this.distancesFromZ.push([Zj, distance]);
                        }
                    }
                }
            }
        }
        return this.distancesFromZ;
    }

    /**
     * Reset allocated memory
     */
    reset(): void {
        this.distancesFromZ.length = 0;
    }

    /**
     * Compute the vectors on the infinite slab for the structure
     *
     * @param basis - Unit cell basis vector
     * @param natoms - Number of atoms
     * @param atomsPosition - Atoms coordinates
     * @param computeFP - Routine that receive the two vectors and accumulate the fingerprint
     */
    computeVectorPairs(basis: Float64Array,
                       natoms: number,
                       atomsPosition: Float64Array,
                       cutoffDistance: number,
                       computeFP: (vAB: number[], vAC: number[],
                                   magnitudeAB: number, magnitudeAC: number) => void): void {

        // Compute how many copies of the unit cell are needed to contain the cutoff distance
        const expansion: PositionType = [0, 0, 0];
        if(!this.isNanocluster) {

            // Inverse basis to convert to fractional coordinates
            this.inverseBasis = invertBasis(basis);
            try {
                this.inverseBasis = invertBasis(basis);
            }
            // eslint-disable-next-line @stylistic/keyword-spacing
            catch {
                log.error("In computeVectorPairs basis matrix is not invertible");
                return;
            }

            this.computeExpansion(basis, this.cutoff, expansion);
        }

        // Create the table to decode the fused loop
        const ex = expansion[0];
        const ey = expansion[1];
        const ez = expansion[2];
        const replicaMaxIndex = (2*ex+1)*(2*ey+1)*(2*ez+1)*3;
        const dd = Array<number>(replicaMaxIndex);

        // Put the untranslated cell indices
        dd[0] = 0;
        dd[1] = 0;
        dd[2] = 0;

        // Put the translated cells indices
        let n = 3;
        for(let di = -ex; di <= ex; ++di) {
            for(let dj = -ey; dj <= ey; ++dj) {
                for(let dk = -ez; dk <= ez; ++dk) {

                    if(di === 0 && dj === 0 && dk === 0) continue;

                    dd[n++] = di;
                    dd[n++] = dj;
                    dd[n++] = dk;
                }
            }
        }

        // Mark atoms on the border that could become duplicated
        // const ok = this.getDuplicatedAtomsIndex(atomsPosition, natoms);

        // For each atom in the original cell
        for(let a=0; a < natoms; ++a) {

            const a3 = 3*a;
            const xa = atomsPosition[a3];
            const ya = atomsPosition[a3+1];
            const za = atomsPosition[a3+2];

            // For each replica (included the original cell)
            for(let replicaB=0; replicaB < replicaMaxIndex; replicaB += 3) {

                for(let b=0; b < natoms; ++b) {

                    if(replicaB === 0 && b === a) continue;

                    const b3 = 3*b;

                    const di = dd[replicaB];
                    const dj = dd[replicaB+1];
                    const dk = dd[replicaB+2];

                    const xb = atomsPosition[b3]   + di*basis[0] + dj*basis[3] + dk*basis[6];
                    const yb = atomsPosition[b3+1] + di*basis[1] + dj*basis[4] + dk*basis[7];
                    const zb = atomsPosition[b3+2] + di*basis[2] + dj*basis[5] + dk*basis[8];

                    const vAB = [xb - xa, yb - ya, zb - za];
                    const magnitudeAB = Math.hypot(vAB[0], vAB[1], vAB[2]);
                    if(magnitudeAB > cutoffDistance) continue;

                    // For each replica (included the original cell)
                    for(let replicaC=replicaB; replicaC < replicaMaxIndex; replicaC += 3) {

                        // To avoid computing twice
                        const start = replicaB === replicaC ? b : 0;

                        for(let c=start; c < natoms; ++c) {

                            if(replicaC === 0 && c === a) continue;

                            const c3 = 3*c;

                            const di = dd[replicaC];
                            const dj = dd[replicaC+1];
                            const dk = dd[replicaC+2];

                            const xc = atomsPosition[c3]   + di*basis[0] + dj*basis[3] + dk*basis[6];
                            const yc = atomsPosition[c3+1] + di*basis[1] + dj*basis[4] + dk*basis[7];
                            const zc = atomsPosition[c3+2] + di*basis[2] + dj*basis[5] + dk*basis[8];

                            const vAC = [xc - xa, yc - ya, zc - za];
                            const magnitudeAC = Math.hypot(vAC[0], vAC[1], vAC[2]);
                            if(magnitudeAC > cutoffDistance) continue;

                            computeFP(vAB, vAC, magnitudeAB, magnitudeAC);
                        }
                    }
                }
            }
        }
    }
}
