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

    def generate_from_prototype(self, prototype_label, species):
        """
        Generate structure(s) from a known AFLOW prototype.
        Args:
            prototype_label (str): AFLOW prototype label (e.g. "AB_cF8_216_a_b").
            species (list[str]): List of species to substitute.
        Returns:
            list of Structure objects.
        """
        return self.matcher.get_structure(prototype_label, species)


if __name__ == "__main__":
    # Example usage:
    structure = Structure.from_file("test-data/POSCAR/after.poscar")

    analyzer = StructureAnalyzer(structure)

    # 1. Match to prototype
    match_info = analyzer.match_to_prototype()
    print("Matched Prototype(s):", match_info or "No match found")

    # 2. Symmetry info
    sym_info = analyzer.symmetry_info()
    print("Symmetry Information:", sym_info)

    # 3. Degrees of freedom
    dof_info = analyzer.degrees_of_freedom(mode="total")
    print("Degrees of Freedom:", dof_info)

    # 4. Generate from prototype
    generated_structures = analyzer.generate_from_prototype("AB_cF8_216_a_b", ["Ga", "As"])
    print(f"Generated {len(generated_structures)} structures from prototype 'AB_cF8_216_a_b'")
