/**
 * Porting of the StructureMatcher class from
 * pymatgen/analysis/structure_matcher.py
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-14
 */
/* eslint-disable unicorn/no-null */

import {inv, multiply} from "mathjs";
import {LinearAssignment} from "./LinearAssignment";
import {isCoordSubsetPbc, latticePointsInSupercell,
        pbcShortestVectors} from "./Coords";
import {findAllMappings, getLLLmatrices, matrixToLattice, paramsToLattice,
        reciprocalLatticeLengths} from "./Lattice";
import {getReducedStructure} from "./Structure";
import {addVectors, determinant, getFractionalCoords, norm, pbc,
        subtractVectors} from "./Utility";
import type {Lattice, SNL} from "./types";

/**
 * Result of structure matching
 * @notExported
 */
interface MatchResult {
    rms: number;
    maxDist: number;
    mask: number[][];
    cost: number;
    mapping: number[];
}

/**
 * Supercell search result
 * @notExported
 */
interface SupercellResult {
  s1Coords: number[][];
  s2Coords: number[][];
  avgLattice: Lattice;
  supercellMatrix: number[][];
}

/**
 * Scale a lattice
 *
 * @param lattice - Lattice to be scaled
 * @param scale - Scale value
 */
const scaleLattice = (lattice: Lattice, scale: number): void => {

    for(let row=0; row < 3; ++row) {
        for(let col=0; col < 3; ++col) lattice.matrix[row][col] *= scale;
    }
    lattice.a *= scale;
    lattice.b *= scale;
    lattice.c *= scale;
    lattice.volume *= scale ** 3;
};

/**
 * Extract unique species from the given structure
 *
 * @param structure - Structure to be analyzed
 * @returns - List of distinct species in the structure
 */
const getElements = (structure: SNL): string[] => {

    const elements = new Set<string>();
    for(const site of structure.sites)  {
        for(const species of site.species) {
            elements.add(species.element);
        }
    }
    return [...elements];
};

/**
 * Retrieve species and corresponding count from the given structure
 *
 * @param structure - Structure to be analyzed
 * @returns Map from specie to its count
 */
const getComposition = (structure: SNL): Map<string, number> => {

    const composition = new Map<string, number>();
    for(const site of structure.sites) {
        for(const species of site.species) {
            if(composition.has(species.element)) {
                composition.set(species.element, composition.get(species.element)! + species.occu);
            }
            else {
                composition.set(species.element, species.occu);
            }
        }
    }
    return composition;
};

/**
 * Match structures by similarity.

    Algorithm:
    1. Given two structures: s1 and s2
    2. Optional: Reduce to primitive cells.
    3. If the number of sites do not match, return False
    4. Reduce to s1 and s2 to Niggli Cells
    5. Optional: Scale s1 and s2 to same volume.
    6. Optional: Remove oxidation states associated with sites
    7. Find all possible lattice vectors for s2 within shell of ltol.
    8. For s1, translate an atom in the smallest set to the origin
    9. For s2: find all valid lattices from permutations of the list
       of lattice vectors (invalid if: det(Lattice Matrix) less than half
       volume of original s2 lattice)
    10. For each valid lattice:

        a. If the lattice angles of are within tolerance of s1,
           basis change s2 into new lattice.
        b. For each atom in the smallest set of s2:

            i. Translate to origin and compare fractional sites in
            structure within a fractional tolerance.
            ii. If true:

                ia. Convert both lattices to Cartesian and place
                both structures on an average lattice
                ib. Compute and return the average and max rms
                displacement between the two structures normalized
                by the average free length per atom

                if fit function called:
                    if normalized max rms displacement is less than
                    stol. Return True

                if get_rms_dist function called:
                    if normalized average rms displacement is less
                    than the stored rms displacement, store and
                    continue. (This function will search all possible
                    lattices for the smallest average rms displacement
                    between the two structures)
*/
export class StructureMatcher {

    /** Fractional length tolerance */
	public ltol: number;
    /** Site tolerance. Defined as the fraction of the
        average free length per atom := ( V / Nsites ) ** (1/3) */
	public stol: number;
    /** Angle tolerance in degrees */
	public angleTol: number;

