/**
 * Compute enthalpy transition under pressure changes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-30
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
import {quickHull} from "@derschmale/tympanum";
import type {StructureSetsAccumulator} from "./Accumulator";

/** Enthalpy transitions */
export interface TransitionTable {
	/** Structure step */
	steps: number[];
	/** Structure formula */
	formulas: string[];
	/** Transition pressure */
	pressures: number[];
}

/**
 * Compute enthalpy transitions
 *
 * @param accumulator - Accumulated structures
 * @returns Table of enthalpy structures transitions
 */
export const computeTransitions = (accumulator: StructureSetsAccumulator): TransitionTable => {

	const transitionTable: TransitionTable = {
		steps: [],
		formulas: [],
		pressures: []
	};

	const points: number[][] = [];
	const pointsSteps: number[] = [];
	const pointsFormulas: string[] = [];
	for(const entry of accumulator.iterateEnabledStructures()) {
		points.push([entry.volume, entry.energy]);
		pointsSteps.push(entry.step);
		pointsFormulas.push(entry.formula);
	}
	if(points.length < 3) return transitionTable;

	const hull = quickHull(points);
	const toOrder: {v: number; e: number; idx: number}[] = [];

	for(const facet of hull) {
		if(facet.plane[1] < -1e-4) {
			const [v1, v2] = facet.verts;

			toOrder.push({v: points[v1][0], e: points[v1][1], idx: v1},
						 {v: points[v2][0], e: points[v2][1], idx: v2});
		}
	}

	// Sort convex hull points by increasing volume value
	toOrder.sort((a, b) => {
		if(a.v !== b.v) return a.v - b.v;
		return a.e - b.e;
	});

	// Remove duplicated convex hull points
	let len = toOrder.length;

	const volumes  = [toOrder[0].v];
	const energies = [toOrder[0].e];
	const indices  = [toOrder[0].idx];

	for(let i=0, j=1; j < len; ++j) {
		if(Math.abs(toOrder[i].v-toOrder[j].v) > 1e-4 ||
			Math.abs(toOrder[i].e-toOrder[j].e) > 1e-4) {

			volumes.push(toOrder[j].v);
			energies.push(toOrder[j].e);
			indices.push(toOrder[j].idx);
			i = j;
		}
	}

	len = volumes.length;
	for(let i=0; i < len-1; ++i) {

		const pressure = ((energies[i+1] - energies[i]) / (volumes[i+1] - volumes[i]))*160.218;

		const idx = indices[i];
		transitionTable.steps.push(pointsSteps[idx]);
		transitionTable.formulas.push(pointsFormulas[idx]);
		transitionTable.pressures.push(pressure);
	}

	return transitionTable;
};
