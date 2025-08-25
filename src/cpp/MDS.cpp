
#include "MDS.h"
#include <iostream>
// https://eigen.tuxfamily.org/
#define EIGEN_NO_DEBUG
#include <Eigen/Dense>

// Entry point
void doMDS(
	std::vector<double_t> distances,	// Distances vector
	int count,							// Side of the distance matrix
	std::vector<uint8_t> enable,		// Mark which of the points is enabled
	int dimensions,						// Dimension of the output space
	std::vector<double_t>& points		// Projected points
)
{
	// 1. Count the number of enabled points
	// 2. Map indices to the enabled ones
	int enabledSide = count;
	size_t enabledIndex = 0;
	std::vector<size_t> mapIndex(count);
	for(size_t i = 0; i < count; i++) {
		if(enable[i] == 0) --enabledSide;
		else mapIndex[i] = enabledIndex++;
	}

	// 3. Create the matrix of distances squared
	std::vector<std::vector<float_t> > D2(enabledSide);
	for(size_t i=0; i < enabledSide; ++i) {
		std::vector<float_t> rowVector(enabledSide, 0.F);
		D2[i] = rowVector;
	}

	for(size_t row=0; row < count-1; ++row) {

		if(enable[row] == 0) continue;

		for(size_t col=row+1; col < count; ++col) {

			if(enable[col] == 0) continue;

			// Formula for upper triangular matrix
			// size_t idx = count*row-row*(row+1)/2+col-row-1;
			size_t idx = row*(count-(row+1)/2-1)+col-1;

			size_t erow = mapIndex[row];
			size_t ecol = mapIndex[col];

			float v = distances[idx];
			D2[erow][ecol] = D2[ecol][erow] = v*v;
		}
	}

	// 4. Compute row and total averages
    std::vector<float_t> rowMeans(enabledSide);
	float totalMean = 0.F;
	for(size_t row=0; row < enabledSide; ++row) {

		float mean = 0.F;
		for(const auto x: D2[row]) mean += x;
		mean /= enabledSide;
		rowMeans[row] = mean;
		totalMean += mean;
	}
	totalMean /= enabledSide;

    // 5. Compute double centering matrix
	Eigen::MatrixXf doubleCenteringMatrix(enabledSide, enabledSide);
    for(size_t i = 0; i < enabledSide; i++) {
        for(size_t j = 0; j < enabledSide; j++) {
            doubleCenteringMatrix(i, j) = -0.5F * (D2[i][j] - rowMeans[i] - rowMeans[j] + totalMean);
        }
    }
std::cout << doubleCenteringMatrix << std::endl;
	// TEST
	points.resize(4);
	points[0] = 1.1;
	points[1] = 2.2;
	points[2] = 3.3;
	points[3] = 4.4;
}
