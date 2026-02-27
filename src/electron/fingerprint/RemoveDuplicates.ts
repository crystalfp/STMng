/**
 * Remove duplicated structures with distances between them less than threshold.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-02-19
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
import type {FingerprintsAccumulator, StructureReduced} from "./Accumulator";
import type {Distances} from "./Distances";
import {HierarchicalSingleLinkageGrouping} from "./GroupingMethods";
// import {HierarchicalCompleteLinkageGrouping} from "./GroupingMethods";

/**
 * Puts enabled true to the lowest energy structure per group
 *
 * @param enabled - If the reduction should be done
 * @param accumulator - The accumulated structures
 * @param distances - The pair distance object
 * @param threshold - The distance threshold (absolute)
 * @returns The number of points removed or -1 if no point removed
 */
export const removeDuplicatePoints = (enabled: boolean,
                                      accumulator: FingerprintsAccumulator,
                                      distances: Distances,
                                      threshold: number): number => {

    // If reduction not enabled, set enabled on all structures
    if(!enabled) {
        accumulator.setEnableStatus(true);
        return -1;
    }

    // Access useful variables
    const distanceMatrix = distances.getDistanceMatrix();
    const countStructures = accumulator.selectedSize();
    if(countStructures === 0 || distanceMatrix.matrixSize() === 0)  {
        accumulator.setEnableStatus(true);
        return -1;
    }
    const hasEnergies = accumulator.accumulatedHaveEnergies();

    // Do the grouping
    const grouper = new HierarchicalSingleLinkageGrouping();
    // const grouper = new HierarchicalCompleteLinkageGrouping();
    const groups = grouper.doGrouping(countStructures, distanceMatrix, threshold);
    const countGroups = groups.length;
    if(countGroups === 0) {
        accumulator.setEnableStatus(true);
        return -1;
    }

    // Make an index of the structures
    const structures: StructureReduced[] = [];
    for(const structure of accumulator.iterateSelectedStructures()) {
        structures.push(structure);
    }

    // Start with nothing enabled
    accumulator.setEnableStatus(false);
    let countEnabled = 0;

    // For each group
    for(const group of groups) {

        // If group size is one, nothing to remove, enable the only member
        if(group.size === 1) {

            const [idx] = group;
            structures[idx].enabled = true;
        }
        // Else if there are energies find the lowest energy point per group
        else if(hasEnergies) {

            // Find minimum energy
            let minEnergy = Number.POSITIVE_INFINITY;
            let minEnergyIdx = 0;
            for(const i of group) {

                const energy = structures[i].energy!;
                if(energy < minEnergy) {
                    minEnergy = energy;
                    minEnergyIdx = i;
                }
            }
            structures[minEnergyIdx].enabled = true;
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
                    totalDistance += distanceMatrix.get(i, j);
                }
                if(totalDistance < medianDistance) {
                    medianDistance = totalDistance;
                    medianDistanceIdx = i;
                }
            }
            structures[medianDistanceIdx].enabled = true;
        }
        ++countEnabled;
    }

    return countStructures-countEnabled;
};