    /**
        Args:
            ltol (float): Fractional length tolerance. Default is 0.2.
            stol (float): Site tolerance. Defined as the fraction of the
                average free length per atom := ( V / Nsites ) ** (1/3)
                Default is 0.3.
            angleTol (float): Angle tolerance in degrees. Default is 5 degrees.
            primitive_cell (bool): If true: input structures will be reduced to
                primitive cells prior to matching. Default to True.
            scale (bool): Input structures are scaled to equivalent volume if
               true; For exact matching, set to False.
            attempt_supercell (bool): If set to True and number of sites in
                cells differ after a primitive cell reduction (divisible by an
                integer) attempts to generate a supercell transformation of the
                smaller cell which is equivalent to the larger structure.
            allow_subset (bool): Allow one structure to match to the subset of
                another structure. Eg. Matching of an ordered structure onto a
                disordered one, or matching a delithiated to a lithiated
                structure. This option cannot be combined with
                attempt_supercell, or with structure grouping.
            comparator (Comparator): A comparator object implementing an equals
                method that declares equivalency of sites. Default is
                SpeciesComparator, which implies rigid species
                mapping, i.e., Fe2+ only matches Fe2+ and not Fe3+.

                Other comparators are provided, e.g. ElementComparator which
                matches only the elements and not the species.

                The reason why a comparator object is used instead of
                supplying a comparison function is that it is not possible to
                pickle a function, which makes it otherwise difficult to use
                StructureMatcher with Python's multiprocessing.
            supercell_size (str or list): Method to use for determining the
                size of a supercell (if applicable). Possible values are
                'num_sites', 'num_atoms', 'volume', or an element or list of elements
                present in both structures.
            ignored_species (list): A list of ions to be ignored in matching.
                Useful for matching structures that have similar frameworks
                except for certain ions, e.g. Li-ion intercalation frameworks.
                This is more useful than allow_subset because it allows better
                control over what species are ignored in the matching.
     * @param ltol - Fractional length tolerance
     * @param stol - Site tolerance. Defined as the fraction of the
                average free length per atom := ( V / Nsites ) ** (1/3)
     * @param angleTol - Angle tolerance in degrees
     */
	constructor(ltol = 0.2, stol = 0.3, angleTol = 5) {

        this.ltol = ltol;
        this.stol = stol;
        this.angleTol = angleTol;
	}

    /**
     * Rescales, finds the reduced structures (primitive and niggli),
        and finds fu, the supercell size to make struct1 comparable to s2.
     *
     * @param struct1 - First structure to prepare
     * @param struct2 - Second structure to prepare
     * @param skipStructureReduction - If it is True, skip to get reduced structures
        (by primitive transformation and niggli reduction).
        This option is useful for fitting a set of structures several times.
     * @returns Structure made comparable, the supercell size fu to make struct1 comparable to s2
        and if structure1 has a supercell
     */
    private preprocess(struct1: SNL, struct2: SNL, skipStructureReduction = false):
        {struct1: SNL; struct2: SNL; fu: number; s1Supercell: boolean} {

        const fu = 1;
        const s1Supercell = true;

        if(skipStructureReduction) {
            // Need to copy original structures to rescale lattices later
            struct1 = structuredClone(struct1);
            struct2 = structuredClone(struct2);
        }
        else {
            struct1 = getReducedStructure(struct1);
            struct2 = getReducedStructure(struct2);
        }

        // Rescale lattice to same volume
        const ratio = (struct2.lattice.volume / struct1.lattice.volume) ** (1 / 6);
        scaleLattice(struct1.lattice, ratio);
        scaleLattice(struct2.lattice, 1/ratio);

        return {struct1, struct2, fu, s1Supercell};
    }

