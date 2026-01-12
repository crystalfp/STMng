/**
 * Access atoms info.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

/**
 * Info regarding one atom type
 * @notExported
 */
interface AtomInfo {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Atom color as an hex string (#RRGGBB) */
	color: string;

    /** Maximum number of bonds for the element type */
    maxBonds: number;

	/** The bonding strength. Bond strength is sqrt(bondStrengthI*bondStrengthJ) */
	bondStrength: number;

	/** Atomic mass */
	mass: number;
}

/** Atom data (before was atom-data.json file) */
const atomData = [
{symbol:"Xx", rCov:0,    rVdW:0,    maxBonds:0,  color:"#000000", bondStrength:0,    mass:0},
{symbol:"H",  rCov:0.37, rVdW:1.2,  maxBonds:1,  color:"#FFFFFF", bondStrength:0.2,  mass:1.00794},
{symbol:"He", rCov:0.32, rVdW:1.4,  maxBonds:0,  color:"#D9FFFF", bondStrength:0.05, mass:4.002602},
{symbol:"Li", rCov:1.34, rVdW:2.2,  maxBonds:1,  color:"#CC80FF", bondStrength:0.1,  mass:6.941},
{symbol:"Be", rCov:0.9,  rVdW:1.9,  maxBonds:2,  color:"#C2FF00", bondStrength:0.2,  mass:9.012182},
{symbol:"B",  rCov:0.82, rVdW:1.8,  maxBonds:3,  color:"#FFB5B5", bondStrength:0.3,  mass:10.811},
{symbol:"C",  rCov:0.77, rVdW:1.7,  maxBonds:4,  color:"#808080", bondStrength:0.5,  mass:12.0107},
{symbol:"N",  rCov:0.75, rVdW:1.6,  maxBonds:4,  color:"#0D0DFF", bondStrength:0.5,  mass:14.0067},
{symbol:"O",  rCov:0.73, rVdW:1.55, maxBonds:2,  color:"#FF0D0D", bondStrength:0.3,  mass:15.9994},
{symbol:"F",  rCov:0.71, rVdW:1.5,  maxBonds:1,  color:"#B3FFFF", bondStrength:0.1,  mass:18.9984032},
{symbol:"Ne", rCov:0.69, rVdW:1.54, maxBonds:0,  color:"#B3E3F5", bondStrength:0.05, mass:20.1797},
{symbol:"Na", rCov:1.54, rVdW:2.4,  maxBonds:1,  color:"#AB5CF2", bondStrength:0.05, mass:22.98977},
{symbol:"Mg", rCov:1.3,  rVdW:2.2,  maxBonds:2,  color:"#8AFF00", bondStrength:0.1,  mass:24.305},
{symbol:"Al", rCov:1.18, rVdW:2.1,  maxBonds:6,  color:"#BFA6A6", bondStrength:0.2,  mass:26.981538},
{symbol:"Si", rCov:1.11, rVdW:2.1,  maxBonds:6,  color:"#809999", bondStrength:0.3,  mass:28.0855},
{symbol:"P",  rCov:1.06, rVdW:1.95, maxBonds:5,  color:"#FF8000", bondStrength:0.3,  mass:30.973761},
{symbol:"S",  rCov:1.02, rVdW:1.8,  maxBonds:6,  color:"#FFFF30", bondStrength:0.2,  mass:32.065},
{symbol:"Cl", rCov:0.99, rVdW:1.8,  maxBonds:1,  color:"#1FF01F", bondStrength:0.1,  mass:35.453},
{symbol:"Ar", rCov:0.97, rVdW:1.88, maxBonds:0,  color:"#80D1E3", bondStrength:0.05, mass:39.948},
{symbol:"K",  rCov:1.96, rVdW:2.8,  maxBonds:1,  color:"#8F40D4", bondStrength:0.05, mass:39.0983},
{symbol:"Ca", rCov:1.74, rVdW:2.4,  maxBonds:2,  color:"#3DFF00", bondStrength:0.1,  mass:40.078},
{symbol:"Sc", rCov:1.44, rVdW:2.3,  maxBonds:6,  color:"#E6E6E6", bondStrength:0.2,  mass:44.95591},
{symbol:"Ti", rCov:1.36, rVdW:2.15, maxBonds:6,  color:"#BFC2C7", bondStrength:0.3,  mass:47.867},
{symbol:"V",  rCov:1.25, rVdW:2.05, maxBonds:6,  color:"#A6A6AB", bondStrength:0.3,  mass:50.9415},
{symbol:"Cr", rCov:1.27, rVdW:2.05, maxBonds:6,  color:"#8A99C7", bondStrength:0.25, mass:51.9961},
{symbol:"Mn", rCov:1.39, rVdW:2.05, maxBonds:8,  color:"#9C7AC7", bondStrength:0.3,  mass:54.938049},
{symbol:"Fe", rCov:1.25, rVdW:2.05, maxBonds:6,  color:"#807AC7", bondStrength:0.25, mass:55.845},
{symbol:"Co", rCov:1.26, rVdW:2,    maxBonds:6,  color:"#707AC7", bondStrength:0.25, mass:58.9332},
{symbol:"Ni", rCov:1.21, rVdW:2,    maxBonds:6,  color:"#5C7AC2", bondStrength:0.15, mass:58.6934},
{symbol:"Cu", rCov:1.38, rVdW:2,    maxBonds:6,  color:"#B39172", bondStrength:0.1,  mass:63.546},
// {symbol:"Cu", rCov:1.38, rVdW:2,    maxBonds:6,  color:"#FF7A61", bondStrength:0.1,  mass:63.546},
{symbol:"Zn", rCov:1.31, rVdW:2.1,  maxBonds:6,  color:"#7D80B0", bondStrength:0.1,  mass:65.38},
{symbol:"Ga", rCov:1.26, rVdW:2.1,  maxBonds:3,  color:"#C28F8F", bondStrength:0.25, mass:69.723},
{symbol:"Ge", rCov:1.22, rVdW:2.1,  maxBonds:4,  color:"#668F8F", bondStrength:0.5,  mass:72.64},
{symbol:"As", rCov:1.19, rVdW:2.05, maxBonds:3,  color:"#BD80E3", bondStrength:0.35, mass:74.9216},
{symbol:"Se", rCov:1.16, rVdW:1.9,  maxBonds:2,  color:"#FFA100", bondStrength:0.2,  mass:78.96},
{symbol:"Br", rCov:1.14, rVdW:1.9,  maxBonds:1,  color:"#A62929", bondStrength:0.1,  mass:79.904},
{symbol:"Kr", rCov:1.1,  rVdW:2.02, maxBonds:0,  color:"#5CB8D1", bondStrength:0.05, mass:83.798},
{symbol:"Rb", rCov:2.11, rVdW:2.9,  maxBonds:1,  color:"#702EB0", bondStrength:0.05, mass:85.4678},
{symbol:"Sr", rCov:1.92, rVdW:2.55, maxBonds:2,  color:"#00FF00", bondStrength:0.1,  mass:87.62},
{symbol:"Y",  rCov:1.62, rVdW:2.4,  maxBonds:6,  color:"#94FFFF", bondStrength:0.2,  mass:88.90585},
{symbol:"Zr", rCov:1.48, rVdW:2.3,  maxBonds:6,  color:"#94E0E0", bondStrength:0.3,  mass:91.224},
{symbol:"Nb", rCov:1.37, rVdW:2.15, maxBonds:6,  color:"#73C2C9", bondStrength:0.35, mass:92.90638},
{symbol:"Mo", rCov:1.45, rVdW:2.1,  maxBonds:6,  color:"#54B5B5", bondStrength:0.3,  mass:95.96},
{symbol:"Tc", rCov:1.56, rVdW:2.05, maxBonds:6,  color:"#3B9E9E", bondStrength:0.3,  mass:98},
{symbol:"Ru", rCov:1.26, rVdW:2.05, maxBonds:6,  color:"#248F8F", bondStrength:0.3,  mass:101.07},
{symbol:"Rh", rCov:1.35, rVdW:2,    maxBonds:6,  color:"#0A7D8C", bondStrength:0.3,  mass:102.9055},
{symbol:"Pd", rCov:1.31, rVdW:2.05, maxBonds:6,  color:"#006985", bondStrength:0.3,  mass:106.42},
{symbol:"Ag", rCov:1.53, rVdW:2.1,  maxBonds:6,  color:"#E0E0FF", bondStrength:0.05, mass:107.8682},
{symbol:"Cd", rCov:1.48, rVdW:2.2,  maxBonds:6,  color:"#FFD98F", bondStrength:0.1,  mass:112.411},
{symbol:"In", rCov:1.44, rVdW:2.2,  maxBonds:3,  color:"#A67573", bondStrength:0.2,  mass:114.818},
{symbol:"Sn", rCov:1.41, rVdW:2.25, maxBonds:4,  color:"#668080", bondStrength:0.3,  mass:118.701},
{symbol:"Sb", rCov:1.38, rVdW:2.2,  maxBonds:3,  color:"#9E63B5", bondStrength:0.2,  mass:121.76},
{symbol:"Te", rCov:1.35, rVdW:2.1,  maxBonds:2,  color:"#D47A00", bondStrength:0.2,  mass:127.6},
{symbol:"I",  rCov:1.33, rVdW:2.1,  maxBonds:1,  color:"#940094", bondStrength:0.1,  mass:126.90447},
{symbol:"Xe", rCov:1.3,  rVdW:2.16, maxBonds:0,  color:"#429EB0", bondStrength:0.05, mass:131.293},
{symbol:"Cs", rCov:2.25, rVdW:3,    maxBonds:1,  color:"#57178F", bondStrength:0.05, mass:132.90545},
{symbol:"Ba", rCov:1.98, rVdW:2.7,  maxBonds:2,  color:"#00C900", bondStrength:0.1,  mass:137.327},
{symbol:"La", rCov:1.69, rVdW:2.5,  maxBonds:12, color:"#70D4FF", bondStrength:0.2,  mass:138.9055},
{symbol:"Ce", rCov:1.6,  rVdW:2.48, maxBonds:6,  color:"#FFFFC7", bondStrength:0.3,  mass:140.116},
{symbol:"Pr", rCov:1.6,  rVdW:2.47, maxBonds:6,  color:"#D9FFC7", bondStrength:0.2,  mass:140.90765},
{symbol:"Nd", rCov:1.6,  rVdW:2.45, maxBonds:6,  color:"#C7FFC7", bondStrength:0.2,  mass:144.24},
{symbol:"Pm", rCov:1.6,  rVdW:2.43, maxBonds:6,  color:"#A3FFC7", bondStrength:0.2,  mass:145},
{symbol:"Sm", rCov:1.6,  rVdW:2.42, maxBonds:6,  color:"#8FFFC7", bondStrength:0.2,  mass:150.36},
{symbol:"Eu", rCov:1.6,  rVdW:2.4,  maxBonds:6,  color:"#61FFC7", bondStrength:0.2,  mass:151.964},
{symbol:"Gd", rCov:1.6,  rVdW:2.38, maxBonds:6,  color:"#45FFC7", bondStrength:0.2,  mass:157.25},
{symbol:"Tb", rCov:1.6,  rVdW:2.37, maxBonds:6,  color:"#30FFC7", bondStrength:0.2,  mass:158.92534},
{symbol:"Dy", rCov:1.6,  rVdW:2.35, maxBonds:6,  color:"#1FFFC7", bondStrength:0.2,  mass:162.5},
{symbol:"Ho", rCov:1.6,  rVdW:2.33, maxBonds:6,  color:"#00FF9C", bondStrength:0.2,  mass:164.93032},
{symbol:"Er", rCov:1.6,  rVdW:2.32, maxBonds:6,  color:"#00E675", bondStrength:0.2,  mass:167.259},
{symbol:"Tm", rCov:1.6,  rVdW:2.3,  maxBonds:6,  color:"#00D452", bondStrength:0.2,  mass:168.93421},
{symbol:"Yb", rCov:1.6,  rVdW:2.28, maxBonds:6,  color:"#00BF38", bondStrength:0.2,  mass:173.054},
{symbol:"Lu", rCov:1.6,  rVdW:2.27, maxBonds:6,  color:"#00AB24", bondStrength:0.2,  mass:174.9668},
{symbol:"Hf", rCov:1.5,  rVdW:2.25, maxBonds:6,  color:"#4DC2FF", bondStrength:0.3,  mass:178.49},
{symbol:"Ta", rCov:1.38, rVdW:2.2,  maxBonds:6,  color:"#4DA6FF", bondStrength:0.4,  mass:180.9479},
{symbol:"W",  rCov:1.46, rVdW:2.1,  maxBonds:6,  color:"#2194D6", bondStrength:0.3,  mass:183.84},
{symbol:"Re", rCov:1.59, rVdW:2.05, maxBonds:6,  color:"#267DAB", bondStrength:0.3,  mass:186.207},
{symbol:"Os", rCov:1.28, rVdW:2,    maxBonds:6,  color:"#266696", bondStrength:0.3,  mass:190.23},
{symbol:"Ir", rCov:1.37, rVdW:2,    maxBonds:6,  color:"#175487", bondStrength:0.3,  mass:192.217},
{symbol:"Pt", rCov:1.28, rVdW:2.05, maxBonds:6,  color:"#F5EDD1", bondStrength:0.3,  mass:195.078},
{symbol:"Au", rCov:1.44, rVdW:2.1,  maxBonds:6,  color:"#CCD11F", bondStrength:0.05, mass:196.96655},
{symbol:"Hg", rCov:1.49, rVdW:2.05, maxBonds:6,  color:"#B5B5C2", bondStrength:0.1,  mass:200.59},
{symbol:"Tl", rCov:1.48, rVdW:2.2,  maxBonds:3,  color:"#A6544D", bondStrength:0.2,  mass:204.3833},
{symbol:"Pb", rCov:1.47, rVdW:2.3,  maxBonds:4,  color:"#575961", bondStrength:0.3,  mass:207.2},
{symbol:"Bi", rCov:1.46, rVdW:2.3,  maxBonds:3,  color:"#9E4FB5", bondStrength:0.2,  mass:208.9804},
{symbol:"Po", rCov:1.6,  rVdW:2,    maxBonds:2,  color:"#AB5C00", bondStrength:0.2,  mass:209},
{symbol:"At", rCov:1.6,  rVdW:2,    maxBonds:1,  color:"#754F45", bondStrength:0.1,  mass:210},
{symbol:"Rn", rCov:1.45, rVdW:2,    maxBonds:0,  color:"#428296", bondStrength:0.05, mass:222},
{symbol:"Fr", rCov:1.6,  rVdW:2,    maxBonds:1,  color:"#420066", bondStrength:0.05, mass:223},
{symbol:"Ra", rCov:1.6,  rVdW:2,    maxBonds:2,  color:"#007D00", bondStrength:0.1,  mass:226},
{symbol:"Ac", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#70ABFA", bondStrength:0.2,  mass:227},
{symbol:"Th", rCov:1.6,  rVdW:2.4,  maxBonds:6,  color:"#00BAFF", bondStrength:0.3,  mass:232.0381},
{symbol:"Pa", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#00A1FF", bondStrength:0.3,  mass:231.03588},
{symbol:"U",  rCov:1.6,  rVdW:2.3,  maxBonds:6,  color:"#008FFF", bondStrength:0.3,  mass:238.02891},
{symbol:"Np", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#0080FF", bondStrength:0.3,  mass:237.05},
{symbol:"Pu", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#006BFF", bondStrength:0.3,  mass:244.06},
{symbol:"Am", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#545CF2", bondStrength:0.3,  mass:243.06},
{symbol:"Cm", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#785CE3", bondStrength:0.3,  mass:247.07},
{symbol:"Bk", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#8A4FE3", bondStrength:0.3,  mass:247.07},
{symbol:"Cf", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#A136D4", bondStrength:0.3,  mass:251.08},
{symbol:"Es", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#B31FD4", bondStrength:0.3,  mass:252.08},
{symbol:"Fm", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#B31FBA", bondStrength:0.3,  mass:257.1},
{symbol:"Md", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#B30DA6", bondStrength:0.3,  mass:258.1},
{symbol:"No", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#BD0D87", bondStrength:0.3,  mass:259.1},
{symbol:"Lr", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#C70066", bondStrength:0.3,  mass:262.11},
{symbol:"Rf", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#CC0059", bondStrength:0.3,  mass:265.12},
{symbol:"Db", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#D1004F", bondStrength:0.1,  mass:268.13},
{symbol:"Sg", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#D90045", bondStrength:0.1,  mass:271.13},
{symbol:"Bh", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#E00038", bondStrength:0.1,  mass:270},
{symbol:"Hs", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#E6002E", bondStrength:0.1,  mass:277.15},
{symbol:"Mt", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#EB0026", bondStrength:0.1,  mass:276.15},
{symbol:"Ds", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#ED0024", bondStrength:0.1,  mass:281.16},
{symbol:"Rg", rCov:1.6,  rVdW:2,    maxBonds:6,  color:"#F00021", bondStrength:0.1,  mass:280.16}
];


class AtomData {

    private static instance: AtomData;
	private readonly data;
	private readonly symbol2atomZ = new Map<string, number>();

	/**
	 * Build the class by loading the atomic data
	 */
	private constructor() {

		this.data = atomData;

		const len = this.data.length;
		for(let i=1; i < len; ++i) {
			const {symbol} = this.data[i];
			this.symbol2atomZ.set(symbol, i);
			this.symbol2atomZ.set(symbol.toLowerCase(), i);
			this.symbol2atomZ.set(symbol.toUpperCase(), i);
		}

		// Add Deuterium
		this.symbol2atomZ.set("D", 1);
		this.symbol2atomZ.set("d", 1);
	}

	/**
	 * Convert atomic symbol to atom Z
	 *
	 * @param symbol - Atomic symbol as read from the structure file
	 * @returns The atom Z value or zero if it is an invalid symbol
	 */
	atomicNumber(symbol: string): number {
		return this.symbol2atomZ.get(symbol) ?? 0;
	}

	/**
	 * Convert the atom Z value into atom symbol
	 *
	 * @param atomZ - Atom Z value
	 * @returns The corresponding atomic symbol
	 */
	atomicSymbol(atomZ: number): string {
		return this.data[atomZ].symbol;
	}

	/**
	 * Return other information on the atom with given Z value
	 *
	 * @param atomZ - Z value of the atom that should be retrieved
	 * @returns Structure containing various atom data
	 */
	atomicData(atomZ: number): AtomInfo {

		const {symbol, rCov, rVdW, maxBonds, color, bondStrength, mass} = this.data[atomZ];

		return {
			symbol,
			rCov,
			rVdW,
			color,
			maxBonds,
			bondStrength,
			mass
		};
	}

	/**
	 * Return the atomic number given the atomic mass
	 *
	 * @param mass - Atomic mass
	 * @returns Corresponding Z value
	 */
	atomicNumberByMass(mass: number): number {

		let tentativeZ = 1;
		let delta = Number.POSITIVE_INFINITY;
		for(let z=1; z < this.data.length; ++z) {
			const d = Math.abs(this.data[z].mass - mass);
			if(d === 0) return z;
			if(d < delta) {
				tentativeZ = z;
				delta = d;
			}
		}
		return tentativeZ;
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The Atom Data object
	 */
    static getInstance(): AtomData {

        if(!AtomData.instance) {
            AtomData.instance = new AtomData();
        }

        return AtomData.instance;
    }
}

/**
 * Convert atomic symbol to atom Z
 *
 * @param symbol - Atomic symbol as read from the structure file
 * @returns The atom Z value or zero if it is an invalid symbol
 */
export const getAtomicNumber = (symbol: string): number => AtomData.getInstance().atomicNumber(symbol);

/**
 * Convert the atom Z value into atomic symbol
 *
 * @param atomZ - Atom Z value
 * @returns The corresponding atomic symbol
 */
export const getAtomicSymbol = (atomZ: number): string => AtomData.getInstance().atomicSymbol(atomZ);

/**
 * Return information on the atom with given Z value
 *
 * @param atomZ - Z value of the atom that should be retrieved
 * @returns Structure containing the atom data
 */
export const getAtomData = (atomZ: number): AtomInfo => AtomData.getInstance().atomicData(atomZ);

/**
 * Return the atomic number given the atomic mass
 *
 * @param mass - Atomic mass
 * @returns Corresponding Z value
 */
export const getAtomicNumberByMass = (mass: number): number => AtomData.getInstance().atomicNumberByMass(mass);
