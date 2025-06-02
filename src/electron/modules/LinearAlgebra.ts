/**
 * Linear algebra routines
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-05-26
 */
/** 2D Matrix type */
export type Matrix = number[][];

/**
 * Normalize a 3D vector
 *
 * @param v - Vector to be normalized
 * @returns Normalized vector
 */
export const normalize = (v: number[]): number[] => {
	const length = Math.hypot(v[0], v[1], v[2]);
	return [v[0] / length, v[1] / length, v[2] / length];
};
