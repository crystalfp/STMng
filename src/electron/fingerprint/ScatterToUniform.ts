/**
 * Interpolate the scatter values into a square grid with given sides.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-14
 */
/**
 * Shepard interpolation
 *
 * @param x - Grid point X coordinate
 * @param y - Grid point Y coordinate
 * @param points - List of scatter points coordinates
 * @param energies - Corresponding energies
 * @param power - Factor to weight distances
 * @returns Interpolated value in the (x, y) point
 */
const shepardInterpolation = (x: number,
							  y: number,
							  points: number[][],
							  energies: number[],
							  power = 2): number => {

	let numerator = 0;
	let denominator = 0;

	for(let i = 0; i < points.length; i++) {

		const [px, py] = points[i];
		const distance = Math.hypot(x-px, y-py);
		if(distance === 0) return energies[i];

		const weight = 1 / (distance ** power);
		numerator += weight * energies[i];
		denominator += weight;
	}

	return numerator / denominator;
};

/**
 * Interpolate a set of points into a square grid
 *
 * @param gridSide - Resulting square grid side
 * @param points - Scatter points to interpolate
 * @param energies - Corresponding energies
 * @param power - Factor to weight distances
 * @returns Values on the grid nodes
 */
export const scatterToUniform = (gridSide: number,
								 points: number[][],
								 energies: number[],
								 power = 2): number[] => {

	// Normalize mapped points coordinates between 0 and 1
	let maxX = Number.NEGATIVE_INFINITY;
	let minX = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	for(const point of points) {

		if(point[0] > maxX) maxX = point[0];
		if(point[0] < minX) minX = point[0];
		if(point[1] > maxY) maxY = point[1];
		if(point[1] < minY) minY = point[1];
	}

	let denX = maxX - minX;
	if(denX < 1e-10) denX = 1;
	let denY = maxY - minY;
	if(denY < 1e-10) denY = 1;

	const n = points.length;
	const normalizedPoints: number[][] = Array(n) as number[][];
	for(let i=0; i < n; ++i) {

		normalizedPoints[i] = [
			(points[i][0] - minX)/denX,
			(points[i][1] - minY)/denY,
		];
	}

	const result = Array(gridSide*gridSide).fill(0) as number[];
	for(let i = 0; i < gridSide; i++) {
		for(let j = 0; j < gridSide; j++) {

			const x = i / (gridSide - 1);
			const y = j / (gridSide - 1);
			const interpolatedValue = shepardInterpolation(x, y, normalizedPoints, energies, power);
			result[j * gridSide + i] = interpolatedValue;
		}
	}

	return result;
};
