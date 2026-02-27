/**
 * Remove structures whose distance is less than the threshold
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-24
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
import {HierarchicalSingleLinkageGrouping} from "../fingerprint/GroupingMethods";
import type {VariableCompositionAccumulator} from "./Accumulator";
import type {DistanceMatrix} from "./ComputeDistances";
import type {DistanceMatrix as DistanceMatrixFp} from "../fingerprint/Distances";

/**
 * Puts enabled true to the lowest energy structure per group
 *
 * @param accumulator - The accumulated structures
 * @param indices - Indices of the elements to be analyzed
 * @param distances - The pair distances matrix
 * @param threshold - The distance threshold (absolute)
 * @returns The number of points remaining
 */
export const removeDuplicatePoints = (accumulator: VariableCompositionAccumulator,
									  indices: number[],
                                      distances: DistanceMatrix,
                                      threshold: number): number => {

	const countStructures = indices.length;
    const hasEnergies = accumulator.hasEnergies();

    // Do the grouping
    const grouper = new HierarchicalSingleLinkageGrouping();
    const groups = grouper.doGrouping(countStructures,
									  distances as unknown as DistanceMatrixFp,
									  threshold);
    const countGroups = groups.length;
    if(countGroups === 0) {
        accumulator.setEnableStatus(indices, true);
        return countStructures;
    }

    // Start with nothing enabled
    accumulator.setEnableStatus(indices, false);
    let countEnabled = 0;

    // For each group
    for(const group of groups) {

        // If group size is one, nothing to remove, enable the only member
        if(group.size === 1) {

            const [i] = group;
            const idx = indices[i];
            accumulator.getEntry(idx)!.enabled = true;
        }
        // Else if there are energies find the lowest energy point per group
        else if(hasEnergies) {

            // Find minimum energy
            let minEnergy = Number.POSITIVE_INFINITY;
            let minEnergyIdx = 0;
            for(const i of group) {

                const idx = indices[i];
                const energy = accumulator.getEntry(idx)!.energy;
                if(energy === undefined) continue;
                if(energy < minEnergy) {
                    minEnergy = energy;
                    minEnergyIdx = idx;
                }
            }
            accumulator.getEntry(minEnergyIdx)!.enabled = true;
        }
        // Else finds the most central point using
        // the sum of distances (geometric median)
        else {

            let medianDistance = Number.POSITIVE_INFINITY;
            let medianDistanceIdx = 0;
            for(const i of group) {

                let totalDistance = 0;
                for(const j of group) {

                    if(i === j) continue;
                    totalDistance += distances.get(i, j);
                }
                if(totalDistance < medianDistance) {
                    medianDistance = totalDistance;
                    medianDistanceIdx = i;
                }
            }
            accumulator.getEntry(indices[medianDistanceIdx])!.enabled = true;
        }
        ++countEnabled;
    }

    return countEnabled;
};
