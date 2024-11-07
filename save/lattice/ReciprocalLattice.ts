/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-26
 */
import {Lattice} from "./Lattice";

// list[list[tuple[np.ndarray, float, int, np.ndarray]]]
type ReciprocalPoint = {coord: number[]; dist: number; index: number; image: number[]};

export class ReciprocalLattice {

	constructor(private readonly lattice: Lattice) {}

	// Find all points within a sphere from the point taking into account
	// periodic boundary conditions. This includes sites in other periodic images.

	// Algorithm:

	// 1. place sphere of radius r in crystal and determine minimum supercell
	//    (parallelepiped) which would contain a sphere of radius r. for this
	//    we need the projection of a_1 on a unit vector perpendicular
	//    to a_2 & a_3 (i.e. the unit vector in the direction b_1) to
	//    determine how many a_1's it will take to contain the sphere.

	//    Nxmax = r * length_of_b_1 / (2 Pi)

	// 2. keep points falling within r.

	// Args:
	//     frac_points: All points in the lattice in fractional coordinates.
	//     center: Cartesian coordinates of center of sphere.
	//     r: radius of sphere.
	//     zip_results (bool): Whether to zip the results together to group by
	//         point, or return the raw frac_coord, dist, index arrays

	// Returns:
	//     if zip_results:
	//         [(frac_coord, dist, index, supercell_image) ...] since most of the time, subsequent
	//         processing requires the distance, index number of the atom, or index of the image
	//     else:
	//         frac_coords, dists, inds, image
	getPointsInSphereOrigin(radius: number): ReciprocalPoint[] {

        return this.getPointsInSpheres({
            all_coords: this.lattice.origin,
            center_coords: this.lattice.origin,
            radius,
            numerical_tol: 1e-8,
            return_fcoords: true,
		})[0];
	}

    // For each point in `center_coords`, get all the neighboring points
    // in `all_coords` that are within the cutoff radius `r`.

    // Args:
    //     all_coords: (list of Cartesian coordinates) all available points
    //     center_coords: (list of Cartesian coordinates) all centering points
    //     r: (float) cutoff radius
    //     pbc: (bool or a list of bool) whether to set periodic boundaries
    //     numerical_tol: (float) numerical tolerance
    //     lattice: (Lattice) lattice to consider when PBC is enabled
    //     return_fcoords: (bool) whether to return fractional coords when pbc is set.

