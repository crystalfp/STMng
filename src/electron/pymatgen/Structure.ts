/**
 * Routines translated from Pymatgen structure.py file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 *
 * This code is ported from the Python Pymatgen library:
 *
 * Shyue Ping Ong, William Davidson Richards, Anubhav Jain, Geoffroy Hautier,
 * Michael Kocher, Shreyas Cholia, Dan Gunter, Vincent Chevrier, Kristin A.
 * Persson, Gerbrand Ceder. Python Materials Genomics (pymatgen): A Robust,
 * Open-Source Python Library for Materials Analysis. Computational Materials
 * Science, 2013, 68, 314–319. https://doi.org/10.1016/j.commatsci.2012.10.028
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {inv, multiply, transpose} from "mathjs";
import {getNiggliReducedLattice, matrixToLattice} from "./Lattice";
import {pbc} from "./Utility";
import type {Site, SNL} from "./types";

/**
 * Get a reduced structure
 * The lattice reduction algorithm used is "Niggli"
 *
 * @param snl - The structure to reduce
 * @returns The Niggli-reduced structure
 */
export const getReducedStructure = (snl: SNL): SNL => {

    const reducedLattice = getNiggliReducedLattice(snl.lattice.matrix);
    const r1t = transpose(reducedLattice);
    const irl = inv(r1t);
    for(const site of snl.sites) {

        const rr = multiply(irl, site.xyz);
        if(rr[0] < 0) rr[0] += 1;
        if(rr[1] < 0) rr[1] += 1;
        if(rr[2] < 0) rr[2] += 1;
        if(rr[0] >= 1) rr[0] -= 1;
        if(rr[1] >= 1) rr[1] -= 1;
        if(rr[2] >= 1) rr[2] -= 1;

        site.abc = rr;

        site.xyz = multiply(r1t, rr);
    }
	snl.lattice.matrix = reducedLattice;

	return snl;
};

/**
 * Result of site search
 * @notExported
 */
interface SiteElement {
    element: string;
    frac: number[];
    cart: number[];
}

/**
 * Get the fractional coords in fc1 that have coordinates
 * within tolerance to some coordinate in fc2.
 *
 * @param fc1 - Fractional coordinates to test
 * @param fc2 - Test coordinates
 * @param tol - Tolerance
 * @returns The nearest coordinates
 */
const pbcCoordIntersection = (
      fc1: number[][],
      fc2: number[][],
      tol: number[]): number[][] => {

    // Calculate pairwise distances with broadcasting
    // dist[i][j][k] = fc1[i][k] - fc2[j][k]
    const dist: number[][][] = fc1.map((point1) =>
        fc2.map((point2) =>
            point1.map((value, k) => value - point2[k]))
    );

    // Apply periodic boundary conditions: dist -= round(dist)
    const distPbc: number[][][] = dist.map((row) =>
        row.map((point) =>
            point.map((value) => pbc(value)))
    );

    // Check if all coordinates are within tolerance
    // all(dist < tol, axis=-1): for each pair, check if all dims < tol
    const allWithinTol: boolean[][] = distPbc.map((row) =>
        row.map((point) =>
            point.every((value, k) => value < tol[k]))
    );

    // any(axis=-1): for each fc1 point, check if any fc2 point matches
    const anyMatch: boolean[] = allWithinTol.map((row) => row.some(Boolean));

    // Filter fc1 points where anyMatch is true
    return fc1.filter((_, i) => anyMatch[i]);
};

/**
 * Compute the greatest common divisor
 *
 * @param a - First number
 * @param b - Second number
 * @returns Their greatest common divisor
 */
const gcd = (a: number, b: number): number => {
    while(b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
    }
    return a;
};

// eslint-disable-next-line unicorn/no-array-reduce, sonarjs/reduce-initial-value
const gcdArray = (numbers: number[]): number => numbers.reduce((accumulator, current) =>
    gcd(accumulator, current));

/**
 * Return the factors of a given number
 *
 * @param n - Number to be factorized
 * @returns Factors one by one without their multiplicity
 */
function* factors(n: number): Generator<number> {
    for(let idx = 1; idx <= n; idx++) {
        if(n % idx === 0) {
            yield idx;
        }
    }
}

const getHnf = function* (formUnits: number): Generator<[number, number[][][]]> {

    for(const det of factors(formUnits)) {

        if(det === 1) continue;

        for(const a of factors(det)) {
            for(const e of factors(Math.floor(det / a))) {
                const g = Math.floor(det / a / e);
                const supercellMatrices: number[][][] = [];

                for(let b = 0; b < a; b++) {
                    for(let c = 0; c < a; c++) {
                        for(let f = 0; f < e; f++) {
                            supercellMatrices.push([
                                [a, b, c],
                                [0, e, f],
                                [0, 0, g]
                            ]);
                        }
                    }
                }

                yield [det, supercellMatrices];
            }
        }
    }
};

