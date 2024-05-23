// #define DEBUG

#ifdef DEBUG
#include <iostream>
#endif
#include <stdlib.h>
#include <string>
#include <vector>
#include <cstring>
#include <math.h>
#include "FindAndApplySymmetries.h"
#include "spglib.h"

#define SGCOREDEF__
extern "C" {
#include "./sginfo/sginfo.h"
}
using namespace std;

#define DUPLICATED_TOL 1e-3
#define FOLD_TOL 1e-5

// Fold fractional coordinate to the unit cube
// Was:
// if(fc >= 1.0) fc -= 1.0;
// else if(fc < 0.0) fc += 1.0;
//
static double foldIntoUnitCell(double fc)
{
	if(fc > 1.0) return fc - (long)fc;
	if(fc < FOLD_TOL && fc > -FOLD_TOL) return 0.0;

	if(fc < 0.0) return 1 - (long)fc + fc;
	if(fc < (1+FOLD_TOL) && fc > (1-FOLD_TOL)) return 1.0;

	return fc;
}

// Replicate the atoms using the symmetries found
static void ApplyComputedSymmetries(vector<double_t>& fc,
									vector<int32_t>& atomsZ,
									T_SgInfo& SgInfo)
{
	int nLoopInv   = Sg_nLoopInv(&SgInfo);
	int nTrV       = SgInfo.LatticeInfo->nTrVector;
	const int *TrV = SgInfo.LatticeInfo->TrVector;

	// Compute the resulting number of atoms and prepare the list of coordinates and indices
	vector<double_t> fcOut;
	vector<int32_t> typesOut;

	// To remove duplicates
	bool different = true;

	// Compute all symmetries (see http://www.kristall.ethz.ch/LFK/software/sginfo/sginfo_loop_symops.html)
	for(int iTrV = 0; iTrV < nTrV; iTrV++, TrV += 3)
	{
		for(int iLoopInv = 0; iLoopInv < nLoopInv; iLoopInv++)
		{
			int f = (iLoopInv == 0) ? 1 : -1;

			const T_RTMx *lsmx = SgInfo.ListSeitzMx;

			for(int iList = 0; iList < SgInfo.nList; iList++, lsmx++)
			{
				T_RTMx SMx;

				for(int i = 0; i < 9; i++) SMx.s.R[i] = f * lsmx->s.R[i];
				for(int i = 0; i < 3; i++) SMx.s.T[i] = iModPositive(f * lsmx->s.T[i] + TrV[i], STBF);

				double T[3];
				T[0] = (double)SMx.s.T[0] / (double)STBF;
				T[1] = (double)SMx.s.T[1] / (double)STBF;
				T[2] = (double)SMx.s.T[2] / (double)STBF;
				int *R = SMx.s.R;

#ifdef DEBUG
    			printf("Applying matrix with translation (%f, %f, %f)\n", T[0], T[1], T[2]);
    			printf("[%2d %2d %2d;\n %2d %2d %2d;\n %2d %2d %2d]\n",
					   R[0], R[1], R[2],
					   R[3], R[4], R[5],
					   R[6], R[7], R[8]
				);
				fflush(stdout);
#endif
				// Use SMx at this point
				int natoms = fc.size() / 3;
				for(int i=0; i < natoms; ++i)
				{
					double Bfr[3];

					for(int j=0; j < 3; ++j)
					{
						Bfr[j] = fc[i*3+0]*R[3*j+0] +
								 fc[i*3+1]*R[3*j+1] +
								 fc[i*3+2]*R[3*j+2] +
								 T[j];

						// Fold everything back to the unit cell
						Bfr[j] = foldIntoUnitCell(Bfr[j]);
					}

#ifdef DEBUG
printf("+ atom %d [%f, %f, %f] -> [%f, %f, %f]\n", i, fc[i*3+0], fc[i*3+1], fc[i*3+2], Bfr[0], Bfr[1], Bfr[2]);
#endif
					// Check it isn't already there
					for(int k=0; k < typesOut.size(); ++k)
					{
						double dx = fcOut[3*k+0]-Bfr[0];
						if(dx > DUPLICATED_TOL || dx < -DUPLICATED_TOL) {
							different = true;
							continue;
						}
						double dy = fcOut[3*k+1]-Bfr[1];
						if(dy > DUPLICATED_TOL || dy < -DUPLICATED_TOL) {
							different = true;
							continue;
						}
						double dz = fcOut[3*k+2]-Bfr[2];
						if(dz > DUPLICATED_TOL || dz < -DUPLICATED_TOL) {
							different = true;
							continue;
						}
						different = false;
						break;
					}

					if(different)
					{
						// Save the fractional coordinates
						fcOut.push_back(Bfr[0]);
						fcOut.push_back(Bfr[1]);
						fcOut.push_back(Bfr[2]);

						// Save the atom type
						typesOut.push_back(atomsZ[i]);

						different = false;
					}
				}
			}
		}
	}

	// Output the results
	fc = fcOut;
	atomsZ = typesOut;
}

