/**
 * Compute unit cell or supercell vertices coordinates
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-24
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import type {BasisType, PositionType} from "@/types";

/**
 * Compute unit cell vertices coordinates
 * Ordered: (below) 0-1-2-3 (above) 4-5-6-7
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
