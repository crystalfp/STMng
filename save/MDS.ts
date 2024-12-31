
/**
 * Implementa il Classical Multidimensional Scaling (MDS)
 * @param distanceMatrix - Matrice simmetrica delle distanze NxN
 * @param dimensions - Numero di dimensioni dell'output (default: 2)
 * @returns Array di punti nelle dimensioni specificate
 */
 function MDS(distanceMatrix: number[][], dimensions = 2): number[][] {

    const n = distanceMatrix.length;

    // 1. Square the distance matrix
    const squaredDistances = distanceMatrix.map((row) =>
        row.map((distance) => distance * distance)
    );

    // 2. Compute centering matrix
    const H = Array(n) as number[][];
    for (let i = 0; i < n; i++) {
        H[i] = Array(n) as number[];
        for (let j = 0; j < n; j++) {
            H[i][j] = (i === j ? 1 : 0) - 1/n;
        }
    }

    // 3. Compute double centering matrix B
    const B = Array(n) as number[][];
    for (let i = 0; i < n; i++) {
        B[i] = Array(n) as number[];
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                for (let l = 0; l < n; l++) {
                    sum += H[i][k] * squaredDistances[k][l] * H[l][j];
                }
            }
            B[i][j] = -0.5 * sum;
        }
    }

    // 4. Calcola gli autovalori e autovettori
    const {eigenvalues, eigenvectors} = eigenDecomposition(B);
    console.log("EIGEN", eigenvalues, eigenvectors);

    // 5. Ordina gli autovalori in ordine decrescente e mantieni solo i primi k
    const indices = eigenvalues.map((value, idx) => ({val: value, idx}))
        .sort((a, b) => b.val - a.val)
        .slice(0, dimensions)
        .map((item) => item.idx);

    // 6. Calcola le coordinate finali
    const coordinates = Array(n).map(() => Array(dimensions).fill(0) as number[]);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < dimensions; j++) {
            const eigenIdx = indices[j];
            coordinates[i][j] = eigenvectors[i][eigenIdx] * Math.sqrt(Math.abs(eigenvalues[eigenIdx]));
        }
    }

    // 7. Normalize coordinates
    let maxX = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for(const point of coordinates) {

        if(point[0] > maxX) maxX = point[0];
        if(point[0] < minX) minX = point[0];
        if(point[1] > maxY) maxY = point[1];
        if(point[1] < minY) minY = point[1];
    }
    for(const point of coordinates) {
        point[0] = (point[0] - minX)/(maxX - minX);
        point[1] = (point[1] - minY)/(maxY - minY);
    }

    return coordinates;
}

const identity = (n: number): number[][] => {

    const matrix = Array(n) as number[][];

    for(let row=0; row < n; ++row) {
        const oneRow = Array(n).fill(0) as number[];
        oneRow[row] = 1;
        matrix[row] = oneRow;
    }

    return matrix;
};

const clone = (m: number[][]): number[][] => {

    const n = m.length;

    const out = Array(n) as number[][];
    for(let row=0; row < n; ++row) {
        out[row] = [...m[row]];
    }

    return out;
};

/**
 * Implementa la decomposizione in autovalori per matrici simmetriche
 * usando il metodo QR con trasformazioni di Householder
 */
function eigenDecomposition(matrix: number[][]): {eigenvalues: number[]; eigenvectors: number[][]} {

    const n = matrix.length;
    let H = clone(matrix);
    let V = identity(n);

    // Implementazione della trasformazione di Householder
    for (let k = 0; k < 100; k++) { // max 100 iterazioni
        const {Q, R} = qrDecomposition(H);
        H = multiplyMatrices(R, Q);
        V = multiplyMatrices(V, Q);
    }

    return {
        eigenvalues: H.map((row, i) => row[i]),
        eigenvectors: V
    };
}

/**
 * Implementa la decomposizione QR usando trasformazioni di Householder
 */
function qrDecomposition(matrix: number[][]): {Q: number[][]; R: number[][]} {

    const n = matrix.length;
    const Q = identity(n);
    const R = clone(matrix);

    for (let j = 0; j < n-1; j++) {
        // eslint-disable-next-line prefer-const
        let x = R.map((row, i) => (i >= j ? row[j] : 0));
        const norm = Math.sqrt(x.reduce((sum, value) => sum + value * value, 0));
        const sign = x[j] >= 0 ? 1 : -1;

        x[j] += sign * norm;
        const v = x.map((v1) => v1 / Math.sqrt(x.reduce((sum, v2) => sum + v2 * v2, 0)));

        // Applica la trasformazione di Householder
        for (let i = 0; i < n; i++) {
            for (let k = 0; k < n; k++) {
                const dot = v.reduce((sum, vj, idx) => sum + vj * R[idx][k], 0);
                R[i][k] -= 2 * v[i] * dot;
            }
        }

        for (let i = 0; i < n; i++) {
            for (let k = 0; k < n; k++) {
                const dot = v.reduce((sum, vj, idx) => sum + vj * Q[k][idx], 0);
                Q[k][i] -= 2 * dot * v[i];
            }
        }
    }

    return {Q, R};
}

/**
 * Moltiplica due matrici
 */
function multiplyMatrices(a: number[][], b: number[][]): number[][] {
    const m = a.length;
    const n = b[0].length;
    const p = b.length;
    const result = Array(m).fill(0).map(() => Array(n).fill(0) as number[]);

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < p; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }

    return result;
}
