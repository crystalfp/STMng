/**
 * Routine to analyze the point group of a molecule.
 * Ported from https://pymatgen.org/pymatgen.symmetry.html#pymatgen.symmetry.analyzer.PointGroupAnalyzer
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-05-13
 */
import type {Structure} from "@/types";
import {getAtomData} from "./AtomData";
import {crossProduct, dotProduct, type Matrix} from "./LinearAlgebra";
import {SymmOp} from "./SymmOp";
import {eigs} from "mathjs";

export class PointGroupAnalyzer {

	private readonly tolerance: number;
	private readonly eigenTolerance: number;
	private readonly matrixTolerance: number;
	private readonly centeredStructure: Matrix = [];
	private readonly structure: Structure;
	private readonly natoms: number = 0;
	private readonly inversionOp = SymmOp.inversion();
	private readonly eigvals: number[] = [];
	private readonly principalAxes: number[][] = [];
	private readonly rotSym: number[][] = [];

	/**
	 * Initialize the analyzer
	 *
	 * @param structure - Molecule to determine point group for
	 * @param tolerance - Distance tolerance to consider sites as symmetrically equivalent
	 * @param eigenTolerance - Tolerance to compare eigen values of the inertia tensor
	 * @param matrixTolerance - Tolerance used to generate the full set of symmetry operations
	 */
	constructor(structure: Structure,
				tolerance = 0.3,
				eigenTolerance = 0.01,
				matrixTolerance = 0.1) {

		this.tolerance = tolerance;
		this.eigenTolerance = eigenTolerance;
		this.matrixTolerance = matrixTolerance;
		this.structure = structure;
		this.natoms = structure.atoms.length;
		void this.matrixTolerance; // TBD
	}

