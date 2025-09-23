from pymatgen.core.structure import Structure
from pymatgen.analysis.prototypes import AflowPrototypeMatcher
from pymatgen.symmetry.analyzer import SpacegroupAnalyzer

class StructureAnalyzer:
    def __init__(self, structure, symprec=1e-3):
        """
        Initialize analyzer.

        Args:
            structure (Structure): pymatgen Structure object.
            symprec (float): Symmetry tolerance.
        """
        self.structure = structure
        self.matcher = AflowPrototypeMatcher()
        self.symprec = symprec

    def match_to_prototype(self):
        """
        Match the structure to AFLOW prototypes.
        Returns:
            list of dicts with prototype info, or empty list.
        """
        return self.matcher.get_prototypes(self.structure)

    def symmetry_info(self):
        """
        Get symmetry information using SpacegroupAnalyzer.
        Returns:
            dict with space group info.
        """
        sga = SpacegroupAnalyzer(self.structure, symprec=self.symprec)
        return {
            "spacegroup_symbol": sga.get_space_group_symbol(),
            "spacegroup_number": sga.get_space_group_number(),
            "hall_symbol": sga.get_hall(),
            "crystal_system": sga.get_crystal_system(),
            "point_group": sga.get_point_group_symbol()
        }

    def degrees_of_freedom(self, mode="cartesian"):
        """
        Estimate degrees of freedom.
        Args:
            mode (str): 'cartesian' = 3N atoms, 'lattice' = 6 independent params,
                        'total' = lattice + cartesian
        Returns:
            dict with DoF.
        """
        n_atoms = len(self.structure)
        dof = {}
        if mode in ("cartesian", "total"):
            dof["cartesian_dof"] = 3 * n_atoms
        if mode in ("lattice", "total"):
            dof["lattice_dof"] = 6  # a,b,c, α,β,γ (assuming no symmetry constraints)
        return dof

    def generate_prototype(self, prototype_name, species, **lattice_kwargs):
        """
        Generate a structure from a named prototype.
        Args:
            prototype_name (str): e.g. 'zincblende', 'rocksalt'.
            species (list of str): species corresponding to distinct sites.
            lattice_kwargs: lattice parameters (e.g. a=5.65).
        Returns:
            Structure
        """
        return Structure.from_prototype(prototype_name, species, **lattice_kwargs)

if __name__ == "__main__":
    # Load a structure from file (e.g., POSCAR, CIF)
    # structure = Structure.from_file("GaAs.vasp")
    # structure = Structure.from_file("../test-data/quartz.poscar")
    structure = Structure.from_file("D:/ChemData/formats/cif/nacl.cif")

    matcher = AflowPrototypeMatcher()
    match_info = matcher.get_prototypes(structure)

    if match_info:
        print("Number of prototypes:", len(match_info))
        # print(match_info[0]['snl'])
        # print(match_info[0]['tags'])
    else:
        print("No prototype match found.")