static void applySymmetriesInput(string& spaceGroup,
								 vector<double_t>& fractionalCoordinates,
								 vector<int32_t>& atomsZ,
								 string& error)
{
	// Initialize the error message to no message
	error = "";

	// Now compute the list of Seitz matrices
	T_SgInfo SgInfo;

	// Allocate memory for the list of Seitz matrices and
	// a supporting list which holds the characteristics of
	// the rotation parts of the Seitz matrices
	SgInfo.MaxList = 192; // absolute maximum number of symops
	SgInfo.ListSeitzMx = (T_RTMx *)malloc(SgInfo.MaxList * sizeof(*SgInfo.ListSeitzMx));
	if(SgInfo.ListSeitzMx == NULL)
	{
		error = "Not enough memory for ListSeitzMx";
		return;
	}

	SgInfo.ListRotMxInfo = (T_RotMxInfo *)malloc(SgInfo.MaxList * sizeof(*SgInfo.ListRotMxInfo));
	if(SgInfo.ListRotMxInfo == NULL)
	{
		error = "Not enough memory for ListRotMxInfo";

		free(SgInfo.ListSeitzMx);
		return;
	}

	// Initialize the SgInfo structure
	InitSgInfo(&SgInfo);

	// Access the SG library
	const T_TabSgName *tsgn;
    tsgn = FindTabSgNameEntry(spaceGroup.c_str(), 'A');
    if(tsgn != NULL)
	{
		// Fill with the SG table name
		SgInfo.TabSgName = tsgn;

		// Translate the Hall symbol and generate the whole group
		ParseHallSymbol(tsgn->HallSymbol, &SgInfo);
		if(SgError != NULL)
		{
			error = SgError;
			error += " (from ParseHallSymbol)";

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return;
		}

		// Do some book-keeping and derive crystal system, point group,
		// and - if not already set - find the entry in the internal
		// table of space group symbols
		if(CompleteSgInfo(&SgInfo) != 0)
		{
			error = SgError;
			error += " (from CompleteSgInfo)";

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return;
		}
	}
	else
	{
		// Prepare parsing of the multiline Seitz matrix in XYZ form
		int len = spaceGroup.size();
		char *SymXYZ = (char *)malloc(len+1);
		strcpy(SymXYZ, spaceGroup.c_str());
		char *SymXYZstart = SymXYZ;
		int n = 0;
		bool success = false;
        T_RTMx SMx;

		// Try to extract the LATT indicator from Shel-X
		int lattice_indicator;
		if(SymXYZ[0] == '(')
		{
			int i;
			for(i=1; i < 4; ++i)
			{
				if(SymXYZ[i] == ')') {SymXYZ[i] = '\0'; break;}
			}

			lattice_indicator = atoi(SymXYZ+1);
			if(lattice_indicator == 0)
			{
				lattice_indicator = SymXYZ[1];
			}

			SymXYZ += (i+1);
		}
		else
		{
			lattice_indicator = 0;
		}

		// Parse the multiline Seitz matrix
		for(char *p=SymXYZ; *p; ++p)
		{
			if(*p == '\n')
			{
				// Select one line from the symbol
				*p ='\0';

				// try to parse it as an XYZ symbol
				if(ParseSymXYZ(SymXYZ, &SMx, STBF) == 0)
				{
					if(Add2ListSeitzMx(&SgInfo, &SMx) < 0)
					{
						success = false;
						break;
					}
					else
					{
						success = true;
						++n;
					}
				}
				else
				{
					success = false;
					break;
				}

				// Move to the next symbol
				SymXYZ = p+1;
			}
		}

		// Try to parse the last line as an XYZ symbol
		if(ParseSymXYZ(SymXYZ, &SMx, STBF) == 0)
		{
			if(Add2ListSeitzMx(&SgInfo, &SMx) < 0)
			{
				success = false;
			}
			else
			{
				success = true;
				++n;
			}
		}

		// Release the temporary copy of the symbols
		free(SymXYZstart);

		// Successfully parsed
		if(success)
		{
#ifdef DEBUG
			char msg[32];
			sprintf(msg, "Parsed %d XYZ symbol%s\n", n, (n > 1) ? "s" : "");
			std::cout << msg;
#endif
			if(lattice_indicator != 0)
			{
#ifdef DEBUG
				printf("Lattice indicator: %d\n", lattice_indicator);
#endif
				// Lattice type: 1=P, 2=I, 3=rhombohedral obverse on hexagonal axes, 4=F, 5=A, 6=B, 7=C. N
				// must be made negative if the structure is non-centrosymmetric.

				if(lattice_indicator < 0)
				{
					// mark non-centrosymmetric
					if(AddInversion2ListSeitzMx(&SgInfo) != 0)
					{
						error = SgError;
						error += " (from AddInversion2ListSeitzMx)";

						free(SgInfo.ListSeitzMx);
						free(SgInfo.ListRotMxInfo);
						return;
					}

					lattice_indicator = -lattice_indicator;
				}

				switch(lattice_indicator)
				{
				case 1:
				case 'P':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_P);
					break;
				case 2:
				case 'I':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_I);
					break;
				case 3:
				case 'R':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_R); //??
					break;
				case 4:
				case 'F':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_F);
					break;
				case 5:
				case 'A':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_A);
					break;
				case 6:
				case 'B':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_B);
					break;
				case 7:
				case 'C':
					AddLatticeTr2ListSeitzMx(&SgInfo, LI_C);
					break;
				}
			}

			if(CompleteSgInfo(&SgInfo) != 0)
			{
				error = SgError;
				error += " (from CompleteSgInfo)";

				free(SgInfo.ListSeitzMx);
				free(SgInfo.ListRotMxInfo);
				return;
			}
		}
		else
		{
			// No matching table entry
			error = "Invalid space group symbol: ";
			error += spaceGroup;

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return;
		}
	}

	// Apply symmetries
	ApplyComputedSymmetries(fractionalCoordinates, atomsZ, SgInfo);

	// Release everything
	free(SgInfo.ListSeitzMx);
	free(SgInfo.ListRotMxInfo);