	/**
	 * Analyze the point group of the loaded structure
	 *
	 * @returns The Schoenflies symbol of the detected point group
	 */
	analyze(): string {

		// Special cases
		if(this.structure.atoms.length === 0) return "";
		if(this.structure.atoms.length === 1) return "Kh";

		// Recenter the atoms around the center of mass
		const center = this.centerOfMass();
		this.centeredStructure.length = 0;
		for(const atom of this.structure.atoms) {

			this.centeredStructure.push([atom.position[0]-center[0],
										 atom.position[1]-center[1],
										 atom.position[2]-center[2]]);
		}

		// Compute the inertia tensor
		const inertiaTensor = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
		let totalInertia = 0;
		for(let i=0; i < this.centeredStructure.length; ++i) {

			const atomZ = this.structure.atoms[i].atomZ;
			const wt = getAtomData(atomZ).mass;
			const c = this.centeredStructure[i];

			for(let j=0; j < 3; ++j) {
				inertiaTensor[j][j] += wt * (c[(j+1)%3]**2 + c[(j+2)%3]**2);
			}
			inertiaTensor[0][1] += -wt * c[0]*c[1];
			inertiaTensor[1][0] += -wt * c[1]*c[0];
			inertiaTensor[1][2] += -wt * c[1]*c[2];
			inertiaTensor[2][1] += -wt * c[2]*c[1];
			inertiaTensor[0][2] += -wt * c[0]*c[2];
			inertiaTensor[2][0] += -wt * c[2]*c[0];
			totalInertia += wt*(c[0]**2 + c[1]**2 + c[2]**2);
		}

		// Normalize the inertia tensor so that it does not scale with size
		// of the system. This mitigates the problem of choosing a proper
		// comparison tolerance for the eigenvalues.
		for(let i=0; i < 3; ++i) {
			for(let j=0; j < 3; ++j) {
				inertiaTensor[i][j] /= totalInertia;
			}
		}

		// Compute the eigenvalues of the inertia tensor
		const result = eigs(inertiaTensor);
		const v1 = result.eigenvectors[0].value as number;
		const v2 = result.eigenvectors[1].value as number;
		const v3 = result.eigenvectors[2].value as number;
		this.eigvals[0] = v1;
		this.eigvals[1] = v2;
		this.eigvals[2] = v3;

		const u1 = result.eigenvectors[0].vector as number[];
		const u2 = result.eigenvectors[1].vector as number[];
		const u3 = result.eigenvectors[2].vector as number[];
		this.principalAxes[0] = [u1[0], u2[0], u3[0]];
		this.principalAxes[1] = [u1[1], u2[1], u3[1]];
		this.principalAxes[2] = [u1[2], u2[2], u3[2]];

		// Test for linear molecule
		const eigZero = Math.abs(v1) < this.eigenTolerance &&
						Math.abs(v2) < this.eigenTolerance &&
						Math.abs(v3) < this.eigenTolerance;
		if(eigZero) {
			console.log("Linear molecule detected");
			return this.isValidOp(this.inversionOp) ? "D*h" : "C*v";
		}

		const eigAllSame = Math.abs(v1 - v2) < this.eigenTolerance &&
						   Math.abs(v1 - v3) < this.eigenTolerance &&
						   Math.abs(v2 - v3) < this.eigenTolerance;
		const eigAllDiff = Math.abs(v1 - v2) > this.eigenTolerance &&
						   Math.abs(v1 - v3) > this.eigenTolerance &&
						   Math.abs(v2 - v3) > this.eigenTolerance;
		if(eigAllSame) {
			console.log("Spherical top molecule detected");

        	// Handles Spherical Top Molecules, which belongs to the T, O or I point groups.

			this.findSphericalAxes();
			if(this.rotSym.length === 0) {
				console.log("Accidental spherical top!");
				return this.procSymTop();
			}

			let currentRot = -1;
			let currentIdx = 0;
			let idx = 0;
			for(const sym of this.rotSym) {
				if(sym[3] > currentRot) {
					currentRot = sym[3];
					currentIdx = idx;
				}
				++idx;
			}
			const rot = currentRot;
			const mainAxis = this.rotSym[currentIdx].slice(0, 3);

			if(rot < 3) {
				console.log("Accidental spherical top!");
				return this.procSymTop();
			}
			if(rot === 3) {
				const mirrorType = this.findMirror(mainAxis);
				if(mirrorType === "") return "T";
				if(this.isValidOp(this.inversionOp)) return "Th";
				return "Td";
			}
			if(rot === 4) {
				if(this.isValidOp(this.inversionOp)) return "Oh";
				return "O";
			}
			if(rot === 5) {
				if(this.isValidOp(this.inversionOp)) return "Ih";
				return "I";
			}
		}
		else if(eigAllDiff) {
			console.log("Asymmetric top molecule detected");
		}
		else {
			console.log("Symmetric top molecule detected");
		}

		// if self.sch_symbol in {"C1v", "C1h"}:
        //     self.sch_symbol: str = "Cs"
		return "invalid";
	}

	/**
	 * Handles symmetric top molecules which has one unique eigenvalue whose
     * corresponding principal axis is a unique rotational axis.
	 *
     * More complex handling required to look for R2 axes perpendicular
	 * to this unique axis
	 *
	 * @returns Shoenfield symbol
	 */
	private procSymTop(): string {

		let ind = 1;
        if(Math.abs(this.eigvals[0] - this.eigvals[1]) < this.eigenTolerance) ind = 2;
        else if(Math.abs(this.eigvals[1] - this.eigvals[2]) < this.eigenTolerance) ind = 0;
		const uniqueAxis = this.principalAxes[ind];
		this.checkRotSym(uniqueAxis);
		const countRotSym = this.rotSym.length;

		if(countRotSym > 0) {
			this.checkPerpendicularR2Axis(uniqueAxis);
		}
		if(countRotSym >= 2) {
			this.procDihedral();
		}
		else if(countRotSym === 1) {
			this.procCyclic();
		}
		else {
			this.procNoRotSym();
		}

		return "bho?";
	}

	private checkPerpendicularR2Axis(uniqueAxis: number[]): void {void uniqueAxis; /* TBD */}
	private procDihedral(): void {/* TBD */}
	private procCyclic(): void {/* TBD */}
	private procNoRotSym(): void {/* TBD */}

