/**
 * Compute Reciprocal lattice for XRD calculations
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-26
 */
/* eslint-disable eslint-comments/disable-enable-pair, unicorn/prevent-abbreviations */
import type {Lattice} from "./Lattice";

/** A point of the reciprocal lattice */
export interface ReciprocalPoint {
    /** Point coordinates */
    coord: number[];
    /** Distance to the center */
    dist: number;
    /** Point index */
    index: number;
    /** Image points */
    image: number[];
}

/**
 * Compute Reciprocal lattice for XRD calculations
 */
export class ReciprocalLattice {

	private readonly lattice: Lattice;

    /**
     * Create the reciprocal lattice
     *
     * @param lattice - Lattice for which the reciprocal one should be built
     */
	constructor(lattice: Lattice) {
        this.lattice = lattice;
    }

	// Find all points within a sphere from the point taking into account
	// periodic boundary conditions. This includes sites in other periodic images.
    //
	// Algorithm:
    //
	// 1. place sphere of radius r in crystal and determine minimum supercell
	//    (parallelepiped) which would contain a sphere of radius r. for this
	//    we need the projection of a_1 on a unit vector perpendicular
	//    to a_2 & a_3 (i.e. the unit vector in the direction b_1) to
	//    determine how many a_1's it will take to contain the sphere.
    //
	//    Nxmax = r * length_of_b_1 / (2 Pi)
    //
	// 2. keep points falling within r.
    //
	// Args:
	//     frac_points: All points in the lattice in fractional coordinates.
	//     center: Cartesian coordinates of center of sphere.
	//     r: radius of sphere.
	//     zip_results (bool): Whether to zip the results together to group by
	//         point, or return the raw frac_coord, dist, index arrays
    //
	// Returns:
	//     if zip_results:
	//         [(frac_coord, dist, index, supercell_image) ...] since most of the time, subsequent
	//         processing requires the distance, index number of the atom, or index of the image
	//     else:
	//         frac_coords, dists, inds, image
    /**
     * Find all points within a sphere from the point taking into account periodic boundary conditions
     *
     * @param radius - Radius of the sphere
     * @returns All points within a sphere from the point
     */
	getPointsInSphereOrigin(radius: number): ReciprocalPoint[] {

        return this.getPointsInSpheres({
            allCoords: this.lattice.origin,
            centerCoords: this.lattice.origin,
            radius,
            numericalTol: 1e-8,
            returnFcoords: true,
		})[0];
	}