	/**
     * Performs an anonymous fitting, which allows distinct species in one
     * structure to map to another. e.g. to compare if the Li2O and Na2O
     * structures are similar.
     *
     * @param struct1 - 1st structure
     * @param struct2 - 2nd structure
     * @param skipStructureReduction - Defaults to False
                If True, skip to get a primitive structure and perform Niggli
                reduction for struct1 and struct2
     * @returns True if a species mapping can map struct1 to struct2
	 */
	fitAnonymous(struct1: SNL, struct2: SNL, skipStructureReduction = false): [Map<string, string>, MatchResult][] | null {

        const {struct1: s1, struct2: s2, fu, s1Supercell} = this.preprocess(struct1, struct2, skipStructureReduction);

        const matches = this.anonymousMatch(s1, s2, fu, s1Supercell);

        return matches;
	}

    /**
     *  Defines a hash to group structures. This allows structures to be
        grouped efficiently for comparison. The hash must be invariant under
        supercell creation. (e.g. composition is not a good hash, but
        fractional_composition might be). Reduced formula is not a good formula,
        due to weird behavior with fractional occupancy.

        Composition is used here instead of structure because for anonymous
        matches it is much quicker to apply a substitution to a composition
        object than a structure object.
     *
     * @param composition - Composition of the structure
     * @returns The structure has as a string
     */
    private getHash(composition: Map<string, number>): string {

        let natoms = 0;
        for(const count of composition.values()) {
            natoms += count;
        }

        const parts: string[] = [];
        for(const [k, v] of composition) {
            const count = (v/natoms).toFixed(8);
            parts.push(`${k}${count}`);
        }

        return parts.toSorted((a, b) => a.localeCompare(b)).join("");
    }

    /**
     * Replace species
     *
     * @param mappedStruct - Structure on which the in place swapping should happens
     * @param spMapping - Species to swap. Species can be elements too. e.g.
                (Element("Li"): Element("Na")) performs a Li for Na substitution.
     */
    private replaceSpecies(mappedStruct: SNL, spMapping: Map<string, string>): void {

        for(const site of mappedStruct.sites) {
            const mappedElement = spMapping.get(site.species[0].element)!;
            site.species[0].element = mappedElement;
            site.label = mappedElement;
        }
    }

    /**
     * Tries all permutations of matching struct1 to struct2.
     *
     * @param struct1 - First structure
     * @param struct2 - Second structure
     * @param fu - Factor of unit cell of struct1 to match to struct2
     * @param s1Supercell - whether to create the supercell of struct1 (vs struct2)
     * @param useRms - Whether to minimize the rms of the matching
     * @param breakOnMatch - Whether to break search on first match
     * @param singleMatch - Whether to return only the best match
     * @returns List of (mapping, match) tuples
     */
    private anonymousMatch(
        struct1: SNL,
        struct2: SNL,
        fu: number,
        s1Supercell = true,
        useRms = false,
        breakOnMatch = true,
        singleMatch = true
    ): [Map<string, string>, MatchResult][] | null {

        // Check that species lists are comparable
        const sp1 = getElements(struct1);
        const sp2 = getElements(struct2);
        const sp1Length = sp1.length;

        if(sp1Length !== sp2.length) return null;

        const ratio = s1Supercell ? fu : 1 / fu;
        const swapped = struct1.sites.length * ratio < struct2.sites.length;
        const s1Comp = getComposition(struct1);
        const s2Comp = getComposition(struct2);
        const matches: [Map<string, string>, MatchResult][] = [];

        // Generate all permutations of sp2
        for(const perm of this.permutations(sp2)) {

            // Create species mapping
            const spMapping = new Map<string, string>();
            for(let i = 0; i < sp1Length; i++) {
                spMapping.set(sp1[i], perm[i]);
            }

            // Do quick check that compositions are compatible
            const mappedComp = new Map<string, number>(
                [...s1Comp].map(([k, v]) => [spMapping.get(k)!, v])
            );
            if(this.getHash(mappedComp) !== this.getHash(s2Comp)) continue;

            const mappedStruct = structuredClone(struct1);
            this.replaceSpecies(mappedStruct, spMapping);

            const match: MatchResult | null = swapped ? this.strictMatch(
                    struct2,
                    mappedStruct,
                    fu,
                    !s1Supercell,
                    useRms,
                    breakOnMatch
                ) : this.strictMatch(
                    mappedStruct,
                    struct2,
                    fu,
                    s1Supercell,
                    useRms,
                    breakOnMatch
                );

            if(match) {
                matches.push([spMapping, match]);

                if(singleMatch) break;
            }
        }
        return matches;
    }

