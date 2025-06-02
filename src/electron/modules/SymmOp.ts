/**
 * Symmetry operations in Cartesian space represented as 4x4 affine matrix.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-05-26
 */
import {inv, multiply} from "mathjs";
import {normalize, type Matrix} from "./LinearAlgebra";

/**
 * SymmOp represents a symmetry operation in Cartesian space using a 4x4 affine matrix.
 * It consists of a rotation plus a translation. Implementation is as an affine
 * transformation matrix of rank 4 for efficiency.
 * Read: https://wikipedia.org/wiki/Affine_transformation.
 */
export class SymmOp {

    public readonly matrix: Matrix;

    /**
	 * Initialize the SymmOp from a 4x4 affine transformation matrix.
     * In general, this constructor should not be used unless you are
     * transferring rotations. Use the static constructors instead to
     * generate a SymmOp from proper rotations and translation.
	 *
     * @param matrix - The 4x4 matrix representing the symmetry operation.
     *                 The first 3x3 part is the rotation/reflection,
     *                 and the first 3 elements of the last column are the translation.
     *                 The last row is typically [0, 0, 0, 1].
     */
    constructor(matrix: Matrix) {
        if(matrix.length !== 4 || matrix.some((row) => row.length !== 4)) {
            throw new Error("SymmOp matrix must be 4x4.");
        }
        this.matrix = matrix;
    }

	/**
	 * Print SymmOp
	 *
	 * @returns Human readable content of the affine matrix
	 */
	toString(): string {

		let result = "Rot:\n";
		for(let i = 0; i < 3; i++) {
			result += `${this.matrix[i][0].toPrecision(6).padStart(10)} ${this.matrix[i][1].toPrecision(6).padStart(10)} ${this.matrix[i][2].toPrecision(6).padStart(10)}\n`;
		}
		result += "tau\n";
		result += `${this.matrix[0][3].toPrecision(6).padStart(10)} ${this.matrix[1][3].toPrecision(6).padStart(10)} ${this.matrix[2][3].toPrecision(6).padStart(10)}\n`;
		return result;
	}

    /**
     * Apply the operation on a point.
     *
     * @param point - Cartesian coordinate [x, y, z].
     * @returns Coordinates of point after operation [x', y', z'].
     */
    operate(point: number[]): number[] {

        // Convert the 3D point to a 4D homogeneous vector [x, y, z, 1]
        const affinePoint: [number, number, number, number] = [point[0], point[1], point[2], 1];

        // Perform matrix-vector multiplication: result = matrix * affinePoint
        const result: [number, number, number, number] = [0, 0, 0, 0];
        for(let i = 0; i < 4; i++) {
            for(let j = 0; j < 4; j++) {
                result[i] += this.matrix[i][j] * affinePoint[j];
            }
        }

        // Return the first three components (the transformed 3D point)
        return [result[0], result[1], result[2]];
    }

	/**
	 * Creates an inversion symmetry operation.
	 *
	 * @param origin - Origin of the inversion operation. Defaults to [0, 0, 0].
	 * @returns SymmOp representing an inversion operation about the origin.
	 */
	static inversion(origin = [0, 0, 0]): SymmOp {

		const mat: Matrix = [
			[-1, 0,  0,  0],
			[0, -1,  0,  0],
			[0,  0, -1,  0],
			[0,  0,  0,  1]
		];

		// Set the translation part: mat[:3, 3] = 2 * origin
		mat[0][3] = 2 * origin[0];
		mat[1][3] = 2 * origin[1];
		mat[2][3] = 2 * origin[2];

		return new SymmOp(mat);
	}

