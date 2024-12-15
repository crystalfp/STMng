/**
 * The "infinite slab", that is the cell plus replicas to cover cutoff distance
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-14
 */
import {invertBasis} from "../modules/Helpers";
import type {BasisType, PositionType} from "@/types";
import type {StructureReduced} from "./Accumulator";

export class Slab {

    private readonly tryPoints: number[][] = [];
    private readonly interatomicDistances = new Map<number, [number, number][]>();

    constructor(private readonly cutoff: number, private readonly isNanocluster: boolean) {

        // Initialize try points
		this.computeTryPoints(8, 8);
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
	 * Compute expansions along each base axis
	 *
	 * @param basis - Structure basis
	 * @param cutoffDistance - The requested cutoff radius
	 * @param expansion - Resulting expansions along each base axis
	 */
	private computeExpansion(basis: BasisType,
                             cutoffDistance: number,
                             expansion: PositionType): void {

		// Initialize expansion factor
		let ex = 1;
		let ey = 1;
		let ez = 1;

		const basisX = basis[0] + basis[3] + basis[6];
		const basisY = basis[1] + basis[4] + basis[7];
		const basisZ = basis[2] + basis[5] + basis[8];

		const inverse = invertBasis(basis);

		for(const point of this.tryPoints) {

			// Enlarge to account for truncation
			const x = basisX + point[0]*cutoffDistance;
			const y = basisY + point[1]*cutoffDistance;
			const z = basisZ + point[2]*cutoffDistance;

			// The end point in fractional coordinates
			const xf = x*inverse[0]+y*inverse[3]+z*inverse[6];
			const yf = x*inverse[1]+y*inverse[4]+z*inverse[7];
			const zf = x*inverse[2]+y*inverse[5]+z*inverse[8];

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
	};

    /**
     * Compute the infinite slab for the structure
     *
     * @param structure - Structure that fills the infinite slab
     */
    computeInteratomicDistances(structure: StructureReduced): void {

        const {basis, atomsZ, atomsPosition} = structure;
        const TOL = 1e-2;
        const TOL_SQUARED = TOL*TOL;

        // Compute how many copies of the unit cell are needed to contain the cutoff distance
        const expansion: PositionType = [0, 0, 0];
        if(!this.isNanocluster) {

            this.computeExpansion(basis, this.cutoff, expansion);
        }

        // Create the table to decode the fused loop
        const ex = expansion[0];
        const ey = expansion[1];
        const ez = expansion[2];
        let originalCellIndex;
        const replicaMaxIndex = (2*ex+1)*(2*ey+1)*(2*ez+1)*3;
        const dd = Array(replicaMaxIndex) as number[];

        let n = 0;
        for(let di = -ex; di <= ex; ++di) {
            for(let dj = -ey; dj <= ey; ++dj) {
                for(let dk = -ez; dk <= ez; ++dk) {
                    dd[n++] = di;
                    dd[n++] = dj;
                    dd[n++] = dk;

                    if(di === 0 && dj === 0 && dk === 0) originalCellIndex = n-3;
                }
            }
        }

        // For each replica (included the original cell)
        const natoms = atomsZ.length;
        for(let replica=0; replica < replicaMaxIndex; replica += 3) {

            // Copy the atoms in the unit cell replicas
            for(let i=0; i < natoms; ++i) {

                const x = atomsPosition[3*i];
                const y = atomsPosition[3*i+1];
                const z = atomsPosition[3*i+2];

                const Zi = atomsZ[i];

                if(replica === originalCellIndex) {

                    for(let j=i+1; j < natoms; ++j) {

                        const dx = atomsPosition[3*j]   - x;
                        const dy = atomsPosition[3*j+1] - y;
                        const dz = atomsPosition[3*j+2] - z;

                        const distSquared = dx*dx+dy*dy+dz*dz;
                        if(distSquared >= TOL_SQUARED) {
                            const distance = Math.sqrt(distSquared);
                            const Zj = atomsZ[j];
                            if(this.interatomicDistances.has(Zi)) {
                                this.interatomicDistances.get(Zi)!.push([Zj, distance]);
                            }
                            else {
                                this.interatomicDistances.set(Zi, [[Zj, distance]]);
                            }
                        }
                    }
                }
                else {
                    const di = dd[replica];
                    const dj = dd[replica+1];
                    const dk = dd[replica+2];

                    const ox = x + di*basis[0] + dj*basis[3] + dk*basis[6];
                    const oy = y + di*basis[1] + dj*basis[4] + dk*basis[7];
                    const oz = z + di*basis[2] + dj*basis[5] + dk*basis[8];

                    for(let j=0; j < natoms; ++j) {

                        const dx = atomsPosition[3*j+0] - ox;
                        const dy = atomsPosition[3*j+1] - oy;
                        const dz = atomsPosition[3*j+2] - oz;

                        const distSquared = dx*dx+dy*dy+dz*dz;

                        if(distSquared >= TOL_SQUARED) {
                            const distance = Math.sqrt(distSquared);
                            const Zj = atomsZ[j];
                            if(this.interatomicDistances.has(Zi)) {
                                this.interatomicDistances.get(Zi)!.push([Zj, distance]);
                            }
                            else {
                                this.interatomicDistances.set(Zi, [[Zj, distance]]);
                            }
                        }
                    }
                }
            }
        }
    }

    getDistancesForZ(atomZ: number): [number, number][] {

        const distances = this.interatomicDistances.get(atomZ);

        return distances ?? [];
    }
}
