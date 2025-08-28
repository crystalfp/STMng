
#include "MDS.h"
#include <climits>
// Eigen: a C++ template library for linear algebra https://eigen.tuxfamily.org/
#define EIGEN_NO_DEBUG
#define EIGEN_VECTORIZE
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
	Eigen::MatrixXf D2(enabledSide, enabledSide);

	for(size_t row=0; row < count-1; ++row) {

		if(enable[row] == 0) continue;

		size_t erow = mapIndex[row];

		for(size_t col=row+1; col < count; ++col) {

			if(enable[col] == 0) continue;

			// Formula for upper triangular matrix
			// The 2nd member should stay as-is otherwise it truncates
			size_t idx = count*row-(row*(row+1))/2+col-row-1;

			// Map indices to the ones with disabled points removed
			size_t ecol = mapIndex[col];

			float v = distances[idx];
			D2(erow, ecol) = D2(ecol, erow) = v*v;
		}
		D2(erow, erow) = 0.F;
	}

	// 3. Compute row and total averages
	float scale = 1.0F/enabledSide;
	Eigen::VectorXf rowMeans = D2.rowwise().sum() * scale;
	float totalMean = rowMeans.sum() * scale;

    // 4. Compute double centering matrix
	Eigen::MatrixXf doubleCenteringMatrix(enabledSide, enabledSide);
    for(size_t i = 0; i < enabledSide; i++) {
        for(size_t j = 0; j < enabledSide; j++) {
            doubleCenteringMatrix(i, j) = -0.5F * (D2(i, j) - rowMeans(i) - rowMeans(j) + totalMean);
        }
    }

	// 5. Do the eigendecomposition
	Eigen::EigenSolver<Eigen::MatrixXf> es(doubleCenteringMatrix);

	Eigen::VectorXf eigenvalues = es.eigenvalues().real();
	Eigen::MatrixXf eigenvectors = es.eigenvectors().real();

    // 6. Compute the final coordinates and range for normalization
	points.resize(enabledSide*dimensions);
	std::vector<double_t> min(dimensions, DBL_MAX);
	std::vector<double_t> max(dimensions, -DBL_MAX);
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