#ifdef DEBUG
	std::cout << "\nSpace group: " << spaceGroup << "\n";

	std::cout << "Input len: " << fractionalCoordinates.size() << "\n";
	// for(auto v : fractionalCoordinates) std::cout << " " << v;
	// std::cout << "\n";
#endif
}

static void applyTransformations(SpglibDataset* dataset,
								 size_t natoms,
								 double (*positions)[3],
								 int *types,
								 vector<int32_t>& outTypes,
								 vector<double_t>& outFc)
{
	bool different = true;

	int nops = dataset->n_operations;
	for(size_t j=0; j < natoms; ++j)
	{
		for(int i = 0; i < nops; i++)
		{
			// Apply symmetry transformation
			double fx = dataset->rotations[i][0][0]*positions[j][0]+
						dataset->rotations[i][0][1]*positions[j][1]+
						dataset->rotations[i][0][2]*positions[j][2]+
						dataset->translations[i][0];
			double fy = dataset->rotations[i][1][0]*positions[j][0]+
						dataset->rotations[i][1][1]*positions[j][1]+
						dataset->rotations[i][1][2]*positions[j][2]+
						dataset->translations[i][1];
			double fz = dataset->rotations[i][2][0]*positions[j][0]+
						dataset->rotations[i][2][1]*positions[j][1]+
						dataset->rotations[i][2][2]*positions[j][2]+
						dataset->translations[i][2];

			// Return atoms to the unit cell
			fx = foldIntoUnitCell(fx);
			fy = foldIntoUnitCell(fy);
			fz = foldIntoUnitCell(fz);

			// Check duplicated
			for(int s=0; s < outFc.size()/3; ++s)
			{
				double dx = outFc[3*s+0]-fx;
				if(dx > DUPLICATED_TOL || dx < -DUPLICATED_TOL) {
					different = true;
					continue;
				}
				double dy = outFc[3*s+1]-fy;
				if(dy > DUPLICATED_TOL || dy < -DUPLICATED_TOL) {
					different = true;
					continue;
				}
				double dz = outFc[3*s+2]-fz;
				if(dz > DUPLICATED_TOL || dz < -DUPLICATED_TOL) {
					different = true;
					continue;
				}
				different = false;
				break;
			}

			if(different)
			{
				outFc.push_back(fx);
				outFc.push_back(fy);
				outFc.push_back(fz);
				outTypes.push_back(types[j]);
				different = false;
			}
		}
	}
}

