/**
 * Project n-dimensional point to 2 dimensions using t-SNE algorithm
 * The algorithm was originally described in this paper:
 *		L.J.P. van der Maaten and G.E. Hinton.
 * 		Visualizing High-Dimensional Data Using t-SNE. Journal of Machine Learning Research
 *		9(Nov):2579-2605, 2008.
 *		URL: https://www.jmlr.org/papers/volume9/vandermaaten08a/vandermaaten08a.pdf
 *
 * The original code is from: https://github.com/karpathy/tsnejs
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-26
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */

interface TSNEParams {
  perplexity: number;
  dim: number;
  epsilon: number;
}

export class TSNE {

	private readonly params: TSNEParams;
	private iter = 0;
	private P: number[] = [];
	private N = 0;
	private Y: number[][] = [];
	private gains: number[][] = [];
	private ystep: number[][] = [];
	private returnValue = false;
	private vValue = 0.0;

	constructor(opt: Partial<TSNEParams> = {}) {

		const defaults: TSNEParams = {
			perplexity: 30,
			dim: 2,
			epsilon: 10
		};
		this.params = {...defaults, ...opt};
	}

	// utility function
	private assert(condition: boolean, message?: string): void {
		if(!condition) throw Error(message ?? "Assertion failed");
	}

	// utility that creates contiguous vector of zeros of size n
	private zeros(n: number): number[] {

		if(n === undefined || Number.isNaN(n)) return [];

		return Array<number>(n).fill(0);
	}

	// return 0 mean unit standard deviation random number
	private gaussRandom(): number {
		if(this.returnValue) {
			this.returnValue = false;
			return this.vValue;
		}
		const u = 2*Math.random()-1;
		const v = 2*Math.random()-1;
		const r = u*u + v*v;
		if(r === 0 || r > 1) return this.gaussRandom();
		const c = Math.sqrt(-2*Math.log(r)/r);
		this.vValue = v*c; // cache this for next function call for efficiency
		this.returnValue = true;
		return u*c;
	}

	// return random normal number
	private randn(mu: number, std: number): number {
		return mu + this.gaussRandom()*std;
	}

	// utility that returns 2d array filled with random numbers
	// or with value s, if provided
	private randn2d(n: number, d: number, s?: number): number[][] {

		const uses = s !== undefined;
		const x: number[][] = [];
		for(let i=0; i<n; i++) {
			const xhere: number[] = [];
			for(let j=0; j<d; j++) {
				if(uses) {
					xhere.push(s);
				}
				else {
					xhere.push(this.randn(0.0, 1e-4));
				}
			}
			x.push(xhere);
		}
		return x;
	}

	// compute L2 distance between two vectors
	private L2(x1: number[], x2: number[]): number {
		const D = x1.length;
		let d = 0;
		for(let i=0; i<D; ++i) {
			const x1i = x1[i];
			const x2i = x2[i];
			d += (x1i-x2i)*(x1i-x2i);
		}
		return d;
	}

	// compute pairwise distance in all vectors in X
	private xtod(X: number[][]): number[] {
		const N = X.length;
		const dist = this.zeros(N * N); // allocate contiguous array
		for(let i=0; i<N-1; i++) {
			for(let j=i+1; j<N; j++) {
				const d = this.L2(X[i], X[j]);
				dist[i*N+j] = d;
				dist[j*N+i] = d;
			}
		}
		return dist;
	}