const vectorsMatrixMultiply = (vectors: number[][], matrix: number[][]): number[][] => {

    const size = matrix[0].length;

    return vectors.map((vec) => {
        const result: number[] = [];
        const len = vec.length;
        for(let j = 0; j < size; j++) {
            result[j] = 0;
            for(let k = 0; k < len; k++) {
                result[j] += vec[k] * matrix[k][j];
            }
        }
        return result;
    });
};

/**
 * Find a smaller unit cell than the input. Sometimes it doesn't
        find the smallest possible one, so this method is recursively called
        until it is unable to find a smaller cell.
 *
 * @remarks If the tolerance is greater than 1/2 of the minimum inter-site
        distance in the primitive cell, the algorithm will reject this lattice.
 *
 * @param structure - The structure to be transformed
 * @param tolerance - Tolerance for each coordinate of a
                particular site in Angstroms. For example, [0.1, 0, 0.1] in cartesian
                coordinates will be considered to be on the same coordinates
                as [0, 0, 0] for a tolerance of 0.25. Defaults to 0.25.
 * @param constrainLatt - List of lattice parameters we want to
                preserve, e.g. ["alpha", "c"] or dict with the lattice
                parameter names as keys and values we want the parameters to
                be e.g. ("alpha": 90, "c": 2.5).
 * @returns The most primitive structure found
 */
