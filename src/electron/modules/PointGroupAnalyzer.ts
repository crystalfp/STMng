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
import {computeEigen} from "./ComputeEigen";

const centerOfMass = (structure: Structure): number[] => {

	const center = [0, 0, 0];
	let totalWeight = 0;
	for(const atom of structure.atoms) {

		const wt = getAtomData(atom.atomZ).mass;
		center[0] += atom.position[0]*wt;
		center[1] += atom.position[1]*wt;
		center[2] += atom.position[2]*wt;
		totalWeight += wt;
	}

	return [center[0]/totalWeight, center[1]/totalWeight, center[2]/totalWeight];
};

/**
 * Analyze the point group of a molecule
 *
 * @param structure - Molecule to determine point group for
 * @param tolerance -  Distance tolerance to consider sites as symmetrically equivalent
 * @param eigenTolerance - Tolerance to compare eigen values of the inertia tensor
 * @param matrixTolerance - Tolerance used to generate the full set of symmetry operations
 * @returns The Schoenflies symbol of the detected point group
 */
export const pointGroupAnalyzer = (structure: Structure,
							tolerance = 0.3,
							eigenTolerance = 0.01,
							matrixTolerance = 0.1): string => {

	// Special cases
	if(structure.atoms.length === 0) return "";
	if(structure.atoms.length === 1) return "Kh";

	// Recenter the atoms around the center of mass
	const center = centerOfMass(structure);
	const centeredStructure: number[][] = [];
	for(const atom of structure.atoms) {

		centeredStructure.push([atom.position[0]-center[0],
							    atom.position[1]-center[1],
							    atom.position[2]-center[2]]);
	}

	// Compute the inertia tensor
	const inertiaTensor = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
	let totalInertia = 0;
	for(let i=0; i<centeredStructure.length; ++i) {

		const atomZ = structure.atoms[i].atomZ;
		const wt = getAtomData(atomZ).mass;
		const c = centeredStructure[i];
		for(let j=0; j < 3; ++j) {
			inertiaTensor[j][j] += wt * (c[(i+1)%3]**2 + c[(i+2)%3]**2);
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
  	const result = computeEigen(inertiaTensor);

	const [v1, v2, v3] = result.eigenvalues;

	const eigZero = Math.abs(v1 * v2 * v3) < eigenTolerance;
	const eigAllSame = Math.abs(v1 - v2) < eigenTolerance && Math.abs(v1 - v3) < eigenTolerance;
	const eigAllDiff = Math.abs(v1 - v2) > eigenTolerance && Math.abs(v1 - v3) > eigenTolerance &&
					   Math.abs(v1 - v3) > eigenTolerance && Math.abs(v2 - v3) > eigenTolerance;

	if(eigZero) {
		console.log("Linear molecule detected");
	}
	else if(eigAllSame) {
		console.log("Spherical top molecule detected");
	}
	else if(eigAllDiff) {
		console.log("Asymmetric top molecule detected");
	}
	else {
		console.log("Symmetric top molecule detected");
	}


	void tolerance;
	void matrixTolerance;
	void centeredStructure;

	return "unzi";
};
