
	private autoFormat(filename: string): string {

		filename = filename.toLowerCase().replaceAll("\\", "/");
		const pos = filename.lastIndexOf("/");
		filename = filename.slice(pos+1);

		if(filename.endsWith(".cel")) return "CEL";
		if(filename.endsWith(".chgcar") ||
		   filename.startsWith("chg")) return "CHGCAR";
		if(filename.endsWith(".cif")) return "CIF";
		if(filename.endsWith(".cube")) return "Gaussian Cube";
		if(filename.endsWith(".lammps") ||
		   filename.endsWith(".lmp")) return "LAMMPS";
		if(filename.endsWith(".lammpstrj")) return "LAMMPStrj";
		if(filename.endsWith(".pdb")) return "PDB";
		if(filename.endsWith(".poscar") ||
		   filename.endsWith(".poscars") ||
		   filename.endsWith(".contcar") ||
		   filename.endsWith(".vasp")) return "POSCAR";
		if(filename.endsWith(".in")) return "Quantum ESPRESSO";
		if(filename.endsWith(".xdatcar") ||
		   filename.endsWith(".xdatcar5")) return "XDATCAR5";
		if(filename.endsWith(".xyz")) return "XYZ";
		if(filename.endsWith(".res") ||
		   filename.endsWith(".ins")) return "Shel-X";

		return "Not recognized under AutoFormat";
	}

		// TEST Extract format from the filename
		const auto = this.autoFormat(filename);
		console.log("AUTO:", auto);
