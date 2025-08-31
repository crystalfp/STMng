#include <cmath>
#include <cstdint>
#include <vector>

extern void doMDS(
	std::vector<double_t> distances,	// Distances vector
	int count,							// Side of the distance matrix
	std::vector<uint8_t> enable,		// Mark which of the `count` points is enabled
	std::vector<double_t>& points2D,	// Projected points in 2D
	std::vector<double_t>& points3D		// Projected points in 3D
);
