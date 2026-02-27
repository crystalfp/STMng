/**
* This class finds the solution to the Linear Assignment Problem.
* It finds a minimum cost matching between two sets, given a cost matrix.
*
* This class is an implementation of the LAPJV algorithm described in:
* R. Jonker, A. Volgenant. A Shortest Augmenting Path Algorithm for
* Dense and Sparse Linear Assignment Problems. Computing 38, 325-340
* (1987)
*
* @packageDocumentation
*
* @author Mario Valle "mvalle at ikmail.com"
* @author Will Richards (original Python implementation)
* @since 2025-10-17
 *
 * This code is ported from the Python Pymatgen library:
 *
 * Shyue Ping Ong, William Davidson Richards, Anubhav Jain, Geoffroy Hautier,
 * Michael Kocher, Shreyas Cholia, Dan Gunter, Vincent Chevrier, Kristin A.
 * Persson, Gerbrand Ceder. Python Materials Genomics (pymatgen): A Robust,
 * Open-Source Python Library for Materials Analysis. Computational Materials
 * Science, 2013, 68, 314–319. https://doi.org/10.1016/j.commatsci.2012.10.028
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
/* eslint-disable unicorn/no-null */

/**
 * This class finds the solution to the Linear Assignment Problem.
 * It finds a minimum cost matching between two sets, given a cost matrix.
 */
export class LinearAssignment {

    private readonly origC: number[][];
    private readonly nx: number;
    private readonly ny: number;
    private readonly n: number;
    private readonly c: number[][];
    private readonly epsilon: number;
    private _x: number[];
    private _y: number[];
    private _v: number[];
    private _d: number[];
    //   private _inds: number[];
    private readonly cred: number[][];
    private _minCost: number | null = null;

    /**
    * The matching of the rows to columns.
    * i.e solution = [1, 2, 0] would match row 0 to column 1,
    * row 1 to column 2 and row 2 to column 0.
    * Total cost would be c[0, 1] + c[1, 2] + c[2, 0]
    */
    public solution: number[];

    /**
    * Creates a new LinearAssignment solver
    *
    * @param costs - The cost matrix of the problem. cost[i][j] should be the
    *                cost of matching x[i] to y[j]. The cost matrix may be rectangular
    * @param epsilon - Tolerance for determining if solution vector is less than 0
    */
    constructor(costs: number[][], epsilon = 1e-6) {

        this.origC = costs.map((row) => [...row]);
        this.nx = costs.length;
        this.ny = costs[0].length;
        this.n = this.ny;
        // this._inds = Array.from({length: this.n}, (_, i) => i);
        this.epsilon = Math.abs(epsilon);

        // Check that cost matrix is square or has more columns than rows
        if(this.nx > this.ny) {
            throw new Error("cost matrix must have at least as many columns as rows");
        }

        if(this.nx === this.ny) {
            this.c = this.origC.map((row) => [...row]);
        }
        else {
            // Fill value calculation
            const rowMins = this.origC.map((row) => Math.min(...row));
            const fillValue = Math.max(...rowMins);

            this.c = Array(this.n).fill(0).map(() => Array<number>(this.n).fill(fillValue));
            for(let i = 0; i < this.nx; i++) {
                this.c[i] = [...this.origC[i]];
            }
        }

        // Initialize solution vectors
        this._x = Array<number>(this.n).fill(-1);
        this._y = Array<number>(this.n).fill(-1);
        this._v = Array<number>(this.n).fill(0);
        this._d = Array<number>(this.n).fill(0);
        this.cred = Array(this.n).fill(0).map(() => Array<number>(this.n).fill(0));

        // If column reduction doesn't find a solution, augment with shortest paths
        if(this.columnReduction()) {
            this.augmentingRowReduction();
            this.updateCred();
            while(this._x.includes(-1)) {
                this.augment();
            }
        }

        this.solution = this._x.slice(0, this.nx);
    }

    /**
    * Returns the minimum cost of the matching
    */
    get minCost(): number {
        if(this._minCost !== null) {
            return this._minCost;
        }

        this._minCost = 0;
        for(let i = 0; i < this.nx; i++) {
            this._minCost += this.c[i][this.solution[i]];
        }
        return this._minCost;
    }

    /**
    * Column reduction and reduction transfer steps from LAPJV algorithm
    * @returns true if augmentation is needed, false if problem is already solved
    */
    private columnReduction(): boolean {

        // Find minimum in each column
        const colMins = Array<number>(this.n).fill(Infinity);
        const colMinRows = Array<number>(this.n).fill(-1);

        for(let j = 0; j < this.n; j++) {
            for(let i = 0; i < this.n; i++) {
                if(this.c[i][j] < colMins[j]) {
                    colMins[j] = this.c[i][j];
                    colMinRows[j] = i;
                }
            }
        }

        // Assign each column to its lowest cost row (only once per row/column)
        const assignedRows = new Set<number>();
        const i1: number[] = [];
        const j: number[] = [];

        for(let col = 0; col < this.n; col++) {
            const row = colMinRows[col];
            if(!assignedRows.has(row)) {
                assignedRows.add(row);
                i1.push(row);
                j.push(col);
                this._x[row] = col;
            }
        }

        // If problem is solved, return
        if(i1.length === this.n) {
            return false;
        }

        for(let idx = 0; idx < j.length; idx++) {
            this._y[j[idx]] = i1[idx];
        }

        // Reduction transfer
        this._v = colMins;

        // Create tempc with previously assigned matchings masked
        const tempc = this.c.map((row) => [...row]);
        for(let idx = 0; idx < i1.length; idx++) {
            tempc[i1[idx]][j[idx]] = Infinity;
        }

        const mu: number[] = [];
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for(let idx = 0; idx < i1.length; idx++) {
            const row = i1[idx];
            let minDiff = Infinity;
            for(let col = 0; col < this.n; col++) {
                const diff = tempc[row][col] - this._v[col];
                if(diff < minDiff) {
                    minDiff = diff;
                }
            }
            mu.push(minDiff);
        }

        for(let idx = 0; idx < j.length; idx++) {
            this._v[j[idx]] -= mu[idx];
        }

        return true;
    }

