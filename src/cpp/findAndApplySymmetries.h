#include <string>
#include <vector>
#include <math.h>

extern std::string doFindAndApplySymmetries(
	std::vector<double_t>& basis,					// Basis vectors (in/out)
	std::string& spaceGroup,						// Space group or empty string if none (in/out)
	std::vector<int32_t>& atomsZ,					// Atomic numbers (in/out)
	std::vector<double_t>& fractionalCoordinates,	// Fractional coordinates (in/out)
	bool applyInputSymmetries,
	bool enableFindSymmetries,
	bool standardizeCell,
	bool standardizeOnly,
	double symprecStandardize,
	double symprecDataset,
	bool& unitCellModified
);													// Returns error message or empty string