	// compute (p_{i|j} + p_{j|i})/(2n)
	private d2p(D: number[], perplexity: number, tol: number): number[] {

		const Nf = Math.sqrt(D.length); // this better be an integer
		const N = Math.floor(Nf);
		this.assert(N === Nf, "D should have square number of elements.");
		const Htarget = Math.log(perplexity); // target entropy of distribution
		const P = this.zeros(N * N); // temporary probability matrix

		const prow = this.zeros(N); // a temporary storage compartment
		for(let i=0; i<N; i++) {

			let betamin = -Infinity;
			let betamax = Infinity;
			let beta = 1; // initial value of precision
			let done = false;
			const maxtries = 50;

			// perform binary search to find a suitable precision beta
			// so that the entropy of the distribution is appropriate
			let countIterations = 0;
			while(!done) {

				// compute entropy and kernel row with beta precision
				let psum = 0.0;
				for(let j=0; j<N; j++) {
					let pj = Math.exp(-D[i*N+j]*beta);
					if(i === j) pj = 0; // we don't care about diagonals
					prow[j] = pj;
					psum += pj;
				}

				// normalize p and compute entropy
				let Hhere = 0.0;
				for(let j=0; j<N; j++) {
					const pj = psum === 0 ? 0 : prow[j] / psum;
					prow[j] = pj;
					if(pj > 1e-7) Hhere -= pj * Math.log(pj);
				}

				// adjust beta based on result
				if(Hhere > Htarget) {
					// entropy was too high (distribution too diffuse)
					// so we need to increase the precision for more peaky distribution
					betamin = beta; // move up the bounds
					beta = betamax === Infinity ? beta * 2 : (beta + betamax) / 2;
				}
				else {
					// converse case. make distribution less peaky
					betamax = beta;
					beta = betamin === -Infinity ? beta / 2 : (beta + betamin) / 2;
				}

				// stopping conditions: too many tries or got a good precision
				countIterations++;
				if(Math.abs(Hhere - Htarget) < tol || countIterations >= maxtries) done = true;
			}

			// console.log('data point ' + i + ' gets precision ' + beta + ' after ' +
			// num + ' binary search steps.');
			// copy over the final prow to P at row i
			for(let j=0; j<N; j++) P[i*N+j] = prow[j];

		} // end loop over examples i

		// symmetrize P and normalize it to sum to 1 over all ij
		const Pout = this.zeros(N * N);
		const N2 = N*2;
		for(let i=0; i<N; i++) {
			for(let j=0; j<N; j++) {
				Pout[i*N+j] = Math.max((P[i*N+j] + P[j*N+i])/N2, 1e-100);
			}
		}

		return Pout;
	}

	private d2p2(N: number, getDists: (i: number, j: number) => number,
				 perplexity: number, tol: number): number[] {

		const Htarget = Math.log(perplexity); // target entropy of distribution
		const P = this.zeros(N * N); // temporary probability matrix

		const prow = this.zeros(N); // a temporary storage compartment
		for(let i=0; i<N; i++) {

			let betamin = -Infinity;
			let betamax = Infinity;
			let beta = 1; // initial value of precision
			let done = false;
			const maxtries = 50;

			// perform binary search to find a suitable precision beta
			// so that the entropy of the distribution is appropriate
			let countIterations = 0;
			while(!done) {

				// compute entropy and kernel row with beta precision
				let psum = 0.0;
				for(let j=0; j<N; j++) {
					let pj = Math.exp(-getDists(i, j)*beta);
					// let pj = Math.exp(-D[i*N+j]*beta);
					if(i === j) pj = 0; // we don't care about diagonals
					prow[j] = pj;
					psum += pj;
				}

				// normalize p and compute entropy
				let Hhere = 0.0;
				for(let j=0; j<N; j++) {
					const pj = psum === 0 ? 0 : prow[j] / psum;
					prow[j] = pj;
					if(pj > 1e-7) Hhere -= pj * Math.log(pj);
				}

				// adjust beta based on result
				if(Hhere > Htarget) {
					// entropy was too high (distribution too diffuse)
					// so we need to increase the precision for more peaky distribution
					betamin = beta; // move up the bounds
					beta = betamax === Infinity ? beta * 2 : (beta + betamax) / 2;
				}
				else {
					// converse case. make distribution less peaky
					betamax = beta;
					beta = betamin === -Infinity ? beta / 2 : (beta + betamin) / 2;
				}

				// stopping conditions: too many tries or got a good precision
				countIterations++;
				if(Math.abs(Hhere - Htarget) < tol || countIterations >= maxtries) done = true;
			}

			// console.log('data point ' + i + ' gets precision ' + beta + ' after ' +
			// num + ' binary search steps.');
			// copy over the final prow to P at row i
			for(let j=0; j<N; j++) P[i*N+j] = prow[j];

		} // end loop over examples i

		// symmetrize P and normalize it to sum to 1 over all ij
		const Pout = this.zeros(N * N);
		const N2 = N*2;
		for(let i=0; i<N; i++) {
			for(let j=0; j<N; j++) {
				Pout[i*N+j] = Math.max((P[i*N+j] + P[j*N+i])/N2, 1e-100);
			}
		}

		return Pout;
	}