	/**
	 * Generate a SymmOp for a rotation about a given axis plus translation.
	 *
	 * @param axis - The axis of rotation in Cartesian space. For example,
     *            	 [1, 0, 0] indicates rotation about x-axis.
	 * @param angle - Angle of rotation (in degrees)
	 * @returns SymmOp for a rotation about given axis and translation.
	 */
	static fromAxisAngleAndTranslation(axis: number[], angle: number): SymmOp {

		angle *= Math.PI / 180;
        const co = Math.cos(angle);
        const si = Math.sin(angle);

		const len = Math.hypot(...axis);
		const unitVector = [axis[0] / len, axis[1] / len, axis[2] / len];

		const rotationMatrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

        rotationMatrix[0][0] = co + unitVector[0] ** 2 * (1 - co);
        rotationMatrix[0][1] = unitVector[0] * unitVector[1] * (1 - co) - unitVector[2] * si;
        rotationMatrix[0][2] = unitVector[0] * unitVector[2] * (1 - co) + unitVector[1] * si;
        rotationMatrix[1][0] = unitVector[0] * unitVector[1] * (1 - co) + unitVector[2] * si;
        rotationMatrix[1][1] = co + unitVector[1] ** 2 * (1 - co);
        rotationMatrix[1][2] = unitVector[1] * unitVector[2] * (1 - co) - unitVector[0] * si;
        rotationMatrix[2][0] = unitVector[0] * unitVector[2] * (1 - co) - unitVector[1] * si;
        rotationMatrix[2][1] = unitVector[1] * unitVector[2] * (1 - co) + unitVector[0] * si;
        rotationMatrix[2][2] = co + unitVector[2] ** 2 * (1 - co);

		return SymmOp.fromRotationAndTranslation(rotationMatrix, [0, 0, 0]);
	}

	/**
	 * Create a symmetry operation from a rotation matrix and a translation vector
	 *
	 * @param rotation - (3x3 array): Rotation matrix
	 * @param translation - (3x1 array): Translation vector
	 * @returns SymmOp object
	 */
	static fromRotationAndTranslation(rotation = [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
									  translation = [0, 0, 0]): SymmOp {

		const affineMatrix: Matrix = [
			[rotation[0][0], rotation[0][1], rotation[0][2], translation[0]],
			[rotation[1][0], rotation[1][1], rotation[1][2], translation[1]],
			[rotation[2][0], rotation[2][1], rotation[2][2], translation[2]],
			[0, 0, 0, 1]
		];
		return new SymmOp(affineMatrix);
	}

	/**
	 * Get reflection symmetry operation.
	 *
	 * @param normal - Vector of the normal to the plane of reflection
	 * @param origin - A point in which the mirror plane passes through
	 * @returns SymmOp for the reflection about the plane
	 */
	static reflection(normal: number[], origin = [0, 0, 0]): SymmOp {

		normal = normalize(normal);
		const [u, v, w] = normal;

		const xx = 1 - 2 * u**2;
        const yy = 1 - 2 * v**2;
        const zz = 1 - 2 * w**2;
        const xy = -2 * u * v;
        const xz = -2 * u * w;
        const yz = -2 * v * w;
        let mirrorMatrix = [[xx, xy, xz, 0], [xy, yy, yz, 0], [xz, yz, zz, 0], [0, 0, 0, 1]];

		if(Math.hypot(...origin) > 1e-6) {
			const translation = [
				[1, 0, 0, -origin[0]],
				[0, 1, 0, -origin[1]],
				[0, 0, 1, -origin[2]],
				[0, 0, 0, 1]
			];
			const m1 = multiply(mirrorMatrix, translation);
			const translationInverse = inv(translation);
			mirrorMatrix = multiply(translationInverse, m1);
		}
		return new SymmOp(mirrorMatrix);
	}

    /**
     * Get a roto-reflection symmetry operation.
     *
     * @param axis - Axis of rotation / mirror normal
     * @param angle - Angle in degrees
     * @returns Roto-reflection operation
     */
  	static rotoreflection(axis: number[], angle: number): SymmOp {

		const rotation = this.fromAxisAngleAndTranslation(axis, angle);
    	const reflection = this.reflection(axis);

    	// Combined operation
		const matrix = multiply(rotation.matrix, reflection.matrix);
        return new SymmOp(matrix);
    }
}
