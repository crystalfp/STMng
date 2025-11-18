
#include "MDS.h"
#include <cfloat>
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
	std::vector<double_t>& points2D,	// Projected points in 2D
	std::vector<double_t>& points3D		// Projected points in 3D
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
	points2D.resize(enabledSide*2);
	points3D.resize(enabledSide*3);
	std::vector<double_t> min2D(2,  DBL_MAX);
	std::vector<double_t> max2D(2, -DBL_MAX);
	std::vector<double_t> min3D(3,  DBL_MAX);
	std::vector<double_t> max3D(3, -DBL_MAX);

    for(size_t i = 0; i < enabledSide; ++i) {

		// Unroll the loop on dimensions
		size_t i2 = i*2;
		size_t i3 = i*3;
		size_t idx = 0;
		double eigenvalue = eigenvalues(idx);
		double value = eigenvectors(i, idx) * sqrt(fabs(eigenvalue));
		if(value < min2D[0]) min2D[0] = value;
		if(value > max2D[0]) max2D[0] = value;
		if(value < min3D[0]) min3D[0] = value;
		if(value > max3D[0]) max3D[0] = value;
		points2D[i2] = value;
		points3D[i3] = value;

		idx = 1;
		eigenvalue = eigenvalues(idx);
		value = eigenvectors(i, idx) * sqrt(fabs(eigenvalue));
		if(value < min2D[1]) min2D[1] = value;
		if(value > max2D[1]) max2D[1] = value;
		if(value < min3D[1]) min3D[1] = value;
		if(value > max3D[1]) max3D[1] = value;
		points2D[i2+1] = value;
		points3D[i3+1] = value;

		idx = 2;
		eigenvalue = eigenvalues(idx);
		value = eigenvectors(i, idx) * sqrt(fabs(eigenvalue));
		if(value < min3D[2]) min3D[2] = value;
		if(value > max3D[2]) max3D[2] = value;
		points3D[i3+2] = value;
    }

	// 7. Normalize coordinates values
	// Unroll loops on dimensions
	std::vector<double_t> den2D(2);
	den2D[0] = max2D[0] - min2D[0];
	den2D[1] = max2D[1] - min2D[1];

	std::vector<double_t> den3D(3);
	den3D[0] = max3D[0] - min3D[0];
	den3D[1] = max3D[1] - min3D[1];
	den3D[2] = max3D[2] - min3D[2];

    for(size_t i = 0; i < enabledSide; ++i) {

		size_t i2 = i*2;
		points2D[i2]   = (points2D[i2]   - min2D[0]) / den2D[0];
		points2D[i2+1] = (points2D[i2+1] - min2D[1]) / den2D[1];

		size_t i3 = i*3;
		points3D[i3]   = (points3D[i3]   - min3D[0]) / den3D[0];
		points3D[i3+1] = (points3D[i3+1] - min3D[1]) / den3D[1];
		points3D[i3+2] = (points3D[i3+2] - min3D[2]) / den3D[2];
	}
}