    // Returns:
    //     List[List[Tuple[coords, distance, index, image]]]
	//
	getPointsInSpheres({
		all_coords,
		center_coords,
		radius,
		numerical_tol = 1e-8,
		return_fcoords = false}:
		{all_coords: number[];
		center_coords: number[];
		radius: number;
		numerical_tol: number;
		return_fcoords: boolean;}
	): ReciprocalPoint[][] {

        const center_coords_min = [center_coords[0], center_coords[1], center_coords[2]];
        const center_coords_max = [center_coords[0], center_coords[1], center_coords[2]];

        // The lower bound of all considered atom coords
        const global_min = [center_coords_min[0] - radius - numerical_tol,
                            center_coords_min[1] - radius - numerical_tol,
                            center_coords_min[2] - radius - numerical_tol];
        const global_max = [center_coords_max[0] + radius + numerical_tol,
                            center_coords_max[1] + radius + numerical_tol,
                            center_coords_max[2] + radius + numerical_tol];

        const recp_len = this.lattice.reciprocalLatticeLengths();

        const maxr = [Math.ceil((radius + 0.15) * recp_len[0] / (2 * Math.PI)),
                    Math.ceil((radius + 0.15) * recp_len[1] / (2 * Math.PI)),
                    Math.ceil((radius + 0.15) * recp_len[2] / (2 * Math.PI))];
        const frac_coords = this.lattice.toFractionalCoordinates(center_coords);
        const nmin_temp_floor = Math.floor(Math.min(...frac_coords));
        const nmin_temp = [nmin_temp_floor - maxr[0],
                        nmin_temp_floor - maxr[1],
                        nmin_temp_floor - maxr[2]];
        const nmax_temp_ceil = Math.ceil(Math.max(...frac_coords));
        const nmax_temp = [nmax_temp_ceil + maxr[0],
                        nmax_temp_ceil + maxr[1],
                        nmax_temp_ceil + maxr[2]];
        const nmin = [nmin_temp[0], nmin_temp[1], nmin_temp[2]];
        const nmax = [nmax_temp[0], nmax_temp[1], nmax_temp[2]];

        const all_ranges: number[][] = [];
        for(let i=0; i < 3; ++i) {

            const oneRange: number[] = [];
            for(let k=nmin[i]; k < nmax[i]; ++k) oneRange.push(k);
            all_ranges.push(oneRange);
        }

        // Temporarily hold the fractional coordinates
        const image_offsets = this.lattice.toFractionalCoordinates(all_coords);
        const all_frac_coords: number[] = []

        // Only wrap periodic boundary
        for(let kk=0; kk < 3; ++kk) {
            all_frac_coords.push(image_offsets[kk] % 1)
        }

        image_offsets[0] -= all_frac_coords[0];
        image_offsets[1] -= all_frac_coords[1];
        image_offsets[2] -= all_frac_coords[2];

        const coords_in_cell = this.lattice.toCartesianCoodinates(all_frac_coords);

        // Filter out those beyond max range
        const valid_coords: number[][] = [];
        const valid_images: number[][] = [];
        const valid_indices: number[] = [];

        const {matrix} = this.lattice;

        for(let i=all_ranges[0][0]; i <= all_ranges[0].at(-1)!; ++i) {
            for(let j=all_ranges[1][0]; j <= all_ranges[1].at(-1)!; ++j) {
                for(let k=all_ranges[2][0]; k <= all_ranges[2].at(-1)!; ++k) {

                    const coords = [
                        i*matrix[0]+j*matrix[3]+k*matrix[6] + coords_in_cell[0],
                        i*matrix[1]+j*matrix[4]+k*matrix[7] + coords_in_cell[1],
                        i*matrix[2]+j*matrix[5]+k*matrix[8] + coords_in_cell[2],
                    ];

                    const valid_index_bool = coords[0] > global_min[0] && coords[0] < global_max[0] &&
                                            coords[1] > global_min[1] && coords[1] < global_max[1] &&
                                            coords[2] > global_min[2] && coords[2] < global_max[2];

                    const ind = [0];
                    if(valid_index_bool) {
                        valid_coords.push(coords);
                        valid_indices.push(...ind);
                        valid_images.push([i-image_offsets[0], j-image_offsets[1], k-image_offsets[2]]);
                    }
                }
            }
        }

        if(valid_coords.length === 0) return [[], [], []];

        // Divide the valid 3D space into cubes and compute the cube ids
        let all_cube_index = this.computeCubeIndex(valid_coords, global_min, radius);
        const nxyz = this.computeCubeIndex([global_max], global_min, radius)[0];
        ++nxyz[0]; // nx
        ++nxyz[1]; // ny
        ++nxyz[2]; // nz

        all_cube_index = this.threeToOne(all_cube_index, nxyz[1], nxyz[2]);
        const site_cube_index = this.threeToOne(this.computeCubeIndex([center_coords], global_min, radius),
                                                nxyz[1], nxyz[2])
        const all_cube_index_flat = all_cube_index.flat();
        const len = all_cube_index_flat.length;

        // Create cube index to coordinates, images, and indices map
        const cube_to_coords = new Map<number, number[][]>();
        const cube_to_images = new Map<number, number[][]>();
        const cube_to_indices = new Map<number, number[]>();
        for(let i=0; i < len; ++i) {

            const ii = all_cube_index_flat[i];
            const jj = valid_coords[i];
            const kk = valid_images[i];
            const ll = valid_indices[i];

            if(cube_to_coords.has(ii)) {
                cube_to_coords.get(ii)!.push(jj);
            }
            else cube_to_coords.set(ii, [jj]);
            if(cube_to_images.has(ii)) {
                cube_to_images.get(ii)!.push(kk);
            }
            else cube_to_images.set(ii, [kk]);
            if(cube_to_indices.has(ii)) {
                cube_to_indices.get(ii)!.push(ll);
            }
            else cube_to_indices.set(ii, [ll]);
        }

        // Find all neighboring cubes for each atom in the lattice cell
        const site_neighbors = this.findNeighbors(site_cube_index, nxyz);

        const ii = center_coords;
        const jj = site_neighbors;
        const l1 = this.threeToOne(jj, nxyz[1], nxyz[2]).flat();

        // Use the cube index map to find the all the neighboring
        // coords, images, and indices
        const ks = l1.filter((k) => cube_to_coords.has(k))

        const neighbors: {coord: number[]; dist: number; index: number; image: number[]}[][] = [];
        if(ks.length > 0) {

            const nn_coords = ks.map((k) => cube_to_coords.get(k)).flat(1);
            const nn_images = ks.map((k) => cube_to_images.get(k)).flat();
            const nn_indices = ks.map((k) => cube_to_indices.get(k)).flat();
            const distances = nn_coords.map((pt) => Math.hypot(pt![0] - ii[0], pt![1] - ii[1], pt![2] - ii[2]));

            const nns: {coord: number[]; dist: number; index: number; image: number[]}[] = [];
            for(let i=0; i < nn_coords.length; ++i) {

                let coord   = nn_coords[i]!;
                const index = nn_indices[i]!;
                const image = nn_images[i]!;
                const dist  = distances[i]!;

                // Filtering out all sites that are beyond the cutoff
                // Here there is no filtering of overlapping sites
                if(dist < radius + numerical_tol) {

                    if(return_fcoords) {
                        // coord = this.lattice.toFractionalCoordinates(coord!);
                        coord[0] = image[0];
                        coord[1] = image[1];
                        coord[2] = image[2];
                    }
                    nns.push({coord, dist, index, image})
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
            ])
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

        const neighbor_vectors: number[][] = [];
        for(let i=-1; i <= 1; ++i) {
            for(let j=-1; j <= 1; ++j) {
                for(let k=-1; k <= 1; ++k) {
                    neighbor_vectors.push([i, j, k]);
                }
            }
        }
        const label3d = label[0].length === 1 ? this.oneToThree(label, nxyz[1], nxyz[2]) : label;
        const all_labels: number[][] = [];
        for(let i=0; i < label3d.length; ++i) {
            for(let j=0; j < neighbor_vectors.length; ++j) {
                all_labels.push([label3d[i][0] - neighbor_vectors[j][0],
                                 label3d[i][1] - neighbor_vectors[j][1],
                                 label3d[i][2] - neighbor_vectors[j][2]]);
            }
        }

        // Filter out out-of-bound labels i.e., label < 0
        const filtered_labels: number[][] = [];
        for(const labels of all_labels) {
            if(labels[0] < nxyz[0] && labels[1] < nxyz[1] && labels[2] < nxyz[2]) {
                if(labels[0] > -1e-5 && labels[1] > -1e-5 && labels[2] > -1e-5) {
                    filtered_labels.push(labels);
                }
            }
        }
        return filtered_labels;
    }
}
