/**
 * Math helper functions for the crystal shape computation.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-15
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
const RTOL = 1e-5;
const ATOL = 1e-8;

// --- helpers ---

export const argsortByAbsRow = (row: number[]): number[] => {
  return row
            .map((v, i) => [Math.abs(v), i] as [number, number])
            .toSorted((a, b) => a[0] - b[0])
            .map(([, i]) => i);
};

export const cross3 = (a: number[], b: number[]): number[] => {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0],
    ];
};

export const norm = (v: number[]): number => {
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
};

export const det3x3 = (m: number[][]): number => {
    return (
        m[0][0] * (m[1][1]*m[2][2] - m[1][2]*m[2][1]) -
        m[0][1] * (m[1][0]*m[2][2] - m[1][2]*m[2][0]) +
        m[0][2] * (m[1][0]*m[2][1] - m[1][1]*m[2][0])
    );
};

export const solve3x3 = (m: number[][], b: number[]): number[] => {

    const det = det3x3(m);
    // Cramer's rule
    const solve1D = (col: number): number => {
        const t = m.map((row, i) =>
            row.map((v, j) => (j === col ? b[i] : v))
        );
        return det3x3(t) / det;
    };
    return [solve1D(0), solve1D(1), solve1D(2)];
};

/** np.isclose equivalent: |a - b| \<= atol + rtol * |b| */
export const isClose = (a: number, b: number, atol = ATOL, rtol = RTOL): boolean => {
    return Math.abs(a - b) <= atol + rtol * Math.abs(b);
};

/** Dot product of two vectors */
export const dot = (a: number[], b: number[]): number => {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
};

export const dot3 = (a: number[], b: number[]): number =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Subtract two 3-vectors. */
export const sub3 = (a: number[], b: number[]): number[] =>
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Invert a 3×3 matrix (row-major). Returns undefined if singular. */
export const inv3 = (m: number[][]): number[][] | undefined => {
  const [[a, b, c], [d, e, f], [g, h, k]] = m;
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
  if(Math.abs(det) < 1e-14) return undefined;
  const inv = 1 / det;
  return [
    [(e * k - f * h) * inv, (c * h - b * k) * inv, (b * f - c * e) * inv],
    [(f * g - d * k) * inv, (a * k - c * g) * inv, (c * d - a * f) * inv],
    [(d * h - e * g) * inv, (b * g - a * h) * inv, (a * e - b * d) * inv],
  ];
};

/** Multiply a 1×3 row vector by a 3×3 matrix, returning a 1×3 result. */
export const mulVecMat3 = (v: number[], m: number[][]): number[] => [
	v[0] * m[0][0] + v[1] * m[1][0] + v[2] * m[2][0],
	v[0] * m[0][1] + v[1] * m[1][1] + v[2] * m[2][1],
	v[0] * m[0][2] + v[1] * m[1][2] + v[2] * m[2][2],
];

/**
 * Euclidean distance between two 3-vectors.
 * Inlined to avoid building full distance matrices.
 */
export const euclidean = (a: number[], b: number[]): number => {
    return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
};

export const matVec = (m: number[][], v: number[]): number[] => {
  	return m.map((row) => row.reduce((s, value, i) => s + value * v[i], 0));
};

const transpose2D = (m: number[][]): number[][] => {
  	return Array.from({length: m[0].length}, (_, i) => m.map((row) => row[i]));
};

export const dotRows = (points: number[][], m: number[][]): number[][] => {
  return points.map((p) => matVec(transpose2D(m), p));
};

export const cdist = (A: number[][], B: number[][]): number[][] => {
  return A.map((a) =>
    B.map((b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i])**2, 0)))
  );
};

export const range = (lo: number, hi: number): number[] =>
    Array.from({length: hi - lo}, (_, i) => lo + i);