	// helper function
	private sign(x: number): number {
		if(x > 0) return 1;
		if(x < 0) return -1;
		return 0;
	}

    // this function takes a set of high-dimensional points
    // and creates matrix P from them using gaussian kernel
    initDataRaw(X: number[][]): void {

		const N = X.length;
		const D = X[0].length;
		this.assert(N > 0, " X is empty? You must have some data!");
		this.assert(D > 0, " X[0] is empty? Where is the data?");
		const dists = this.xtod(X); // convert X to distances using gaussian kernel
		this.P = this.d2p(dists, this.params.perplexity, 1e-4); // attach to object
		this.N = N; // back up the size of the dataset
		this.initSolution(); // refresh this
    }

    // this function takes a given distance matrix and creates
    // matrix P from them.
    // D is assumed to be provided as a list of lists, and should be symmetric
    initDataDist(D: number[][]): void {

		const N = D.length;
		this.assert(N > 0, " X is empty? You must have some data!");
		// convert D to a (fast) typed array version
		const dists = this.zeros(N * N); // allocate contiguous array
		for(let i=0; i<N-1; i++) {
			for(let j=i+1; j<N; j++) {
				const d = D[i][j];
				dists[i*N+j] = d;
				dists[j*N+i] = d;
			}
		}
		this.P = this.d2p(dists, this.params.perplexity, 1e-4);
		this.N = N;
		this.initSolution(); // refresh this
    }

	initDataDistComputed(N: number, getDist: (i: number, j: number) => number): void {

		this.N = N;
		this.P = this.d2p2(N, getDist, this.params.perplexity, 1e-4);
		this.initSolution(); // refresh this
	}

    // (re)initializes the solution to random
    private initSolution(): void {
      // generate random solution to t-SNE
      this.Y = this.randn2d(this.N, this.params.dim); // the solution
      this.gains = this.randn2d(this.N, this.params.dim, 1.0); // step gains to accelerate progress in unchanging directions
      this.ystep = this.randn2d(this.N, this.params.dim, 0.0); // momentum accumulator
      this.iter = 0;
    }

	/**
	 * Return the current solution
	 *
	 * @returns Array of solution points [N, dims]
	 */
    getSolution(): number[][] {
      	return this.Y;
    }

	/**
	 * Return the current solution
	 *
	 * @returns Array of solution points [N, dims]
	 */
    getNormalizedSolution(): number[][] {

		const min = Array<number>(this.params.dim).fill(Number.POSITIVE_INFINITY);
		const max = Array<number>(this.params.dim).fill(Number.NEGATIVE_INFINITY);
		const n = this.Y.length;
		for(let i=0; i<n; ++i) {
			for(let d=0; d<this.params.dim; ++d) {
				const y = this.Y[i][d];
				if(y < min[d]) min[d] = y;
				if(y > max[d]) max[d] = y;
			}
		}
		for(let i=0; i<n; ++i) {
			for(let d=0; d<this.params.dim; ++d) {

				this.Y[i][d] = (this.Y[i][d] - min[d]) / (max[d] - min[d]);
			}
		}

      	return this.Y;
    }

