#include <string>
#include <vector>
#include <math.h>

extern std::string doFindAndApplySymmetries(
	std::vector<double_t>& basis,					// Basis vectors (in/out)
	std::string& spaceGroup,						// Space group or empty string if none (in/out)
	std::vector<int32_t>& atomsZ,					// Atomic numbers (in/out)
	std::vector<double_t>& fractionalCoordinates,	// Fractional coordinates (in/out)
	bool applyInputSymmetries,						// Apply symmetries from input structure
	bool enableFindSymmetries,						// Enable find symmetries and standardize cell
	bool standardizeCell,							// Enable standardize cell
	bool standardizeOnly,							// Don't compute symmetry after standardization
	bool createPrimitiveCell,						// Create primitive cell not conventional cell
	double symprecStandardize,						// Tolerance for the standardize cell step
	double symprecDataset,							// Tolerance for find symmetries
	bool& unitCellModified,							// True if the cell has been modified (out)
	std::string& intlSymbol,						// Computed international symmetry symbol
	std::string& intlSymbolIn,						// Input international symmetry symbol
	int& sgNumberIn,								// The input space group type number
	int& sgNumberOut								// The final space group type number
													// defined in International Tables for
													// Crystallography
);													// Returns error message or empty string
