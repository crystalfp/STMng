
#include "MDS.h"
// Eigen: a C++ template library for linear algebra https://eigen.tuxfamily.org/
#define EIGEN_NO_DEBUG
#include <Eigen/Dense>
#include <Eigen/Eigenvalues>

// Entry point
void doMDS(
	std::vector<double_t> distances,	// Distances vector
	int count,							// Side of the distance matrix
	std::vector<uint8_t> enable,		// Mark enabled points
	int dimensions,						// Dimension of the output space
	std::vector<double_t>& points		// Projected points
)
{
	// 1. Count the number of enabled points and map indices to the enabled ones
	size_t enabledSide = count;
	size_t enabledIndex = 0;
	std::vector<size_t> mapIndex(count);
	for(size_t i = 0; i < count; i++) {
		if(enable[i] == 0) --enabledSide;
		else mapIndex[i] = enabledIndex++;
	}

	// 2. Create the matrix of distances squared
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
			// The 2nd member should stay as-is otherwise it truncates
			size_t idx = count*row-(row*(row+1))/2+col-row-1;

			// Map indices to the ones with disabled points removed
			size_t erow = mapIndex[row];
			size_t ecol = mapIndex[col];

			float v = distances[idx];
			D2[erow][ecol] = D2[ecol][erow] = v*v;
		}
	}

	// 3. Compute row and total averages
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

    // 4. Compute double centering matrix
	Eigen::MatrixXf doubleCenteringMatrix(enabledSide, enabledSide);
    for(size_t i = 0; i < enabledSide; i++) {
        for(size_t j = 0; j < enabledSide; j++) {
            doubleCenteringMatrix(i, j) = -0.5F * (D2[i][j] - rowMeans[i] - rowMeans[j] + totalMean);
        }
    }

	// 5. Do the eigendecomposition
	Eigen::EigenSolver<Eigen::MatrixXf> es(doubleCenteringMatrix);

	Eigen::VectorXf eigenvalues = es.eigenvalues().real();
	Eigen::MatrixXf eigenvectors = es.eigenvectors().real();

    // 6. Compute the final coordinates and range for normalization
	points.resize(enabledSide*dimensions);
	std::vector<double_t> min(dimensions, 1e200);
	std::vector<double_t> max(dimensions, -1e200);
	size_t last = enabledSide-1;
    for(size_t i = 0; i < enabledSide; ++i) {
        for(size_t j = 0; j < dimensions; ++j) {

			size_t idx = last-j;
            double eigenvalue = eigenvalues(idx);
			double value = eigenvectors(i, idx) * sqrt(fabs(eigenvalue));
			if(value < min[j]) min[j] = value;
			if(value > max[j]) max[j] = value;
			points[i*dimensions+j] = value;
        }
    }

	// 7. Normalize coordinates values
	std::vector<double_t> den(dimensions);
    for(size_t j = 0; j < dimensions; ++j) den[j] = max[j]-min[j];
    for(size_t i = 0; i < enabledSide; ++i) {
        for(size_t j = 0; j < dimensions; ++j) {

			points[i*dimensions+j] = (points[i*dimensions+j] - min[j])/den[j];
		}
	}
}