	/**
	 * Perform a single step of optimization to improve the embedding
	 *
	 * @returns The cost of this step
	 */
    step(): number {

		++this.iter;
      	const N = this.N;

     	const {cost, grad} = this.costGrad(this.Y); // evaluate gradient

		// perform gradient step
		const ymean = this.zeros(this.params.dim);
		for(let i=0; i<N; i++) {
			for(let d=0; d<this.params.dim; d++) {

				const gid = grad[i][d];
				const sid = this.ystep[i][d];
				const gainid = this.gains[i][d];

				// compute gain update
				let newgain = this.sign(gid) === this.sign(sid) ? gainid * 0.8 : gainid + 0.2;
				if(newgain < 0.01) newgain = 0.01; // clamp
				this.gains[i][d] = newgain; // store for next turn

				// compute momentum step direction
				const momval = this.iter < 250 ? 0.5 : 0.8;
				const newsid = momval * sid - this.params.epsilon * newgain * grad[i][d];
				this.ystep[i][d] = newsid; // remember the step we took

				// step!
				this.Y[i][d] += newsid;

				ymean[d] += this.Y[i][d]; // accumulate mean so that we can center later
			}
		}

		// Reproject Y to have zero mean
		for(let i=0; i<N; i++) {
			for(let d=0; d<this.params.dim; d++) {
				this.Y[i][d] -= ymean[d]/N;
			}
		}

		// Return current cost
		return cost;
    }
/*
    // for debugging: gradient check
    debugGrad(): void {

		const N = this.N;

     	const {grad} = this.costGrad(this.Y); // evaluate gradient

      	const e = 1e-5;
		for(let i=0; i<N; i++) {
			for(let d=0; d<this.params.dim; d++) {

				const yold = this.Y[i][d];

				this.Y[i][d] = yold + e;
				const cg0 = this.costGrad(this.Y);

				this.Y[i][d] = yold - e;
				const cg1 = this.costGrad(this.Y);

				const analytic = grad[i][d];
				const numerical = (cg0.cost - cg1.cost) / (2 * e);
				console.log(`${i}, ${d}: gradcheck analytic: ${analytic} vs. numerical: ${numerical}`);
				this.Y[i][d] = yold;
			}
		}
    }
*/

    // return cost and gradient, given an arrangement
    private costGrad(Y: number[][]): {cost: number; grad: number[][]} {

		const dim = this.params.dim; // dim of output space
		const {N, P} = this;
		const pmul = this.iter < 100 ? 4 : 1; // trick that helps with local optima

		// compute current Q distribution, unnormalized first
		const Qu = this.zeros(N * N);
		let qsum = 0.0;
		for(let i=0; i<N-1; i++) {
			for(let j=i+1; j<N; j++) {
				let dsum = 0;
				for(let d=0; d<dim; d++) {
					const dhere = Y[i][d] - Y[j][d];
					dsum += dhere * dhere;
				}
				const qu = 1.0 / (1.0 + dsum); // Student t-distribution
				Qu[i*N+j] = qu;
				Qu[j*N+i] = qu;
				qsum += 2 * qu;
			}
		}

		// normalize Q distribution to sum to 1
		const NN = N*N;
		const Q = this.zeros(NN);
		for(let q=0; q<NN; q++) Q[q] = Math.max(Qu[q] / qsum, 1e-100);

		let cost = 0.0;
		const grad = [];
		for(let i=0; i<N; i++) {
			const gsum = Array<number>(dim).fill(0); // init grad for point i
			for(let j=0; j<N; j++) {
				cost += -P[i*N+j] * Math.log(Q[i*N+j]); // accumulate cost (the non-constant portion at least...)
				const premult = 4 * (pmul * P[i*N+j] - Q[i*N+j]) * Qu[i*N+j];
				for(let d=0; d<dim; d++) {
					gsum[d] += premult * (Y[i][d] - Y[j][d]);
				}
			}
			grad.push(gsum);
		}

		return {cost, grad};
    }
}

/*
const test = (): void => {


// initialize data. Here we have 3 points and some example pairwise dissimilarities
var dists = [[1.0, 0.1, 0.2], [0.1, 1.0, 0.3], [0.2, 0.1, 1.0]];
const tsne = new TSNE({perplexity: 30, dim: 2, epsilon: 10});
tsne.initDataDist(dists);

for(let k = 0; k < 500; k++) {
  tsne.step(); // every time you call this, solution gets better
}

const Y = tsne.getSolution(); // Y is an array of 2-D points that you can plot
console.log(Y);
console.log("-------");

const tsne2 = new TSNE({perplexity: 30, dim: 2, epsilon: 10});
tsne2.initDataDistComputed(dists.length, (i, j) => dists[i][j]);
for(let k = 0; k < 500; k++) {
  tsne2.step(); // every time you call this, solution gets better
}
const Y2 = tsne2.getSolution(); // Y is an array of 2-D points that you can plot
console.log(Y2);

};
test();
*/