    /**
     * Helper method to generate permutations
     *
     * @param list - List of elements to be permutate
     * @returns The various permutations
     */
    private* permutations<T>(list: T[]): Generator<T[]> {

        const len = list.length;
        if(len <= 1) {
            yield list;
            return;
        }

        for(let i = 0; i < len; i++) {
            const rest = [...list.slice(0, i), ...list.slice(i + 1)];
            for(const perm of this.permutations(rest)) {
                yield [list[i], ...perm];
            }
        }
    }

    /**
     * Get mask for matching struct2 to struct1. If struct1 has sites
     * a b c, and fu = 2, assumes supercells of struct2 will be ordered
     * aabbcc (rather than abcabc).
     *
     * @param struct1 - First structure
     * @param struct2 - Second structure
     * @param fu - Size supercell
     * @param s1Supercell - Is supercell
     * @returns mask, struct1 translation indices, struct2 translation index
     */
    private getMask(
        struct1: SNL,
        struct2: SNL,
        fu: number,
        s1Supercell: boolean,
    ): [number[][], number[], number] {

        const s1SpeciesAndOccu = getComposition(struct1);
        const s2SpeciesAndOccu = getComposition(struct2);

        // Initialize 3D mask array
        const mask: boolean[][][] = Array(struct2.sites.length)
            .fill(null)
            .map(() =>
            Array(struct1.sites.length)
                .fill(null)
                .map(() => Array<boolean>(fu).fill(false))
            );

        // Group struct2 species
        const inner: [[string, number], [number, number]][] = [];
        let start = 0;
        for(const [k1, v1] of s2SpeciesAndOccu) {
            inner.push([[k1, v1], [start, start + v1]]);
            start += v1;
        }

        // Group struct1 species and fill mask
        start = 0;
        for(const [k2, v2] of s1SpeciesAndOccu) {
            const group2: [[string, number], [number, number]] = [[k2, v2], [start, start + v2]];
            start += v2;

            for(const [sp2, group1] of inner) {

                const value = sp2[0] !== k2;

                for(let j = group1[0]; j < group1[1]; ++j) {
                    for(let k = group2[1][0]; k < group2[1][1]; ++k) {
                        for(let l = 0; l < fu; ++l) {
                            mask[j][k][l] = value;
                        }
                    }
                }
            }
        }

        // Reshape mask based on s1_supercell
        let flatMask: boolean[][];

        if(s1Supercell) {
            flatMask = mask.map((row) => row.flat());
        }
        else {
            // Roll axis and reshape
            const rolled: boolean[][] = Array(mask.length * fu)
                    .fill(null)
                    .map(() => Array<boolean>(s1SpeciesAndOccu.size).fill(false));

            const ml = mask.length;
            for(let i = 0; i < ml; i++) {
                const mil = mask[i].length;
                for(let j = 0; j < mil; j++) {
                    for(let k = 0; k < fu; k++) {
                        rolled[i * fu + k][j] = mask[i][j][k];
                    }
                }
            }
            flatMask = rolled;
        }

        // Convert boolean to int (0 or 1)
        const intMask = flatMask.map((row) => row.map((value) => (value ? 1 : 0))) as number[][];

        // Find best translation indices
        const sums = intMask.map((row) => row.reduce((a, b) => a + b, 0));
        const idx = sums.indexOf(Math.max(...sums));

        const inds: number[] = [];
        const n = intMask[idx].length;
        for(let i = 0; i < n; i++) {
            if(intMask[idx][i] === 0) {
                inds.push(i);
            }
        }

        if(s1Supercell) {
            // Remove symmetrically equivalent s1 indices
            const filteredInds: number[] = [];
            const len = inds.length;
            for(let i = 0; i < len; i += fu) {
                filteredInds.push(inds[i]);
            }
            return [intMask, filteredInds, idx];
        }
        return [intMask, inds, idx];
    }

