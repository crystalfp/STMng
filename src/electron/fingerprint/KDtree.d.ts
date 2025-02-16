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
export class KDTree {
	constructor(points: Glyph[], keys: string[]);
	nearest: (pt: Record<string, number>) => {point: Record<string, number>; squared_distance: number};
}
