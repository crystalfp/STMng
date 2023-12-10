
import type {Atom, Bond, Object3D} from "@/types";

interface AtomData {
	symbol: string;
	rCov: number;
	rVdW: number;
	maxBonds: number;
	red: number;
	green: number;
	blue: number;
	name: string;
}

export class Structure2Object3D {

	private readonly atomData: AtomData[] = [];
	// eslint-disable-next-line @typescript-eslint/prefer-readonly
	private useRCov = true;

	constructor(atomDataFile: string) {

		void atomDataFile;

		this.atomData = [
{symbol: "Xx",	rCov: 0.00,	rVdW: 0.00,	maxBonds: 0, red:  18, green: 128, blue: 179, name: "Dummy"},
{symbol: "H",	rCov: 0.37,	rVdW: 1.20,	maxBonds: 1, red: 255, green: 255, blue: 255, name: "Hydrogen"},
{symbol: "He",	rCov: 0.32,	rVdW: 1.40,	maxBonds: 0, red: 217, green: 255, blue: 255, name: "Helium"},
{symbol: "Li",	rCov: 1.34,	rVdW: 2.20,	maxBonds: 1, red: 204, green: 128, blue: 255, name: "Lithium"},
{symbol: "Be",	rCov: 0.90,	rVdW: 1.90,	maxBonds: 2, red: 194, green: 255, blue:   0, name: "Beryllium"},
{symbol: "B",	rCov: 0.82,	rVdW: 1.80,	maxBonds: 3, red: 255, green: 181, blue: 181, name: "Boron"},
{symbol: "C",	rCov: 0.77,	rVdW: 1.70,	maxBonds: 4, red: 128, green: 128, blue: 128, name: "Carbon"},
{symbol: "N",	rCov: 0.75,	rVdW: 1.60,	maxBonds: 4, red:  13, green:  13, blue: 255, name: "Nitrogen"},
{symbol: "O",	rCov: 0.73,	rVdW: 1.55,	maxBonds: 2, red: 255, green:  13, blue:  13, name: "Oxygen"},
		];

/*		const content =

    var allTextLines = allText.split(/\r\n|\n/);
    var headers = allTextLines[0].split(',');
    var lines = [];

    for (var i=1; i<allTextLines.length; i++) {
        var data = allTextLines[i].split(',');
        if (data.length == headers.length) {

            var tarr = [];
            for (var j=0; j<headers.length; j++) {
                tarr.push(headers[j]+":"+data[j]);
            }
            lines.push(tarr);
        }
    }*/
	}

	structure2object(atoms: Atom[], bonds: Bond[]): Object3D[] {

		const objects: Object3D[] = [];
		const scale = 0.5;
		const bondRadius = 0.1;

		for(const atom of atoms) {

			const data = this.atomData[atom.Z];
			const color = `rgb(${data.red},${data.green},${data.blue})`;
			const radius = this.useRCov ? data.rCov*scale : data.rVdW;
			objects.push({type: "sphere", radius, position: atom.position, color});
		}

		if(this.useRCov) {
			for(const bond of bonds) {

				const from = this.atomData[atoms[bond.from].Z];
				const to   = this.atomData[atoms[bond.to].Z];

				const radiusFrom = from.rCov*scale;
				const posFrom = atoms[bond.from].position;
				const radiusTo = to.rCov*scale;
				const posTo = atoms[bond.to].position;

				const dx = posFrom[0] - posTo[0];
				const dy = posFrom[1] - posTo[1];
				const dz = posFrom[2] - posTo[2];
				const distance = Math.hypot(dx, dy, dz);
				const surfDistanceFrom = Math.sqrt(radiusFrom*radiusFrom - bondRadius*bondRadius);
				const fractionFrom = surfDistanceFrom/distance;
				const start: [number, number, number] = [
					posFrom[0] - dx*fractionFrom,
					posFrom[1] - dy*fractionFrom,
					posFrom[2] - dz*fractionFrom,
				];
				const surfDistanceTo = Math.sqrt(radiusTo*radiusTo - bondRadius*bondRadius);
				const fractionTo = surfDistanceTo/distance;
				const end: [number, number, number] = [
					posTo[0] + dx*fractionTo,
					posTo[1] + dy*fractionTo,
					posTo[2] + dz*fractionTo,
				];
				const colorStart = `rgb(${from.red},${from.green},${from.blue})`;
				const colorEnd   = `rgb(${to.red},${to.green},${to.blue})`;

				objects.push({type: "cylinder", radius: bondRadius, start, end, colorStart, colorEnd});
			}
		}
		return objects;
	}
}