    /**
    * Augmenting row reduction step from LAPJV algorithm
    */
    private augmentingRowReduction(): void {
        const unassigned: number[] = [];
        for(let i = 0; i < this.n; i++) {
            if(this._x[i] === -1) {
                unassigned.push(i);
            }
        }

        for(let i of unassigned) {
            for(let iter = 0; iter < this.c.length * this.c.length; iter++) {
                // Find smallest 2 values and indices
                const temp = this.c[i].map((value, j) => value - this._v[j]);

                let j1 = 0;
                let u1 = temp[0];
                for(let j = 1; j < temp.length; j++) {
                    if(temp[j] < u1) {
                        u1 = temp[j];
                        j1 = j;
                    }
                }

                temp[j1] = Infinity;

                let j2 = 0;
                let u2 = temp[0];
                for(let j = 1; j < temp.length; j++) {
                    if(temp[j] < u2) {
                        u2 = temp[j];
                        j2 = j;
                    }
                }

                if(u1 < u2) {
                    this._v[j1] -= u2 - u1;
                }
                else if(this._y[j1] !== -1) {
                    j1 = j2;
                }

                const k = this._y[j1];
                if(k !== -1) {
                    this._x[k] = -1;
                    this._x[i] = j1;
                    this._y[j1] = i;
                    i = k;
                }

                if(k === -1 || Math.abs(u1 - u2) < this.epsilon) {
                    break;
                }
            }
        }
    }

    /**
    * Updates the reduced costs with the values from the dual solution
    */
    private updateCred(): void {
        const ui: number[] = [];
        for(let i = 0; i < this.n; i++) {
            ui.push(this.c[i][this._x[i]] - this._v[this._x[i]]);
        }

        for(let i = 0; i < this.n; i++) {
            for(let j = 0; j < this.n; j++) {
                this.cred[i][j] = this.c[i][j] - ui[i] - this._v[j];
            }
        }
    }

    /**
    * Finds a minimum cost path and adds it to the matching
    */
    private augment(): void {
        // Build a minimum cost tree
        const {pred, ready, istar, j, mu} = this.buildTree();

        // Update prices
        for(let idx = 0; idx < this.n; idx++) {
            if(ready[idx]) {
                this._v[idx] += this._d[idx] - mu;
            }
        }

        // Augment the solution with the minimum cost path
        let currentJ = j;
        while(true) {
            const i = pred[currentJ];
            this._y[currentJ] = i;
            const k = currentJ;
            currentJ = this._x[i];
            this._x[i] = k;
            if(i === istar) {
                break;
            }
        }
        this.updateCred();
    }

    /**
    * Builds the tree finding an augmenting path
    */
    private buildTree(): {pred: number[]; ready: boolean[]; istar: number; j: number; mu: number} {
        // Find unassigned i*
        let istar = 0;
        for(let i = 1; i < this.n; i++) {
            if(this._x[i] < this._x[istar]) {
                istar = i;
            }
        }

        // Compute distances
        this._d = this.c[istar].map((value, j) => value - this._v[j]);
        const pred = Array<number>(this.n).fill(istar);

        // Initialize sets
        const ready = Array<boolean>(this.n).fill(false);
        const scan = Array<boolean>(this.n).fill(false);
        const todo = Array<boolean>(this.n).fill(true);

        let mu = 0;

        while(true) {
            // Populate scan with minimum reduced distances
            if(!scan.includes(true)) {
                mu = Infinity;
                for(let j = 0; j < this.n; j++) {
                    if(todo[j] && this._d[j] < mu) {
                        mu = this._d[j];
                    }
                }

                for(let j = 0; j < this.n; j++) {
                    if(this._d[j] === mu && todo[j]) {
                        scan[j] = true;
                        todo[j] = false;
                    }
                }

                for(let j = 0; j < this.n; j++) {
                    if(this._y[j] === -1 && scan[j]) {
                        return {pred, ready, istar, j, mu};
                    }
                }
            }

            // Pick jstar from scan
            let jstar = -1;
            for(let j = 0; j < this.n; j++) {
                if(scan[j]) {
                    jstar = j;
                    break;
                }
            }

            if(jstar === -1) break;

            const i = this._y[jstar];
            scan[jstar] = false;
            ready[jstar] = true;

            // Find shorter distances
            for(let j = 0; j < this.n; j++) {
                if(todo[j]) {
                    const newdist = mu + this.cred[i][j];
                    if(newdist < this._d[j]) {
                        this._d[j] = newdist;
                        pred[j] = i;
                    }
                }
            }

            for(let j = 0; j < this.n; j++) {
                if(this._d[j] === mu && todo[j]) {
                    if(this._y[j] === -1) {
                        return {pred, ready, istar, j, mu};
                    }
                    scan[j] = true;
                    todo[j] = false;
                }
            }
        }

        // Should not reach here in normal operation
        return {pred, ready, istar, j: 0, mu};
    }
}
