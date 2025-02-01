/**
 * Worker main entry point.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-31
 */

export const worker = (positionsShared: SharedArrayBuffer,
					   atomsZShared: SharedArrayBuffer,
					   fingerprintShared: SharedArrayBuffer): void => {

	const positions = new Float64Array(positionsShared);
	const atomsZ = new Int32Array(atomsZShared);
	const fingerprint = new Float64Array(fingerprintShared);

    for(let i = 0; i < positions.length; i++) {
    	// eslint-disable-next-line sonarjs/pseudo-random
    	fingerprint[i] = positions[i] * atomsZ[i] * Math.random();
    }
};
