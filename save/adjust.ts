
import fs from "node:fs";

const data = fs.readFileSync("save/atom-data.json", "utf8")

const input = JSON.parse(data);

let result = "[\n";
for(const el of input) {

	const out = {
		symbol: el.symbol,
		rCov: el.rCov,
		rVdW: el.rVdW,
		maxBonds: el.maxBonds,
		color: el.color
	}
	result += JSON.stringify(out) + ",\n";
}
result += "]\n";

console.log(result)
