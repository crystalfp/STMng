/**
 * Routines translated from Pymatgen structure.py file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
import {getNiggliReducedLattice} from "./PymatgenLattice";
import type {SNL} from "./types";

/**
 * Get a reduced structure
 * The lattice reduction algorithm used is "Niggli"
 *
 * @param snl - The structure to reduce
 * @returns The Niggli-reduced structure
 */
export const getReducedStructure = (snl: SNL): SNL => {

	const reducedLattice = getNiggliReducedLattice(snl.lattice.matrix);

	snl.lattice.matrix = reducedLattice;

	return snl;
};

interface SiteElement {
    element: string;
    frac: number[];
    cart: number[];
}
/**
 * Find a smaller unit cell than the input. Sometimes it doesn't
        find the smallest possible one, so this method is recursively called
        until it is unable to find a smaller cell.

 * @remarks If the tolerance is greater than 1/2 of the minimum inter-site
        distance in the primitive cell, the algorithm will reject this lattice.

        Args:
            tolerance (float): Tolerance for each coordinate of a
                particular site in Angstroms. For example, [0.1, 0, 0.1] in cartesian
                coordinates will be considered to be on the same coordinates
                as [0, 0, 0] for a tolerance of 0.25. Defaults to 0.25.
            use_site_props (bool): Whether to account for site properties in
                differentiating sites.
            constrain_latt (list/dict): List of lattice parameters we want to
                preserve, e.g. ["alpha", "c"] or dict with the lattice
                parameter names as keys and values we want the parameters to
                be e.g. ("alpha": 90, "c": 2.5).

 * @returns The most primitive structure found
 */
export const getPrimitiveStructure = (structure: SNL): SNL => {

    console.log("========");
    console.log(structure);

    // Group sites by species string
    const sites: SiteElement[] = [];
    for(const site of structure.sites) {
        sites.push({element: site.species[0].element, frac: site.abc, cart: site.xyz});
    }
    sites.sort((a, b) => a.element.localeCompare(b.element));
    // for(const s of sites) {
    //     console.log(`${s.element.padStart(2, " ")} [${s.frac[0].toFixed(3)}, ${s.frac[1].toFixed(3)}, ${s.frac[2].toFixed(3)}] -> [${s.cart[0].toFixed(3)}, ${s.cart[1].toFixed(3)}, ${s.cart[2].toFixed(3)}]`);
    // }
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
    // console.log("GROUPED FRACT", groupedFracCoords);

    // minVecs are approximate periodicities of the cell. The exact
    // periodicities from the supercell matrices are checked against these first
    // eslint-disable-next-line unicorn/no-array-reduce, sonarjs/reduce-initial-value
    const minFracCoords = groupedFracCoords.reduce((min, current) =>
        (current.length < min.length ? current : min)
    );
    // console.log("MIN FRACT", minFracCoords);

    const minVecs = minFracCoords.map((coord) =>
      coord.map((value, idx) => value - minFracCoords[0][idx])
    );
    // console.log("MIN VEC", minVecs);
void minVecs;
    // Fractional tolerance in the supercell
    // const superFtol = structure.lattice.abc.map((value) => tolerance / value);
    // const superFtol2 = superFtol.map((value) => value * 2);

	return structure;
};
