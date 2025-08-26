#include <cmath>
#include <cstdint>
#include <vector>

extern void doMDS(
	std::vector<double_t> distances,	// Distances vector
	int count,							// Side of the distance matrix
	std::vector<uint8_t> enable,		// Mark which of the `count` points is enabled
	int dimensions,						// Dimension of the output space
	std::vector<double_t>& points		// Projected points
);