    /**
     * Yields lattices for s with lengths and angles close to the lattice of target_s. If
     * supercellSize is specified, the returned lattice will have that number of primitive
     * cells in it.
     *
     * @param targetLattice - Target lattice
     * @param s - Input structure
     * @param supercellSize - Number of primitive cells in returned lattice
     */
    private* getLattices(
        targetLattice: Lattice,
        s: SNL,
        supercellSize = 1
    ): Generator<[Lattice, number[][]], void, unknown> {

        const lattices = findAllMappings(s.lattice.matrix,
            targetLattice.matrix,
            this.ltol,
            this.angleTol,
            true  // skipRotationMatrix
        );

        // eslint-disable-next-line sonarjs/no-unused-vars
        for(const [latt, _, scaleM] of lattices) {
            const det = determinant(scaleM);
            if(this.isClose(Math.abs(det), supercellSize, 0.5, 0)) {
                yield [matrixToLattice(latt), scaleM];
            }
        }
    }

    /**
     * Check if two numbers are close each other
     *
     * @param a - First number
     * @param b - Second number
     * @param absTolerance - Required absolute tolerance
     * @param relativeTolerance - Relative tolerance
     * @returns If they are close
     */
    private isClose(
        a: number,
        b: number,
        absTolerance = 1e-9,
        relativeTolerance = 1e-9
    ): boolean {
        // Equivalent to Python's math.isclose
        return Math.abs(a - b) <= Math.max(absTolerance, relativeTolerance * Math.max(Math.abs(a), Math.abs(b)));
    }

    /**
     * Find the average lattice between the two provided
     *
     * @param l1 - First lattice
     * @param l2 - Second lattice
     * @returns Average lattice
     */
    private avLat(l1: Lattice, l2: Lattice): Lattice {
        const a = (l1.a + l2.a)/2;
        const b = (l1.b + l2.b)/2;
        const c = (l1.c + l2.c)/2;
        const alpha = (l1.alpha + l2.alpha)/2;
        const beta = (l1.beta + l2.beta)/2;
        const gamma = (l1.gamma + l2.gamma)/2;
        return paramsToLattice(a, b, c, alpha, beta, gamma);
    }

    /**
     * Supercell generator
     *
     * @param s1 - Test structure
     * @param s2 - Structure under test
     * @param fu - Repetitions in the supercell
     * @returns The supercell
     */
    private* scGenerator(
        s1: SNL,
        s2: SNL,
        fu: number
    ): Generator<SupercellResult> {

        const s2Fc = s2.sites.map((site) => site.abc);

        if(fu === 1) {
            const cc = s1.sites.map((site) => site.xyz);

            for(const [latt, scM] of this.getLattices(s2.lattice, s1, fu)) {

                let fc = getFractionalCoords(cc, latt.matrix);

                // fc -= np.floor(fc)
                fc = fc.map((coord) =>
                    coord.map((value) => value - Math.floor(value))
                );

                yield {
                    s1Coords: fc,
                    s2Coords: s2Fc,
                    avgLattice: this.avLat(latt, s2.lattice),
                    supercellMatrix: scM
                };
            }
        }
        else {
            const fcInit = s1.sites.map((site) => site.abc);

            for(const [latt, scM] of this.getLattices(s2.lattice, s1, fu)) {
                // fc = np.dot(fc_init, np.linalg.inv(sc_m))
                const scMinv = inv(scM);
                let fc = multiply(fcInit, scMinv);

                const lp = latticePointsInSupercell(scM);

                // fc = (fc[:, None, :] + lp[None, :, :]).reshape((-1, 3))
                const expandedFc: number[][] = [];
                for(const ff of fc) {
                    for(const ll of lp) {
                        expandedFc.push([
                            ff[0] + ll[0],
                            ff[1] + ll[1],
                            ff[2] + ll[2]
                        ]);
                    }
                }
                fc = expandedFc;

                // fc -= np.floor(fc)
                fc = fc.map((coord) =>
                    coord.map((value) => value - Math.floor(value))
                );

                yield {
                    s1Coords: fc,
                    s2Coords: s2Fc,
                    avgLattice: this.avLat(latt, s2.lattice),
                    supercellMatrix: scM
                };
            }
        }
    }

