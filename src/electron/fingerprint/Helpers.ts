/**
 * Various helper routines used by all fingerprinting methods.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-13
 */
import type {BasisType} from "@/types";

/**
 * Compute the unit cell volume, if any
 *
 * @param basis - Unit cell basis vectors
 * @param isNanocluster - Is nanocluster (i.e., has no unit cell)
 * @returns Unit cell volume
 */
export const getCellVolume = (basis: BasisType, isNanocluster: boolean): number =>
    (isNanocluster ?
            0 :
            basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
            basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
            basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7]
    );
