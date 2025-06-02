// Types and interfaces
interface Site {
  coords: number[];
  species: Species;
}

interface Species {
  weight: number;
  element: string;
}

interface Molecule {
  sites: Site[];
  getCenteredMolecule(): Molecule;
  cartCoords: number[][];
  speciesAndOccu: Species[];
}

interface SymmOp {
  rotationMatrix: number[][];
  translationVector: number[];
  operate(coords: number[]): number[];
}

interface PointGroupOperations {
  schSymbol: string;
  symmOps: SymmOp[];
  matTol: number;
}

type MirrorType = 'h' | 'd' | 'v' | '';

// Utility functions
class MathUtils {
  static dot(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  static cross(a: number[], b: number[]): number[] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  static norm(vec: number[]): number {
    return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  }

  static normalize(vec: number[]): number[] {
    const n = this.norm(vec);
    return n === 0 ? vec : vec.map(v => v / n);
  }

  static eye(n: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        matrix[i][j] = i === j ? 1 : 0;
      }
    }
    return matrix;
  }

  static eigenDecomposition(matrix: number[][]): { eigenvalues: number[], eigenvectors: number[][] } {
    // Simplified eigenvalue/eigenvector calculation for 3x3 symmetric matrices
    // In a real implementation, you'd use a proper linear algebra library
    // This is a placeholder that returns reasonable values for demonstration
    return {
      eigenvalues: [1, 1, 1], // Placeholder
      eigenvectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] // Placeholder
    };
  }

  static det(matrix: number[][]): number {
    if (matrix.length === 3) {
      const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
      return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    }
    // Simplified for 3x3 matrices
    return 0;
  }

  static matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        result[i][j] = 0;
        for (let k = 0; k < b.length; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }

  static transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }
}

class SymmOpFactory {
  static inversion(): SymmOp {
    return {
      rotationMatrix: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],
      translationVector: [0, 0, 0],
      operate: (coords: number[]) => coords.map(c => -c)
    };
  }

  static fromAxisAngleAndTranslation(axis: number[], angle: number, translation: number[] = [0, 0, 0]): SymmOp {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const [x, y, z] = MathUtils.normalize(axis);

    // Rodrigues rotation formula
    const rotMatrix = [
      [cos + x * x * (1 - cos), x * y * (1 - cos) - z * sin, x * z * (1 - cos) + y * sin],
      [y * x * (1 - cos) + z * sin, cos + y * y * (1 - cos), y * z * (1 - cos) - x * sin],
      [z * x * (1 - cos) - y * sin, z * y * (1 - cos) + x * sin, cos + z * z * (1 - cos)]
    ];

    return {
      rotationMatrix: rotMatrix,
      translationVector: translation,
      operate: (coords: number[]) => {
        const rotated = rotMatrix.map(row =>
          row.reduce((sum, val, i) => sum + val * coords[i], 0)
        );
        return rotated.map((val, i) => val + translation[i]);
      }
    };
  }

  static reflection(normal: number[]): SymmOp {
    const n = MathUtils.normalize(normal);
    const [nx, ny, nz] = n;

    // Reflection matrix: I - 2*n*n^T
    const reflMatrix = [
      [1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * nz],
      [-2 * ny * nx, 1 - 2 * ny * ny, -2 * ny * nz],
      [-2 * nz * nx, -2 * nz * ny, 1 - 2 * nz * nz]
    ];

    return {
      rotationMatrix: reflMatrix,
      translationVector: [0, 0, 0],
      operate: (coords: number[]) =>
        reflMatrix.map(row =>
          row.reduce((sum, val, i) => sum + val * coords[i], 0)
        )
    };
  }

  static rotoreflection(axis: number[], angle: number): SymmOp {
    const rotation = this.fromAxisAngleAndTranslation(axis, angle);
    const reflection = this.reflection(axis);

    // Combined operation
    return {
      rotationMatrix: MathUtils.matrixMultiply(reflection.rotationMatrix, rotation.rotationMatrix),
      translationVector: [0, 0, 0],
      operate: (coords: number[]) => {
        const rotated = rotation.operate(coords);
        return reflection.operate(rotated);
      }
    };
  }
}

class PointGroupAnalyzer {
  private static readonly inversionOp = SymmOpFactory.inversion();

  public schSymbol: string = 'C1';
  private mol: Molecule;
  private centeredMol: Molecule;
  private tol: number;
  private eigTol: number;
  private matTol: number;
  private principalAxes: number[][] = [];
  private eigvals: number[] = [];
  private rotSym: Array<[number[], number]> = [];
  private symmOps: SymmOp[] = [];