    /**
     * Compute all supercells of one structure close to the lattice of the other
     *
     * @param struct1 - Test structure
     * @param struct2 - Structure under test
     * @param fu - Repetitions in the supercell
     * @param s1Supercell - If true, it makes the supercells of struct1,
     * otherwise it makes them of struct2.
     * @returns Yields s1_coords, s2_coords, average_lattice, supercell_matrix
     */
    private* getSupercells(
        struct1: SNL,
        struct2: SNL,
        fu: number,
        s1Supercell: boolean
    ): Generator<SupercellResult> {

        if(s1Supercell) {
            yield* this.scGenerator(struct1, struct2, fu);
        }
        else {
            for(const result of this.scGenerator(struct2, struct1, fu)) {
                // Reorder generator output so s1 is still first
                yield {
                    s1Coords: result.s2Coords,
                    s2Coords: result.s1Coords,
                    avgLattice: result.avgLattice,
                    supercellMatrix: result.supercellMatrix
                };
            }
        }
    }

    /**
     *  Find a matching in Cartesian space. Finds an additional
     *  fractional translation vector to minimize RMS distance.
     *
     * @param s1 - Array of fractional coordinates.
     * @param s2 - Array of fractional coordinates. len(s1) \>= len(s2)
     * @param avgLattice - Lattice on which to calculate distances
     * @param mask - 2D array of booleans. mask[i][j] = true indicates
     *               that s2[i] cannot be matched to s1[j]
     * @param normalization - Inverse normalization length
     * @param lllFracTol - tolerance for Lenstra-Lenstra-Lovász lattice basis reduction algorithm
     * @returns Tuple containing:
     *          - Distances from s2 to s1, normalized by (V/atom) ^ 1/3
     *          - Fractional translation vector to apply to s2
     *          - Mapping from s1 to s2, i.e. s1[mapping[i]] =\> s2[i]
     */
    private cartDists(
        s1: number[][],
        s2: number[][],
        avgLattice: Lattice,
        mask: number[][],
        normalization: number,
        lllFracTol?: number[]
    ): {dist: number[]; tAdj: number[]; mapping: number[]} {

        if(s2.length > s1.length) {
            throw new Error(`s1.length=${s1.length} must be larger than s2.length=${s2.length}`);
        }
        if(mask.length !== s1.length || mask[0].length !== s2.length) {
            throw new Error("mask has incorrect shape");
        }

        // vectors are from s2 to s1
        const {vecs, d2} = pbcShortestVectors(
            avgLattice,
            s2,
            s1,
            mask,
            lllFracTol
        );

        const lin = new LinearAssignment(d2);
        const sol = lin.solution;

        const shortVecs = sol.map((idx, i) => vecs[i][idx]);

        // eslint-disable-next-line unicorn/no-array-reduce
        const translation = shortVecs.reduce(
            (accumulate, vec) => accumulate.map((v, i) => v + vec[i]),
            Array<number>(shortVecs[0].length).fill(0)
        ).map((v) => v / shortVecs.length);

        const fTranslation = getFractionalCoords([translation], avgLattice.matrix);

        const d2New = shortVecs.map((vec) =>
            vec.reduce((sum, value, i) => sum + (value - translation[i]) ** 2, 0)
        );

        return {
            dist: d2New.map((d) => Math.sqrt(d) * normalization),
            tAdj: fTranslation[0],
            mapping: sol
        };
    }