    // For each point in `center_coords`, get all the neighboring points
    // in `all_coords` that are within the cutoff radius `r`.
    //
    // Args:
    //     all_coords: (list of Cartesian coordinates) all available points
    //     center_coords: (list of Cartesian coordinates) all centering points
    //     r: (float) cutoff radius
    //     pbc: (bool or a list of bool) whether to set periodic boundaries
    //     numerical_tol: (float) numerical tolerance
    //     lattice: (Lattice) lattice to consider when PBC is enabled
    //     return_fcoords: (bool) whether to return fractional coords when pbc is set.
    //
    // Returns:
    //     List[List[Tuple[coords, distance, index, image]]]
	//
    /**
     * For each point in `center_coords`, get all the neighboring points that are within the cutoff radius
     *
     * @param param0 - Parameters for the computation
     * @returns List of reciprocal points
     */
	getPointsInSpheres({
		allCoords,
		centerCoords,
		radius,
		numericalTol = 1e-8,
		returnFcoords = false}: {
            allCoords: number[];
		    centerCoords: number[];
		    radius: number;
		    numericalTol: number;
		    returnFcoords: boolean;
        }
	): ReciprocalPoint[][] {

        const centerCoordsMin = [centerCoords[0], centerCoords[1], centerCoords[2]];
        const centerCoordsMax = [centerCoords[0], centerCoords[1], centerCoords[2]];

        // The lower bound of all considered atom coords
        const globalMin = [centerCoordsMin[0] - radius - numericalTol,
                           centerCoordsMin[1] - radius - numericalTol,
                           centerCoordsMin[2] - radius - numericalTol];
        const globalMax = [centerCoordsMax[0] + radius + numericalTol,
                           centerCoordsMax[1] + radius + numericalTol,
                           centerCoordsMax[2] + radius + numericalTol];

        const recpLen = this.lattice.reciprocalLatticeLengths();

        const maxr = [Math.ceil((radius + 0.15) * recpLen[0] / (2 * Math.PI)),
                      Math.ceil((radius + 0.15) * recpLen[1] / (2 * Math.PI)),
                      Math.ceil((radius + 0.15) * recpLen[2] / (2 * Math.PI))];
        const fracCoords = this.lattice.toFractionalCoordinates(centerCoords);
        const nminTempFloor = Math.floor(Math.min(...fracCoords));
        const nminTemp = [nminTempFloor - maxr[0],
                          nminTempFloor - maxr[1],
                          nminTempFloor - maxr[2]];
        const nmaxTempCeil = Math.ceil(Math.max(...fracCoords));
        const nmaxTemp = [nmaxTempCeil + maxr[0],
                          nmaxTempCeil + maxr[1],
                          nmaxTempCeil + maxr[2]];
        const nmin = [nminTemp[0], nminTemp[1], nminTemp[2]];
        const nmax = [nmaxTemp[0], nmaxTemp[1], nmaxTemp[2]];

        const allRanges: number[][] = [];
        for(let i=0; i < 3; ++i) {

            const oneRange: number[] = [];
            for(let k=nmin[i]; k < nmax[i]; ++k) oneRange.push(k);
            allRanges.push(oneRange);
        }

        // Temporarily hold the fractional coordinates
        const imageOffsets = this.lattice.toFractionalCoordinates(allCoords);
        const allFracCoords: number[] = [];

        // Only wrap periodic boundary
        for(let kk=0; kk < 3; ++kk) {
            allFracCoords.push(imageOffsets[kk] % 1);
        }

        imageOffsets[0] -= allFracCoords[0];
        imageOffsets[1] -= allFracCoords[1];
        imageOffsets[2] -= allFracCoords[2];

        const coordsInCell = this.lattice.toCartesianCoodinates(allFracCoords);

        // Filter out those beyond max range
        const validCoords: number[][] = [];
        const validImages: number[][] = [];
        const validIndices: number[] = [];

        const {matrix} = this.lattice;

        for(let i=allRanges[0][0]; i <= allRanges[0].at(-1)!; ++i) {
            for(let j=allRanges[1][0]; j <= allRanges[1].at(-1)!; ++j) {
                for(let k=allRanges[2][0]; k <= allRanges[2].at(-1)!; ++k) {

                    const coords = [
                        i*matrix[0]+j*matrix[3]+k*matrix[6] + coordsInCell[0],
                        i*matrix[1]+j*matrix[4]+k*matrix[7] + coordsInCell[1],
                        i*matrix[2]+j*matrix[5]+k*matrix[8] + coordsInCell[2],
                    ];

                    const validIndexBool = coords[0] > globalMin[0] && coords[0] < globalMax[0] &&
                                           coords[1] > globalMin[1] && coords[1] < globalMax[1] &&
                                           coords[2] > globalMin[2] && coords[2] < globalMax[2];

                    const ind = [0];
                    if(validIndexBool) {
                        validCoords.push(coords);
                        validIndices.push(...ind);
                        validImages.push([i-imageOffsets[0], j-imageOffsets[1], k-imageOffsets[2]]);
                    }
                }
            }
        }

        if(validCoords.length === 0) return [[], [], []];

        // Divide the valid 3D space into cubes and compute the cube ids
        let allCubeIndex = this.computeCubeIndex(validCoords, globalMin, radius);
        const nxyz = this.computeCubeIndex([globalMax], globalMin, radius)[0];
        ++nxyz[0]; // nx
        ++nxyz[1]; // ny
        ++nxyz[2]; // nz

        allCubeIndex = this.threeToOne(allCubeIndex, nxyz[1], nxyz[2]);
        const siteCubeIndex = this.threeToOne(this.computeCubeIndex([centerCoords], globalMin, radius),
                                              nxyz[1], nxyz[2]);
        const allCubeIndexFlat = allCubeIndex.flat();
        const len = allCubeIndexFlat.length;

        // Create cube index to coordinates, images, and indices map
        const cubeToCoords = new Map<number, number[][]>();
        const cubeToImages = new Map<number, number[][]>();
        const cubeToIndices = new Map<number, number[]>();
        for(let i=0; i < len; ++i) {

            const ii1 = allCubeIndexFlat[i];
            const jj1 = validCoords[i];
            const kk1 = validImages[i];
            const ll1 = validIndices[i];

            if(cubeToCoords.has(ii1)) {
                cubeToCoords.get(ii1)!.push(jj1);
            }
            else cubeToCoords.set(ii1, [jj1]);
            if(cubeToImages.has(ii1)) {
                cubeToImages.get(ii1)!.push(kk1);
            }
            else cubeToImages.set(ii1, [kk1]);
            if(cubeToIndices.has(ii1)) {
                cubeToIndices.get(ii1)!.push(ll1);
            }
            else cubeToIndices.set(ii1, [ll1]);
        }

        // Find all neighboring cubes for each atom in the lattice cell
        const siteNeighbors = this.findNeighbors(siteCubeIndex, nxyz);

        const ii = centerCoords;
        const jj = siteNeighbors;
        const l1 = this.threeToOne(jj, nxyz[1], nxyz[2]).flat();

        // Use the cube index map to find the all the neighboring
        // coords, images, and indices
        const ks = l1.filter((k) => cubeToCoords.has(k));

        const neighbors: {coord: number[]; dist: number; index: number; image: number[]}[][] = [];
        if(ks.length > 0) {

            const nnCoords  = ks.flatMap((k) => cubeToCoords.get(k));
            const nnImages  = ks.flatMap((k) => cubeToImages.get(k));
            const nnIndices = ks.flatMap((k) => cubeToIndices.get(k));
            const distances = nnCoords.map((pt) => Math.hypot(pt![0] - ii[0], pt![1] - ii[1], pt![2] - ii[2]));

            const nns: {coord: number[]; dist: number; index: number; image: number[]}[] = [];
            for(let i=0; i < nnCoords.length; ++i) {

                const coord = nnCoords[i]!;
                const index = nnIndices[i]!;
                const image = nnImages[i]!;
                const dist  = distances[i]!;

                // Filtering out all sites that are beyond the cutoff
                // Here there is no filtering of overlapping sites
                if(dist < radius + numericalTol) {

                    if(returnFcoords) {
                        // coord = this.lattice.toFractionalCoordinates(coord!);
                        coord[0] = image[0];
                        coord[1] = image[1];
                        coord[2] = image[2];
                    }
                    nns.push({coord, dist, index, image});
                }
            }
            neighbors.push(nns);
        }
        return neighbors;
	}

