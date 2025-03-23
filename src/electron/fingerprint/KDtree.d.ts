/**
 * Points from the fingerprinting scatterplot
 * @notExported
 */
interface Glyph {

	/** The original step number or sequence number for fidelity display */
	id: number;

	/** X point coordinate (range 0..1) */
	px: number;

	/** Y point coordinate (range 0..1) */
	py: number;

	/** The color of the point as "#RRGGBB" */
	color: string;

	/** Value associated to the point: group, energy, or delta for fidelity */
	value: number;
}

/**
 * KDtree class
 */
export class KDTree {
	/**
	 * Create the KDtree from the given points
	 *
	 * @param points - Points from the scatterplot
	 * @param keys - Keys of the points objects containing x and y values
	 */
	constructor(points: Glyph[], keys: string[]);

	/**
	 * Function returning the list of points near the given points
	 */
	nearest: (pt: Record<string, number>) => {point: Record<string, number>; squared_distance: number};
}
