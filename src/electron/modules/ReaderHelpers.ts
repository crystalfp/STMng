
import type {BasisType, PositionType} from "../../types";

export const extractBasis = (a: number, b: number, c: number,
							 // eslint-disable-next-line max-params
							 alpha: number, beta: number, gamma: number): BasisType => {

	if(a <= 0 || b <= 0 || c <= 0) {
		return [1, 0, 0, 0, 1, 0, 0, 0, 1];
	}

	if(gamma <= 0) gamma = -gamma;

	if(alpha === 90 && beta === 90 && gamma === 90) {
		return [a, 0, 0, 0, b, 0, 0, 0, c];
	}

	const conv = Math.PI/180.0;
	const alphaRad = alpha*conv;
	const betaRad  = beta*conv;
	const gammaRad = gamma*conv;
	const cosAlpha = Math.cos(alphaRad);
	const cosBeta  = Math.cos(betaRad);
	const cosGamma = Math.cos(gammaRad);
	const sinGamma = Math.sin(gammaRad);

	// Compute the basis vectors
	const basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	basis[0] = a;
	// basis[1] = 0;
	// basis[2] = 0;

	basis[3] = b * cosGamma;
	basis[4] = b * sinGamma;
	// basis[5] = 0;

	basis[6] = c * cosBeta;
	basis[7] = c * (cosAlpha - cosBeta*cosGamma) / sinGamma;
	basis[8] = c * Math.sqrt(1. - cosAlpha*cosAlpha - cosBeta*cosBeta -
							 cosGamma*cosGamma + 2.*(cosAlpha*cosBeta*cosGamma))/sinGamma;

	return basis;
};

export const fractionalToCartesianCoordinates = (basis: BasisType,
												 fx: number, fy: number, fz: number,
												 // eslint-disable-next-line @typescript-eslint/no-shadow
												 origin?: PositionType): PositionType => {

	if(!origin) origin = [0, 0, 0];

	const x = fx*basis[0] + fy*basis[3] + fz*basis[6] + origin[0];
	const y = fx*basis[1] + fy*basis[4] + fz*basis[7] + origin[1];
	const z = fx*basis[2] + fy*basis[5] + fz*basis[8] + origin[2];

	return [x, y, z];
};