#ifdef DEBUG
void dump(double lattice[3][3], double position[][3], int types[], const int num_atom, string title)
{
	cout << '\n' << title << endl;
	cout << "\nBasis:" << endl;
	cout << lattice[0][0] << ' ' << lattice[0][1] << ' ' << lattice[0][2] << endl;
	cout << lattice[1][0] << ' ' << lattice[1][1] << ' ' << lattice[1][2] << endl;
	cout << lattice[2][0] << ' ' << lattice[2][1] << ' ' << lattice[2][2] << endl;

	cout << "\nAtoms:" << endl;
	for(int i=0; i < num_atom; ++i) {
		cout << types[i] << ": " << position[i][0] << ' ' << position[i][1] << ' ' << position[i][2];

		double x = position[i][0]*lattice[0][0]+position[i][1]*lattice[0][1]+position[i][2]*lattice[0][2];
		double y = position[i][0]*lattice[1][0]+position[i][1]*lattice[1][1]+position[i][2]*lattice[1][2];
		double z = position[i][0]*lattice[2][0]+position[i][1]*lattice[2][1]+position[i][2]*lattice[2][2];

		cout << " -> " << x << ' ' << y << ' ' << z << endl;
	}
}
#endif

string doFindAndApplySymmetries(
	vector<double_t>& basis,
	string& spaceGroup,
	vector<int32_t>& atomsZ,
	vector<double_t>& fractionalCoordinates,
	bool applyInputSymmetries,
	bool enableFindSymmetries,
	bool standardizeCell,
	float symprecStandardize,
	float symprecDataset,
	bool& unitCellModified)
{
	// Status to be returned
	string status("");
	unitCellModified = false;

	// Apply input symmetries
	if(applyInputSymmetries)
	{
		applySymmetriesInput(spaceGroup, fractionalCoordinates, atomsZ, status);
	}

#ifdef DEBUG
	if(status.size() > 0) cout << status << endl;

	cout << "*** AtomsZ" << endl;
	for(auto x : atomsZ) cout << x << ' ';

	cout << "\n\n*** Frac";
	int n = 0;
	for(auto x : fractionalCoordinates) {
		if(n % 3 == 0) cout << endl;
		cout << x << ' ';
		++n;
	}
	cout << endl;
#endif

	// Access the SPG library
	if(enableFindSymmetries)
	{
		// Prepare the mutable unit cell basis
		double lattice[3][3];
		for(size_t j=0; j < 3; ++j)
		{
			lattice[j][0] = basis[3*j+0];
			lattice[j][1] = basis[3*j+1];
			lattice[j][2] = basis[3*j+2];
		}

		// Prepare the mutable list of atoms' atomic numbers
		size_t natoms = atomsZ.size();
		int *types = (int *)malloc(4*natoms*sizeof(int));
		for(size_t i=0; i < natoms; ++i) types[i] = atomsZ[i];
		int num_primitive_atom = natoms;

		// Prepare the mutable list of atoms positions
		double (*positions)[3] = (double (*)[3])malloc(4*natoms*sizeof *positions);
		for(size_t j=0; j < natoms; ++j)
		{
			positions[j][0] = fractionalCoordinates[3*j+0];
			positions[j][1] = fractionalCoordinates[3*j+1];
			positions[j][2] = fractionalCoordinates[3*j+2];
		}

		// Standardize the cell before finding symmetries
		if(standardizeCell)
		{
#ifdef DEBUG
		dump(lattice, positions, types, natoms, "Before standardizing");
#endif
			num_primitive_atom = spg_standardize_cell(lattice, positions, types,
													  natoms, 0, 0, symprecStandardize);
#ifdef DEBUG
		dump(lattice, positions, types, num_primitive_atom, "After standardizing");
#endif
			if(num_primitive_atom == 0)
			{
				SpglibError code = spg_get_error_code();

				status += "Skipping cell standardization: ";
				status += spg_get_error_message(code);
				status += "\n";
				num_primitive_atom = natoms;
			}
			else unitCellModified = true;
		}

		// Find symmetries
		SpglibDataset* dataset = spg_get_dataset(lattice, positions, types,
												 num_primitive_atom, symprecDataset);
		if(dataset == NULL)
		{
			SpglibError code = spg_get_error_code();
			status += "Failed to get dataset: ";
			status += spg_get_error_message(code);
			status += "\n";
		}
		else
		{
			vector<int32_t> outTypes;
			vector<double_t> outPositions;
			applyTransformations(dataset, num_primitive_atom, positions,
								 types, outTypes, outPositions);

			// Copy back the values
			spaceGroup = dataset->international_symbol;
			atomsZ = outTypes;
			fractionalCoordinates = outPositions;
			for(int i=0; i < 3; ++i)
			{
				for(int j=0; j < 3; ++j)
				{
					basis[3*i+j] = lattice[i][j];
				}
			}

			// Release the dataset
			spg_free_dataset(dataset);
		}

		free(types);
		free(positions);
	}

	// Return the operation status
	return status;
}