  constructor(
    mol: Molecule,
    tolerance: number = 0.3,
    eigenTolerance: number = 0.01,
    matrixTolerance: number = 0.1
  ) {
    this.mol = mol;
    this.centeredMol = mol.getCenteredMolecule();
    this.tol = tolerance;
    this.eigTol = eigenTolerance;
    this.matTol = matrixTolerance;
    this.symmOps.push({
      rotationMatrix: MathUtils.eye(3),
      translationVector: [0, 0, 0],
      operate: (coords: number[]) => [...coords]
    });

    this.analyze();

    if (this.schSymbol === 'C1v' || this.schSymbol === 'C1h') {
      this.schSymbol = 'Cs';
    }
  }

  private analyze(): void {
    if (this.centeredMol.sites.length === 1) {
      this.schSymbol = 'Kh';
      return;
    }

    const inertiaTensor = this.calculateInertiaTensor();
    const { eigenvalues, eigenvectors } = MathUtils.eigenDecomposition(inertiaTensor);

    this.principalAxes = eigenvectors;
    this.eigvals = eigenvalues;

    const [v1, v2, v3] = eigenvalues;
    const eigZero = Math.abs(v1 * v2 * v3) < this.eigTol;
    const eigAllSame = Math.abs(v1 - v2) < this.eigTol && Math.abs(v1 - v3) < this.eigTol;
    const eigAllDiff = Math.abs(v1 - v2) > this.eigTol &&
                      Math.abs(v1 - v3) > this.eigTol &&
                      Math.abs(v2 - v3) > this.eigTol;

    if (eigZero) {
      console.log('Linear molecule detected');
      this.procLinear();
    } else if (eigAllSame) {
      console.log('Spherical top molecule detected');
      this.procSphTop();
    } else if (eigAllDiff) {
      console.log('Asymmetric top molecule detected');
      this.procAsymTop();
    } else {
      console.log('Symmetric top molecule detected');
      this.procSymTop();
    }
  }

