from pymatgen.core.structure import Structure
# from pymatgen.analysis.prototypes import StructureAnalyzer

# Load structure from file (e.g., POSCAR or CIF)
structure = Structure.from_file("POSCAR")

# Initialize the analyzer
analyzer = StructureAnalyzer(structure)

# 1. Match the structure to a prototype
match_info = analyzer.match_to_prototype()
print("Matched Prototype:", match_info or "No match found")

# 2. Get symmetry information
sym_info = analyzer.symmetry_info()
print("Symmetry Information:", sym_info)

# 3. Get degrees of freedom
dof_info = analyzer.degrees_of_freedom()
print("Degrees of Freedom:", dof_info)

# 4. Generate structures from a known prototype
generated_structures = analyzer.generate_from_prototype("AB_cF8_216_a_b", ["Ga", "As"])
print(f"Generated {len(generated_structures)} structures from prototype 'AB_cF8_216_a_b'")