    // Compute the cube index from coordinates
    // Args:
    //     coords: (nx3 array) atom coordinates
    //     global_min: (float) lower boundary of coordinates
    //     radius: (float) cutoff radius.

    // Returns:
    //     np.ndarray: nx3 array int indices
    //
    private computeCubeIndex(coords: number[][], globalMin: number[], radius: number): number[][] {

        const out: number[][] = [];
        for(const coord of coords) {

            out.push([
                Math.floor((coord[0]-globalMin[0])/radius),
                Math.floor((coord[1]-globalMin[1])/radius),
                Math.floor((coord[2]-globalMin[2])/radius)
            ]);
        }
        return out;
    }

    /**
     * Convert a 3D index array to 1D index array.
        label1d: (array) 1D index array
        ny: (int) number of cells in y direction
        nz: (int) number of cells in z direction
    Returns:
        np.ndarray: nx3 array int indices
     */
    private threeToOne(label3d: number[][], ny: number, nz: number): number[][] {

        const out: number[][] = [];
        for(const one of label3d) {
            const element = one[0]*ny*nz+one[1]*nz+one[2];
            out.push([element]);
        }
        return out;
    }

    /**
     * Convert a 1D index array to 3D index array
     *
     * @param label1d - 1D index array
     * @param ny - number of cells in y direction
     * @param nz - number of cells in z direction
     * @returns nx3 array int indices
     */
    private oneToThree(label1d: number[][], ny: number, nz: number): number[][] {

        const out: number[][] = [];
        for(const label of label1d) {
            const last = label[0] % nz;
            const second = (label[0] - last) / nz % ny;
            const first = (label[0] - last - second * nz) / (ny * nz);
            out.push([first, second, last]);
        }
        return out;
    }

    /**
     * Given a cube index, find the neighbor cube indices.
     *
     *     label: (array) (n,) or (n x 3) indice array
     *     nx: (int) number of cells in y direction
     *     ny: (int) number of cells in y direction
     *     nz: (int) number of cells in z direction
     * Returns:
     *     Neighbor cell indices.
     */
    private findNeighbors(label: number[][], nxyz: number[]): number[][] {

        const neighborVectors: number[][] = [];
        for(let i=-1; i <= 1; ++i) {
            for(let j=-1; j <= 1; ++j) {
                for(let k=-1; k <= 1; ++k) {
                    neighborVectors.push([i, j, k]);
                }
            }
        }
        const label3d = label[0].length === 1 ? this.oneToThree(label, nxyz[1], nxyz[2]) : label;
        const allLabels: number[][] = [];
        // for(let i=0; i < label3d.length; ++i) {
        for(const oneLabel3D of label3d) {
            // for(let j=0; j < neighbor_vectors.length; ++j) {
            for(const neighborVector of neighborVectors) {
                allLabels.push([oneLabel3D[0] - neighborVector[0],
                                oneLabel3D[1] - neighborVector[1],
                                oneLabel3D[2] - neighborVector[2]]);
            }
        }

        // Filter out out-of-bound labels i.e., label < 0
        const filteredLabels: number[][] = [];
        for(const labels of allLabels) {
            if(labels[0] < nxyz[0] && labels[1] < nxyz[1] && labels[2] < nxyz[2] &&
               labels[0] > -1e-5 && labels[1] > -1e-5 && labels[2] > -1e-5) {
                filteredLabels.push(labels);
            }
        }
        return filteredLabels;
    }
}
