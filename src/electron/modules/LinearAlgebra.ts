/**
 * Linear algebra routines
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-05-26
 */
export type Matrix = number[][];

/**
 * Cross product
 *
 * @param v1 - First vector to multiply
 * @param v2 - Second vector to multiply
 * @returns Cross product (vector product) of the two vectors
 */
export const crossProduct = (v1: number[], v2: number[]): number[] => {

	// Verify they are 3D vectors
	if(v1.length !== 3 || v2.length !== 3) {
		throw Error("Vectors should be 3D vectors");
	}

	return [
		v1[1] * v2[2] - v1[2] * v2[1],  // X component
		v1[2] * v2[0] - v1[0] * v2[2],  // Y component
		v1[0] * v2[1] - v1[1] * v2[0]   // Z component
	];
};

/**
 * Compute the dot product
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product between the two vectors
 */
export const dotProduct = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Normalize a 3D vector
 *
 * @param v - Vector to be normalized
 * @returns Normalized vector
 */
export const normalize = (v: number[]): number[] => {
	const length = Math.hypot(v[0], v[1], v[2]);
	return [v[0] / length, v[1] / length, v[2] / length];
};

/**
 * Multiply two matrices
 *
 * @param m1 - First matrix that multiplies
 * @param m2 - Second matrix
 * @returns Matrix product m1 x m2
 */
export const multiplyMatrices = (m1: Matrix, m2: Matrix): Matrix => {

	const r1 = m1.length;
	const r2 = m2.length;
	const c1 = m1[0].length;
	const c2 = m2[0].length;

	if(r1 !== c2 || r2 !== c1) throw Error("Multiplied matrices have incompatible sizes");

	const out: Matrix = Array<number[]>(r1);

	for(let i = 0; i < r1; i++) {
		out[i] = Array<number>(c2).fill(0);
		for(let j = 0; j < c2; j++) {
			for(let k = 0; k < c1; k++) {
				out[i][j] += m1[i][k] * m2[k][j];
			}
		}
	}

	return out;
};

// Funzione per invertire una matrice n×n usando il metodo di Gauss-Jordan
export const invertMatrix = (matrix: Matrix): Matrix => {

	const n = matrix.length;

    // Verifica che la matrice sia quadrata
    if(!matrix.every((row) => row.length === n)) {
        throw new Error("La matrice deve essere quadrata (n×n)");
    }

    // Crea una matrice aumentata [A|I] dove I è la matrice identità
    const augmented: Matrix = [];
    for(let i = 0; i < n; i++) {
        augmented[i] = [...matrix[i]]; // Copia la riga originale
        // Aggiungi la matrice identità
        for(let j = 0; j < n; j++) {
            augmented[i].push(i === j ? 1 : 0);
        }
    }

    // Eliminazione di Gauss-Jordan
    for(let i = 0; i < n; i++) {
        // Trova il pivot (elemento non zero più grande nella colonna)
        let maxRow = i;
        for(let k = i + 1; k < n; k++) {
            if(Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                maxRow = k;
            }
        }

        // Scambia le righe se necessario
        if(maxRow !== i) {
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
        }

        // Verifica se la matrice è singolare (non invertibile)
        if(Math.abs(augmented[i][i]) < 1e-10) {
            throw Error("Matrix is not invertible (singular matrix)"); // Matrice singolare
        }

        // Normalizza la riga del pivot
        const pivot = augmented[i][i];
        for(let j = 0; j < 2 * n; j++) {
            augmented[i][j] /= pivot;
        }

        // Elimina gli altri elementi nella colonna
        for(let k = 0; k < n; k++) {
            if(k !== i) {
                const factor = augmented[k][i];
                for(let j = 0; j < 2 * n; j++) {
                    augmented[k][j] -= factor * augmented[i][j];
                }
            }
        }
    }

    // Estrai la matrice inversa dalla parte destra della matrice aumentata
    const inverse: Matrix = [];
    for(let i = 0; i < n; i++) {
        inverse[i] = augmented[i].slice(n);
    }

    return inverse;
};
