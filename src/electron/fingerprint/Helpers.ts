/**
 * Various helper routines used by all fingerprinting methods.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-13
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
import type {BasisType} from "@/types";

/**
 * Compute the unit cell volume
 *
 * @param basis - Unit cell basis vectors
 * @param isNanocluster - Is nanocluster (i.e., has no unit cell). Default false
 * @returns Unit cell volume or zero for nanoclusters
 */
export const getCellVolume = (basis: Float64Array | BasisType, isNanocluster=false): number =>
    (isNanocluster ?
            0 :
            basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
            basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
            basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7]
    );

/**
 * Normalize mapped points coordinates between 0 and 1
 *
 * @param points - Points to be normalized
 * @returns Input points with coordinates mapped between 0 and 1
 */
export const normalizeCoordinates2D = (points: number[][]): number[][] => {

    // Find limits
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
    const normalizedPoints: number[][] = Array<number[]>(n);
    for(let i=0; i < n; ++i) {

        normalizedPoints[i] = [
            (points[i][0] - minX)/denX,
            (points[i][1] - minY)/denY,
        ];
    }

    return normalizedPoints;
};
