from pymatgen.core import Structure, Lattice
from pymatgen.analysis.diffraction.xrd import XRDCalculator

lattice = Lattice.from_parameters(a=4.916, b=4.916, c=5.4054,
								  alpha=90, beta=90, gamma=120)
cartesian = [[0.000000,   0.000000,   0.000000], [1.376726,   1.136295,   0.643783]]
struct = Structure(lattice, ["Si", "Si"], cartesian, coords_are_cartesian=True)
# coords = [[0, 0, 0], [0.75,0.5,0.75]]
# struct = Structure(lattice, ["Si", "Si"], coords)

xrd = XRDCalculator()
pattern = xrd.get_pattern(struct)
print(pattern)