	/**
	 * Determine the rotational symmetry about supplied axis.
	 *
	 * Used only for symmetric top molecules which has possible rotational symmetry
	 * operations greater than 2
	 *
	 * @param uniqueAxis - Axis around which the rotational symmetry should be determined
	 */
	private checkRotSym(axis: number[]): number {

		const minSet = this.getSmallestSetNotOnAxis(axis);
		const maxSym = minSet.length;
		for(let idx=maxSym; idx > 0; --idx) {
			if(maxSym % idx !== 0) continue;
			const op = SymmOp.from_axis_angle_and_translation(axis, 360/idx);
			if(this.isValidOp(op)) {
				this.rotSym.push([...axis, idx]);
				return idx;
			}
		}
		return 1;
	}

	/**
	 * Get the smallest list of atoms with the same species and distance from
     * origin AND does not lie on the specified axis.
	 *
	 * This maximal set limits the possible rotational symmetry operations, since atoms
     * lying on a test axis is irrelevant in testing rotational symmetry Operations.
	 *
	 * @param axis -
	 * @returns
	 */
	private getSmallestSetNotOnAxis(axis: number[]): number[] {

		const validSets = [];
		const {clusteredSites} = this.clusterSites(this.centeredStructure, this.tolerance);
		for(const key in clusteredSites) {
			const testSet = clusteredSites[key];
			const validSet = testSet.filter((idx) => {
				const coords = this.centeredStructure[idx];
				const cross = crossProduct(coords, axis);
				return Math.hypot(...cross) > this.tolerance;
			});
			if(validSet.length > 0) validSets.push(validSet);
		}

		let minLen = Number.POSITIVE_INFINITY;
		let minIdx = 0;
		for(let i=0; i < validSets.length; ++i) {
			if(validSets[i].length < minLen) {
				minLen = validSets[i].length;
				minIdx = i;
			}
		}

		return validSets[minIdx];
	}

	/**
	 * Looks for mirror symmetry of specified type about axis.
	 *
     *  Possible types are "h" or "vd". Horizontal (h) mirrors are perpendicular to the
     *  axis while vertical (v) or diagonal (d) mirrors are parallel. v mirrors has atoms
     *  lying on the mirror plane while d mirrors do not.
	 *
	 * @param mainAxis - Axis to look at
	 * @returns Specific mirror symmetry
	 */
	private findMirror(mainAxis: number[]): string {

		let mirrorType = "";

		if(this.isValidOp(SymmOp.reflection(mainAxis))) {
			return "h";
		}

		for(let is1=0; is1 < this.natoms-1; ++is1) {
			for(let is2=is1+1; is2 < this.natoms; ++is2) {

				if(this.structure.atoms[is1].atomZ !== this.structure.atoms[is2].atomZ) continue;
				const c1 = this.centeredStructure[is1];
				const c2 = this.centeredStructure[is2];
				const normal = [
					c1[0] - c2[0],
					c1[1] - c2[1],
					c1[2] - c2[2]
				];
				if(dotProduct(normal, mainAxis) < this.tolerance) {
					const op = SymmOp.reflection(normal);
					if(this.isValidOp(op)) {
						if(this.rotSym.length > 1) {
							mirrorType = "d";
							for(const symm of this.rotSym) {

								const len1 = Math.hypot(
									symm[0]-mainAxis[0],
									symm[1]-mainAxis[1],
									symm[2]-mainAxis[2]
								);
								const len2 = dotProduct([symm[0], symm[1], symm[2]], normal);
								if(len1 >= this.tolerance && len2 < this.tolerance) {
									mirrorType = "v";
									break;
								}
							}
						}
						else {
							mirrorType = "v";
						}
						break;
					}
				}
			}
		}

		return mirrorType;
	}

	/**
	 * Compute the center of mass of the structure
	 *
	 * @returns Coordinates of the center of mass
	 */
	private centerOfMass(): number[] {

		const center = [0, 0, 0];
		let totalWeight = 0;
		for(const atom of this.structure.atoms) {

			const wt = getAtomData(atom.atomZ).mass;
			center[0] += atom.position[0]*wt;
			center[1] += atom.position[1]*wt;
			center[2] += atom.position[2]*wt;
			totalWeight += wt;
		}

		return [center[0]/totalWeight, center[1]/totalWeight, center[2]/totalWeight];
	}