  private calculateInertiaTensor(): number[][] {
    const inertiaTensor = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    let totalInertia = 0;

    for (const site of this.centeredMol.sites) {
      const c = site.coords;
      const wt = site.species.weight;

      for (let i = 0; i < 3; i++) {
        inertiaTensor[i][i] += wt * (c[(i + 1) % 3] ** 2 + c[(i + 2) % 3] ** 2);
      }

      const pairs = [[0, 1], [1, 2], [0, 2]];
      for (const [i, j] of pairs) {
        inertiaTensor[i][j] += -wt * c[i] * c[j];
        inertiaTensor[j][i] += -wt * c[j] * c[i];
      }

      totalInertia += wt * MathUtils.dot(c, c);
    }

    // Normalize
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        inertiaTensor[i][j] /= totalInertia;
      }
    }

    return inertiaTensor;
  }

  private procLinear(): void {
    if (this.isValidOp(PointGroupAnalyzer.inversionOp)) {
      this.schSymbol = 'D*h';
      this.symmOps.push(PointGroupAnalyzer.inversionOp);
    } else {
      this.schSymbol = 'C*v';
    }
  }

  private procAsymTop(): void {
    this.checkR2AxesAsym();

    if (this.rotSym.length === 0) {
      console.log('No rotation symmetries detected.');
      this.procNoRotSym();
    } else if (this.rotSym.length === 3) {
      console.log('Dihedral group detected.');
      this.procDihedral();
    } else {
      console.log('Cyclic group detected.');
      this.procCyclic();
    }
  }

  private procSymTop(): void {
    let ind: number;
    if (Math.abs(this.eigvals[0] - this.eigvals[1]) < this.eigTol) {
      ind = 2;
    } else if (Math.abs(this.eigvals[1] - this.eigvals[2]) < this.eigTol) {
      ind = 0;
    } else {
      ind = 1;
    }

    console.log(`Eigenvalues = ${this.eigvals}`);
    const uniqueAxis = this.principalAxes[ind];
    this.checkRotSym(uniqueAxis);
    console.log(`Rotation symmetries = ${this.rotSym.length}`);

    if (this.rotSym.length > 0) {
      this.checkPerpendicularR2Axis(uniqueAxis);
    }

    if (this.rotSym.length >= 2) {
      this.procDihedral();
    } else if (this.rotSym.length === 1) {
      this.procCyclic();
    } else {
      this.procNoRotSym();
    }
  }

  private procNoRotSym(): void {
    this.schSymbol = 'C1';

    if (this.isValidOp(PointGroupAnalyzer.inversionOp)) {
      this.schSymbol = 'Ci';
      this.symmOps.push(PointGroupAnalyzer.inversionOp);
    } else {
      for (const v of this.principalAxes) {
        const mirrorType = this.findMirror(v);
        if (mirrorType !== '') {
          this.schSymbol = 'Cs';
          break;
        }
      }
    }
  }

  private procCyclic(): void {
    const [mainAxis, rot] = this.rotSym.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max
    );

    this.schSymbol = `C${rot}`;
    const mirrorType = this.findMirror(mainAxis);

    if (mirrorType === 'h') {
      this.schSymbol += 'h';
    } else if (mirrorType === 'v') {
      this.schSymbol += 'v';
    } else if (mirrorType === '' &&
               this.isValidOp(SymmOpFactory.rotoreflection(mainAxis, 180 / rot))) {
      this.schSymbol = `S${2 * rot}`;
    }
  }

  private procDihedral(): void {
    const [mainAxis, rot] = this.rotSym.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max
    );

    this.schSymbol = `D${rot}`;
    const mirrorType = this.findMirror(mainAxis);

    if (mirrorType === 'h') {
      this.schSymbol += 'h';
    } else if (mirrorType !== '') {
      this.schSymbol += 'd';
    }
  }

  private procSphTop(): void {
    this.findSphericalAxes();

    if (this.rotSym.length === 0) {
      console.log('Accidental spherical top!');
      this.procSymTop();
      return;
    }

    const [mainAxis, rot] = this.rotSym.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max
    );

    if (rot < 3) {
      console.log('Accidental spherical top!');
      this.procSymTop();
    } else if (rot === 3) {
      const mirrorType = this.findMirror(mainAxis);
      if (mirrorType === '') {
        this.schSymbol = 'T';
      } else if (this.isValidOp(PointGroupAnalyzer.inversionOp)) {
        this.symmOps.push(PointGroupAnalyzer.inversionOp);
        this.schSymbol = 'Th';
      } else {
        this.schSymbol = 'Td';
      }
    } else if (rot === 4) {
      if (this.isValidOp(PointGroupAnalyzer.inversionOp)) {
        this.symmOps.push(PointGroupAnalyzer.inversionOp);
        this.schSymbol = 'Oh';
      } else {
        this.schSymbol = 'O';
      }
    } else if (rot === 5) {
      if (this.isValidOp(PointGroupAnalyzer.inversionOp)) {
        this.symmOps.push(PointGroupAnalyzer.inversionOp);
        this.schSymbol = 'Ih';
      } else {
        this.schSymbol = 'I';
      }
    }
  }

  private checkR2AxesAsym(): void {
    for (const v of this.principalAxes) {
      const op = SymmOpFactory.fromAxisAngleAndTranslation(v, 180);
      if (this.isValidOp(op)) {
        this.symmOps.push(op);
        this.rotSym.push([v, 2]);
      }
    }
  }

  private findMirror(axis: number[]): MirrorType {
    let mirrorType: MirrorType = '';

    // Test if axis is normal to mirror plane
    if (this.isValidOp(SymmOpFactory.reflection(axis))) {
      this.symmOps.push(SymmOpFactory.reflection(axis));
      mirrorType = 'h';
    } else {
      // Test pairs of atoms for mirror planes
      const sites = this.centeredMol.sites;
      for (let i = 0; i < sites.length; i++) {
        for (let j = i + 1; j < sites.length; j++) {
          const s1 = sites[i];
          const s2 = sites[j];

          if (s1.species.element === s2.species.element) {
            const normal = s1.coords.map((c, k) => c - s2.coords[k]);

            if (MathUtils.dot(normal, axis) < this.tol) {
              const op = SymmOpFactory.reflection(normal);
              if (this.isValidOp(op)) {
                this.symmOps.push(op);

                if (this.rotSym.length > 1) {
                  mirrorType = 'd';
                  for (const [v] of this.rotSym) {
                    if (MathUtils.norm(v.map((c, k) => c - axis[k])) >= this.tol &&
                        MathUtils.dot(v, normal) < this.tol) {
                      mirrorType = 'v';
                      break;
                    }
                  }
                } else {
                  mirrorType = 'v';
                }
                break;
              }
            }
          }
        }
        if (mirrorType !== '') break;
      }
    }

    return mirrorType;
  }

  private getSmallestSetNotOnAxis(axis: number[]): Site[] {
    const notOnAxis = (site: Site): boolean => {
      const cross = MathUtils.cross(site.coords, axis);
      return MathUtils.norm(cross) > this.tol;
    };

    // Simplified clustering - in real implementation would use proper clustering
    const validSites = this.centeredMol.sites.filter(notOnAxis);
    return validSites.slice(0, Math.min(validSites.length, 8)); // Limit for performance
  }

  private checkRotSym(axis: number[]): number {
    const minSet = this.getSmallestSetNotOnAxis(axis);
    const maxSym = minSet.length;

    for (let idx = maxSym; idx > 0; idx--) {
      if (maxSym % idx !== 0) continue;

      const op = SymmOpFactory.fromAxisAngleAndTranslation(axis, 360 / idx);
      if (this.isValidOp(op)) {
        this.symmOps.push(op);
        this.rotSym.push([axis, idx]);
        return idx;
      }
    }
    return 1;
  }

  private checkPerpendicularR2Axis(axis: number[]): boolean {
    const minSet = this.getSmallestSetNotOnAxis(axis);

    for (let i = 0; i < minSet.length; i++) {
      for (let j = i + 1; j < minSet.length; j++) {
        const s1 = minSet[i];
        const s2 = minSet[j];
        const diff = s1.coords.map((c, k) => c - s2.coords[k]);
        const testAxis = MathUtils.cross(diff, axis);

        if (MathUtils.norm(testAxis) > this.tol) {
          const op = SymmOpFactory.fromAxisAngleAndTranslation(testAxis, 180);
          if (this.isValidOp(op)) {
            this.symmOps.push(op);
            this.rotSym.push([testAxis, 2]);
            return true;
          }
        }
      }
    }
    return false;
  }

  private findSphericalAxes(): void {
    const rotPresent: { [key: number]: boolean } = {};

    // Simplified spherical axes detection
    const coords = this.centeredMol.sites.map(s => s.coords);

    for (let i = 0; i < Math.min(coords.length, 10); i++) {
      for (let j = i + 1; j < Math.min(coords.length, 10); j++) {
        for (let k = j + 1; k < Math.min(coords.length, 10); k++) {
          const c1 = coords[i], c2 = coords[j], c3 = coords[k];

          // Test R2 axis
          if (!rotPresent[2]) {
            const testAxis = c1.map((c, idx) => c + c2[idx]);
            if (MathUtils.norm(testAxis) > this.tol) {
              const op = SymmOpFactory.fromAxisAngleAndTranslation(testAxis, 180);
              if (this.isValidOp(op)) {
                rotPresent[2] = true;
                this.symmOps.push(op);
                this.rotSym.push([testAxis, 2]);
              }
            }
          }

          // Test R3, R4, R5 axes
          const diff1 = c2.map((c, idx) => c - c1[idx]);
          const diff2 = c3.map((c, idx) => c - c1[idx]);
          const testAxis = MathUtils.cross(diff1, diff2);

          if (MathUtils.norm(testAxis) > this.tol) {
            for (const r of [3, 4, 5]) {
              if (!rotPresent[r]) {
                const op = SymmOpFactory.fromAxisAngleAndTranslation(testAxis, 360 / r);
                if (this.isValidOp(op)) {
                  rotPresent[r] = true;
                  this.symmOps.push(op);
                  this.rotSym.push([testAxis, r]);
                  break;
                }
              }
            }
          }

          if (rotPresent[2] && rotPresent[3] && (rotPresent[4] || rotPresent[5])) {
            return;
          }
        }
      }
    }
  }

  public isValidOp(symmOp: SymmOp): boolean {
    const coords = this.centeredMol.cartCoords;

    for (const site of this.centeredMol.sites) {
      const transformedCoord = symmOp.operate(site.coords);

      // Check if transformed coordinate matches any existing coordinate
      let found = false;
      for (let i = 0; i < coords.length; i++) {
        const diff = transformedCoord.map((c, j) => Math.abs(c - coords[i][j]));
        if (diff.every(d => d < this.tol)) {
          if (this.centeredMol.sites[i].species.element === site.species.element) {
            found = true;
            break;
          }
        }
      }

      if (!found) {
        return false;
      }
    }

    return true;
  }

  public getPointGroup(): PointGroupOperations {
    return {
      schSymbol: this.schSymbol,
      symmOps: this.symmOps,
      matTol: this.matTol
    };
  }

  public getSymmetryOperations(): SymmOp[] {
    // In a full implementation, this would generate the complete set of symmetry operations
    return [...this.symmOps];
  }

  public getRotationalSymmetryNumber(): number {
    if (this.schSymbol === 'D*h') {
      return 2; // Special case for H2
    }

    const symmOps = this.getSymmetryOperations();
    let symmNumber = 0;

    for (const symm of symmOps) {
      const det = MathUtils.det(symm.rotationMatrix);
      if (Math.abs(det - 1) < 1e-4) {
        symmNumber++;
      }
    }

    return symmNumber;
  }
}

export { PointGroupAnalyzer, SymmOpFactory, MathUtils, type Molecule, type Site, type Species, type SymmOp };