    /**
     * Get true if a matching exists between s2 and s2
        under frac_tol. s2 should be a subset of s1.
     *
     * @param s1 - First structure
     * @param s2 - Second structure
     * @param fracTol - Tolerance
     * @param mask - Mask of matches that are not allowed.
            i.e. if mask[1,2] is True, then subset[1] cannot be matched
            to superset[2]
     * @returns True if a matching exists between s2 and s2
     */
    private cmpFstruct(s1: number[][], s2: number[][], fracTol: number[], mask: number[][]): boolean {

        if(s2.length > s1.length) {
            throw Error(`${s1.length} must be larger than ${s2.length}`);
        }
        if(mask[0].length !== s1.length || mask.length !== s2.length) {
            throw Error(`mask has incorrect shape (mask: ${mask.length}x${mask[0].length}, s1: ${s1.length}x3, s2: ${s2.length}x3)`);
        }
        return isCoordSubsetPbc(s2, s1, fracTol, mask);
    }

    /**
     * Matches struct2 onto struct1 (which should contain all sites in struct2).
     *
     * @param struct1 - structure to match onto
     * @param struct2 - structure to match
     * @param fu - size of supercell to create
     * @param s1Supercell - whether to create the supercell of struct1 (vs struct2)
     * @param useRms - whether to minimize the rms of the matching
     * @param breakOnMatch - whether to stop search at first match
     * @returns MatchResult object if a match is found, else null
     */
    private strictMatch(
        struct1: SNL,
        struct2: SNL,
        fu: number,
        s1Supercell = true,
        useRms = false,
        breakOnMatch = false
    ): MatchResult | null {

        if(fu < 1) {
            throw new Error("fu cannot be less than 1");
        }

        const [mask, s1TInds, s2TInd] = this.getMask(struct1, struct2, fu, s1Supercell);

        if(mask.length > mask[0].length) {
            throw new Error("after supercell creation, struct1 must have more sites than struct2");
        }

        // check that a valid mapping exists
        if(mask[0].length !== mask.length) {
            return null;
        }

        if(new LinearAssignment(mask).minCost > 0) {
            return null;
        }

        let bestMatch: [number, number[], number[][], number[], number[]] | null = null;

        // loop over all lattices
        for(const {s1Coords: s1fc, s2Coords: s2fc, avgLattice: avgL, supercellMatrix: scM} of this.getSupercells(struct1, struct2, fu, s1Supercell)) {
            // compute fractional tolerance
            const normalization = Math.pow(s1fc.length / avgL.volume, 1 / 3);
            const invAbc = reciprocalLatticeLengths(avgL.matrix);
            const fracTol = invAbc.map((value: number) => value * this.stol / (Math.PI * normalization));

            // loop over all translations
            for(const s1i of s1TInds) {
                const t = subtractVectors(s1fc[s1i], s2fc[s2TInd]);
                const tS2fc = s2fc.map((coord: number[]) => addVectors(coord, t));

                if(this.cmpFstruct(s1fc, tS2fc, fracTol, mask)) {
                    const reducedLatticeMatrix = getLLLmatrices(avgL).matrix;
                    const invLllAbc = reciprocalLatticeLengths(reducedLatticeMatrix);
                    const lllFracTol = invLllAbc.map((value: number) => value * this.stol / (Math.PI * normalization));
                    const {dist, tAdj, mapping} = this.cartDists(s1fc, tS2fc, avgL, mask, normalization, lllFracTol);

                    const value = useRms
                        ? norm(dist) / Math.sqrt(dist.length)
                        : Math.max(...dist);

                    if(bestMatch === null || value < bestMatch[0]) {
                        const totalT = addVectors(t, tAdj);
                        const adjustedT = totalT.map((v) => pbc(v));
                        bestMatch = [value, dist, scM, adjustedT, mapping];

                        if((breakOnMatch || value < 1e-5) && value < this.stol) {
                            return this.formatMatchResult(bestMatch);
                        }
                    }
                }
            }
        }

        if(bestMatch && bestMatch[0] < this.stol) {
            return this.formatMatchResult(bestMatch);
        }

        return null;
    }

    /**
     * Helper method to format the result
     *
     * @param match - Match values
     * @returns - Formatted match values
     */
    private formatMatchResult(match: [number, number[], number[][], number[], number[]]): MatchResult {
        return {
            rms: match[0],
            maxDist: match[0],
            mask: match[2],
            cost: match[0],
            mapping: match[4]
        };
    }
}