	/**
	 * Check if a particular symmetry operation is a valid symmetry operation for
	 * a molecule, i.e., the operation maps all atoms to another equivalent atom.
	 *
	 * @param symmOp - Symmetry operation to test.
	 * @returns True if SymmOp is valid for Molecule.
	 */
	private isValidOp(symmOp: SymmOp): boolean {

		for(let i=0; i < this.natoms; ++i) {

			const atom = this.structure.atoms[i];

			const coord = symmOp.operate(this.centeredStructure[i]);

			// This is the expansion of find_in_coord_list
			const ind = [];
			for(let j=0; j < this.natoms; ++j) {
				const dx = this.centeredStructure[j][0] - coord[0];
				if(dx < this.tolerance && dx > -this.tolerance) {
					const dy = this.centeredStructure[j][1] - coord[1];
					if(dy < this.tolerance && dy > -this.tolerance) {
						const dz = this.centeredStructure[j][2] - coord[2];
						if(dz < this.tolerance && dz > -this.tolerance) {
							ind.push(j);
						}
					}
				}
			}
			if(ind.length !== 1 || this.structure.atoms[ind[0]].atomZ !== atom.atomZ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Looks for R5, R4, R3 and R2 axes in spherical top molecules.
	 *
     *  Point group T molecules have only one unique 3-fold and one unique 2-fold axis. O
     *  molecules have one unique 4, 3 and 2-fold axes. I molecules have a unique 5-fold
     *  axis.
	 */
	private findSphericalAxes(): void {

		const rotPresent = Array<boolean>(6).fill(false);
		this.rotSym.length = 0;

        const {originSite, clusteredSites} =
								this.clusterSites(this.centeredStructure, this.tolerance);
		void originSite;
		let testSet: number[] = [];
		let minDist = Number.POSITIVE_INFINITY;
		for(const dist of Object.keys(clusteredSites)) {
			const key = Number.parseFloat(dist);
			if(key < minDist) {
				minDist = key;
				testSet = clusteredSites[key];
			}
		}

		for(let ic1=0; ic1 < testSet.length-2; ++ic1) {
			for(let ic2=ic1+1; ic2 < testSet.length-1; ++ic2) {
				for(let ic3=ic2+1; ic3 < testSet.length; ++ic3) {

					const c = [
						this.centeredStructure[testSet[ic1]],
						this.centeredStructure[testSet[ic2]],
						this.centeredStructure[testSet[ic3]]
					];
					for(let icc1=0; icc1 < 3; ++icc1) {
						for(let icc2=icc1+1; icc2 < 3; ++icc2) {
							if(rotPresent[2]) continue;
							const testAxis = [
								c[icc1][0] + c[icc2][0],
								c[icc1][1] + c[icc2][1],
								c[icc1][2] + c[icc2][2]
							];
							const len = Math.hypot(...testAxis);
							if(len > this.tolerance) {
								const op = SymmOp.from_axis_angle_and_translation(testAxis, 180);
								rotPresent[2] = this.isValidOp(op);
								if(rotPresent[2]) {
									this.rotSym.push([...testAxis, 2]);
								}
							}
						}
					}

					const d1 = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]];
					const d2 = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]];

					const testAxis = crossProduct(d1, d2);
					if(Math.hypot(...testAxis) > this.tolerance) {
						for(let r=3; r < 6; ++r) {
							if(rotPresent[r]) continue;
							const op = SymmOp.from_axis_angle_and_translation(testAxis, 360/r);
							rotPresent[r] = this.isValidOp(op);
							if(rotPresent[r]) {
								this.rotSym.push([...testAxis, r]);
								break;
							}
						}
					}
					if(rotPresent[2] && rotPresent[3] && (rotPresent[4] || rotPresent[5])) break;
				}
			}
		}
	}

	/**
	 * Cluster sites based on distance and species type
	 *
	 * @param centeredStructure - Molecule coordinates with origin at center of mass
	 * @param tol - Tolerance to use
	 * @returns originSite is an atom at the center of mass (undefined if there are no origin atoms),
	 * 			clusteredSites: object with avg distance as key, list of atoms indices
	 */
	private clusterSites(centeredStructure: Matrix, tol: number): {originSite: number | undefined; clusteredSites: Record<number, number[]>} {

		const dists: number[] = [];
		for(let i=0; i < this.natoms; ++i) {
			dists.push(Math.hypot(centeredStructure[i][0],
								  centeredStructure[i][1],
								  centeredStructure[i][2]));
		}

		const {cluster, nclusters} = this.singleLinkageClustering(dists, tol);
		const clusteredDists: number[][] = [];
		for(let i=0; i < nclusters; ++i) {
			clusteredDists.push([]);
		}
		for(let i=0; i < this.natoms; ++i) {
			clusteredDists[cluster[i]].push(dists[i]);
		}
		const averageDistances: number[] = [];
		for(let i=0; i < nclusters; ++i) {
			const len = clusteredDists[i].length;
			let total = 0;
			for(let j=0; j < len; ++j) total += clusteredDists[i][j];
			// In pymatgen they count also 2D zero coords so the half value here
			averageDistances.push(total/(2*len));
		}

		const clusteredSites: Record<number, number[]> = {};
		for(let i=0; i < nclusters; ++i) {
			clusteredSites[averageDistances[i]] = [];
		}

		let originSite;
		for(let i=0; i < this.natoms; ++i) {
			if(averageDistances[cluster[i]] < tol) {
				originSite = i;
			}
			else {
				clusteredSites[averageDistances[cluster[i]]].push(i);
			}
		}

		return {originSite, clusteredSites};
	}

	/**
	 * Cluster values using hierarchical single linkage clustering
	 * Substitutes scipy.cluster.hierarchy.fclusterdata()
	 *
	 * @param values - Values to be clustered
	 * @param threshold - Distance threshold
	 * @returns Cluster index for each atom and the number of clusters
	 */
	private singleLinkageClustering(values: number[], threshold: number): {cluster: number[]; nclusters: number} {

		// Initialize root (to point to all)
        const root: number[][] = [];
        for(let i=0; i < values.length; ++i) root.push([i]);

		// Iterate till the distance becomes greater than the given threshold
        while(root.length > 1) {

            let mini: number;
            let minj: number;
            let minDistance = Number.POSITIVE_INFINITY;
            const len = root.length;
            for(let ni=0; ni < len-1; ++ni) {
                for(let nj=ni+1; nj < len; ++nj) {
                    const distance = this.clusterDistance(root[ni], root[nj], values);
                    if(distance < minDistance) {
                        minDistance = distance;
                        mini = ni;
                        minj = nj;
                    }
                }
            }

            // Exit if the threshold has been reached
            if(minDistance > threshold) break;

            // Update the group list. Merge node j at the end of node i
            for(const element of root[minj!]) root[mini!].push(element);

            // Remove merged node
            root.splice(minj!, 1);
		}

		const result = Array<number>(values.length).fill(0);
		for(let i=0; i < root.length; ++i) {
			for(const idx of root[i]) result[idx] = i;
		}

		return {cluster: result, nclusters: root.length};
	}

	/**
	 * Maximum distance between elements of two groups
	 *
	 * @param idxi - Indices of the first group elements
	 * @param idxj - Indices of the second group elements
	 * @param distances - Distance matrix
	 * @returns Distance between the two groups
	 */
	protected clusterDistance(idxi: number[], idxj: number[], values: number[]): number {

		const leni = idxi.length;
		const lenj = idxj.length;

		if(leni === 1 && lenj === 1) {
			return Math.abs(values[idxi[0]] - values[idxj[0]]);
		}

		let distance = Number.POSITIVE_INFINITY;

		for(let i=0; i < leni; ++i) {
			for(let j=0; j < lenj; ++j) {
				const dd = Math.abs(values[idxi[i]] - values[idxj[j]]);
				if(dd < distance) distance = dd;
			}
		}

		return distance;
	}
}