export const getPrimitiveStructure = (structure: SNL, tolerance = 0.25,
    constrainLatt: string[] | Record<string, number> | null = []
): SNL => {

    // Group sites by species string
    const sites: SiteElement[] = [];
    for(const site of structure.sites) {
        sites.push({element: site.species[0].element, frac: site.abc, cart: site.xyz});
    }
    sites.sort((a, b) => a.element.localeCompare(b.element));

    const map = new Map<string, SiteElement[]>();
    for(const element of sites) {
        const key = element.element;
        if(!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(element);
    }
    const groupedSites = [...map.values()];
    const groupedFracCoords = groupedSites.map((group) =>
      group.map((s) => s.frac)
    );

    // minVecs are approximate periodicities of the cell. The exact
    // periodicities from the supercell matrices are checked against these first
    // eslint-disable-next-line unicorn/no-array-reduce, sonarjs/reduce-initial-value
    const minFracCoords = groupedFracCoords.reduce((min, current) =>
        (current.length < min.length ? current : min)
    );

    let minVecs = minFracCoords.map((coord) =>
        coord.map((value, idx) => value - minFracCoords[0][idx])
    );

    const abc = [
        Math.hypot(structure.lattice.matrix[0][0],
                   structure.lattice.matrix[0][1],
                   structure.lattice.matrix[0][2]),
        Math.hypot(structure.lattice.matrix[1][0],
                   structure.lattice.matrix[1][1],
                   structure.lattice.matrix[1][2]),
        Math.hypot(structure.lattice.matrix[2][0],
                   structure.lattice.matrix[2][1],
                   structure.lattice.matrix[2][2])
    ];

    // Fractional tolerance in the supercell
    const superFtol  = abc.map((value) => tolerance / value);
    const superFtol2 = superFtol.map((value) => value * 2);

    // Reduce min_vecs by enforcing mapping constraints
    for(const group of [...groupedFracCoords].toSorted((a, b) => a.length - b.length)) {
        for(const fracCoords of group) {
            const shiftedGroup = group.map((coord) =>
                coord.map((value, idx) => value - fracCoords[idx])
            );
            minVecs = pbcCoordIntersection(minVecs, shiftedGroup, superFtol2);
        }
    }

    // We can't let sites match to their neighbors in the supercell
    const groupedNonNbrs: boolean[][][] = [];
    for(const gfCoords of groupedFracCoords) {

        const nonNbrs: boolean[][] = [];
        const len = gfCoords.length;

        for(let i = 0; i < len; i++) {

            nonNbrs[i] = [];
            for(let j = 0; j < len; j++) {

                const fdist = gfCoords[i].map((value, idx) => {
                    let diff = value - gfCoords[j][idx];
                    diff = pbc(diff);
                    return Math.abs(diff);
                });

                const isNonNeighbor = fdist.some((d, idx) => d > 2 * superFtol[idx]);
                nonNbrs[i][j] = i === j || isNonNeighbor; // Sites match to themselves
            }
        }
        groupedNonNbrs.push(nonNbrs);
    }
    const numberFu = gcdArray(groupedSites.map((group) => group.length));

    for(const [size, ms] of getHnf(numberFu)) {

        const invMs = ms.map((m) => inv(m));

        // Find sets of lattice vectors present in min_vecs
        const validIndices: number[] = [];

        const len = invMs.length;
        for(let i = 0; i < len; i++) {

            const invM = invMs[i];
            let allClose = true;

            for(let row = 0; row < 3; row++) {
                let anyClose = false;
                for(const minVec of minVecs) {
                    const dist = invM[row].map((value, idx) => {
                        let diff = value - minVec[idx];
                        diff = pbc(diff);
                        return Math.abs(diff);
                    });

                    if(dist.every((d, idx) => d < superFtol[idx])) {
                        anyClose = true;
                        break;
                    }
                }
                if(!anyClose) {
                    allClose = false;
                    break;
                }
            }

            if(allClose) {
                validIndices.push(i);
            }
        }

        for(const idx of validIndices) {

            const invM = invMs[idx];
            const lattMat = ms[idx];

            const mNew = multiply(invM, structure.lattice.matrix);
            const ftol = mNew.map((row) =>
                tolerance / Math.sqrt(row.reduce((sum, value) => sum + value * value, 0))
            );

            let valid = true;
            const coordsNew: number[][] = [];
            const spNew: string[] = [];
            const labelsNew: string[] = [];

            const groupedSitesLength = groupedSites.length;
            for(let groupIdx = 0; groupIdx < groupedSitesLength && valid; groupIdx++) {

                const gsites = groupedSites[groupIdx];
                const gfCoords = groupedFracCoords[groupIdx];
                const nonNbrs = groupedNonNbrs[groupIdx];

                const allFrac = vectorsMatrixMultiply(gfCoords, lattMat);

                // Calculate grouping of equivalent sites
                const closeInPrim: boolean[][] = [];
                const allFracLength = allFrac.length;
                for(let i = 0; i < allFracLength; i++) {
                    closeInPrim[i] = [];
                    for(let j = 0; j < allFracLength; j++) {
                        const fdist = allFrac[i].map((value, ii) => {
                            const diff = value - allFrac[j][ii];
                            return Math.abs(pbc(diff));
                        });
                        closeInPrim[i][j] = fdist.every((d, ii) => d < ftol[ii]);
                    }
                }

                const groups: boolean[][] = closeInPrim.map((row, i) =>
                    row.map((value, j) => value && nonNbrs[i][j])
                );

                // Check that groups are correct
                const groupSums = groups[0].map((_, colIdx) =>
                    groups.reduce((sum, row) => sum + (row[colIdx] ? 1 : 0), 0)
                );

                if(!groupSums.every((sum) => sum === size)) {
                    valid = false;
                    break;
                }

                // Check that groups are all cliques
                for(const group of groups) {

                    const groupIndices = group
                                            .map((value, ii) => (value ? ii : -1))
                                            .filter((ii) => ii >= 0);

                    for(const idx1 of groupIndices) {
                        for(const idx2 of groupIndices) {
                            if(!groups[idx1][idx2]) {
                                valid = false;
                                break;
                            }
                        }
                        if(!valid) break;
                    }
                    if(!valid) break;
                }

                if(!valid) break;

                // Add new sites, averaging positions
                const added = Array<boolean>(gsites.length).fill(false);
                const fracCoordsNew = allFrac.map((coord) => coord.map((value) => value % 1));

                const groupsLength = groups.length;
                for(let grpIdx = 0; grpIdx < groupsLength; grpIdx++) {
                    if(!added[grpIdx]) {
                        const group = groups[grpIdx];
                        const inds = group
                                        .map((value, ii) => (value ? ii : -1))
                                        .filter((ii) => ii >= 0);

                        for(const ind of inds) added[ind] = true;

                        let coords = [...fracCoordsNew[inds[0]]];
                        const indsLength = inds.length;
                        for(let innerIdx = 1; innerIdx < indsLength; innerIdx++) {
                            const ind = inds[innerIdx];
                            // eslint-disable-next-line no-loop-func
                            const offset = fracCoordsNew[ind].map((value, ii) => value - coords[ii]);
                            const adjustedOffset = offset.map((value) => pbc(value));
                            coords = coords.map((coord, ii) =>
                                coord + adjustedOffset[ii] / (innerIdx + 1)
                            );
                        }

                        spNew.push(gsites[inds[0]].element);
                        labelsNew.push(gsites[inds[0]].element);

                        coordsNew.push(coords);
                    }
                }
            }

            if(valid) {

                const invLattMat = inv(lattMat);
                const lattMatrixNew = multiply(invLattMat, structure.lattice.matrix);
                const lattNew = matrixToLattice(lattMatrixNew);
                const struct: SNL = {
                    sites: coordsNew.map((coord, ii): Site => ({
                        abc: coord,
                        xyz: multiply(invLattMat, coord),
                        label: labelsNew[ii],
                        species: [
                            {element: spNew[ii], occu: 1}
                        ]
                    })),
                    lattice: lattNew
                };

                // Recursively call to get the most primitive structure
                const primitive = getPrimitiveStructure(
                    struct,
                    tolerance,
                    constrainLatt
                );

                if(!constrainLatt || (Array.isArray(constrainLatt) && constrainLatt.length === 0)) {
                    return primitive;
                }
                /*
                // Check lattice constraints
                if(Array.isArray(constrainLatt)) {
                    // Implementation would need lattice parameter extraction logic
                    return primitive;
                }
                else {
                    const keys = Object.keys(constrainLatt);
                    // Would need to implement lattice parameter comparison
                    return primitive;
                }
                */
            }
        }
    }

	return structure;
};
