
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
	std::vector<double_t>& points2D,	// Projected points in 2D
	std::vector<double_t>& points3D		// Projected points in 3D
)
{
	// 1. Create the matrix of distances squared
	Eigen::MatrixXf D2(count, count);

	for(size_t row=0; row < count-1; ++row) {

		for(size_t col=row+1; col < count; ++col) {

			// Formula for upper triangular matrix
			// The 2nd member should stay as-is otherwise it truncates
			size_t idx = count*row-(row*(row+1))/2+col-row-1;

			float v = distances[idx];
			D2(row, col) = D2(col, row) = v*v;
		}
		D2(row, row) = 0.F;
	}

	// 2. Compute row and total averages
	float scale = 1.0F/count;
	Eigen::VectorXf rowMeans = D2.rowwise().sum() * scale;
	float totalMean = rowMeans.sum() * scale;

    // 3. Compute double centering matrix
	Eigen::MatrixXf doubleCenteringMatrix(count, count);
    for(size_t i = 0; i < count; i++) {
        for(size_t j = 0; j < count; j++) {
            doubleCenteringMatrix(i, j) = -0.5F * (D2(i, j) - rowMeans(i) - rowMeans(j) + totalMean);
        }
    }

	// 4. Do the eigendecomposition
	Eigen::EigenSolver<Eigen::MatrixXf> es(doubleCenteringMatrix);

	Eigen::VectorXf eigenvalues = es.eigenvalues().real();
	Eigen::MatrixXf eigenvectors = es.eigenvectors().real();

    // 5. Compute the final coordinates and range for normalization
	points2D.resize(count*2);
	points3D.resize(count*3);
	std::vector<double_t> min2D(2,  DBL_MAX);
	std::vector<double_t> max2D(2, -DBL_MAX);
	std::vector<double_t> min3D(3,  DBL_MAX);
	std::vector<double_t> max3D(3, -DBL_MAX);

    for(size_t i = 0; i < count; ++i) {

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

	// 6. Normalize coordinates values
	// Unroll loops on dimensions
	std::vector<double_t> den2D(2);
	den2D[0] = max2D[0] - min2D[0];
	den2D[1] = max2D[1] - min2D[1];

	std::vector<double_t> den3D(3);
	den3D[0] = max3D[0] - min3D[0];
	den3D[1] = max3D[1] - min3D[1];
	den3D[2] = max3D[2] - min3D[2];

    for(size_t i = 0; i < count; ++i) {

		size_t i2 = i*2;
		points2D[i2]   = (points2D[i2]   - min2D[0]) / den2D[0];
		points2D[i2+1] = (points2D[i2+1] - min2D[1]) / den2D[1];

		size_t i3 = i*3;
		points3D[i3]   = (points3D[i3]   - min3D[0]) / den3D[0];
		points3D[i3+1] = (points3D[i3+1] - min3D[1]) / den3D[1];
		points3D[i3+2] = (points3D[i3+2] - min3D[2]) / den3D[2];
	}
}
