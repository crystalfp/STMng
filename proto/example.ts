import {zeros, matrix, column, transpose, index, identity} from "mathjs";

const basis = [
	[9, 1, 2],
	[3, 4, 5],
	[6, 7, 8]
];

export const a = matrix(basis);
// const b = zeros(3, 3, 'dense');
export const b = matrix(zeros(3, 3));

// Initialize first column
for(let i = 0; i < 3; i++) b.set([i, 0], a.get([i, 0]));

b.subset(index([0, 1, 2], 0), column(a, 0))
console.log(b);

console.log(a.toArray());
console.log(b.toArray());
console.log(transpose(b).toArray());

const i = identity(3);
console.log(i);
