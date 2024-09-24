/**
 * Compute unit cell or supercell vertices coordinates
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-24
 */
import type {BasisType, PositionType} from "@/types";

/**
 * Compute unit cell vertices coordinates
 *
 * @param orig - Cell origin
 * @param basis - Basis vectors
 * @returns - List of vertices coordinates (bottom then top)
 */
export const computeCellVertices = (orig: PositionType, basis: BasisType): number[] => [
	orig[0],                            orig[1],                            orig[2],
	orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
	orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
	orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
	orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
	orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
	orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
	orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
];
