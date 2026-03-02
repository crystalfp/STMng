// #define DEBUG

#ifdef DEBUG
#include <iostream>
#include <iomanip>
#include <set>
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
						if(!((dx < DUPLICATED_TOL     && dx > -DUPLICATED_TOL) ||
							 (dx < (1+DUPLICATED_TOL) && dx > (1-DUPLICATED_TOL)))) {
							different = true;
							continue;
						}
						double dy = fcOut[3*k+1]-Bfr[1];
						if(!((dy < DUPLICATED_TOL     && dy > -DUPLICATED_TOL) ||
							 (dy < (1+DUPLICATED_TOL) && dy > (1-DUPLICATED_TOL)))) {
							different = true;
							continue;
						}
						double dz = fcOut[3*k+2]-Bfr[2];
						if(!((dz < DUPLICATED_TOL     && dz > -DUPLICATED_TOL) ||
							 (dz < (1+DUPLICATED_TOL) && dz > (1-DUPLICATED_TOL)))) {
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

// Apply symmetries from the input space group
static void applySymmetriesInput(string& spaceGroup,
								 bool applySymmetries,
								 vector<double_t>& fractionalCoordinates,
								 vector<int32_t>& atomsZ,
								 int& sgNumber,
								 string& intlSymbolIn,
								 string& error)
{
	// Initialize the error message to no message and no space group number
	error = "";
	sgNumber = 0;

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
		strncpy(SymXYZ, spaceGroup.c_str(), len+1);
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
			cout << msg;
#endif
			if(lattice_indicator != 0)
			{
#ifdef DEBUG
				printf("Lattice indicator: %d\n", lattice_indicator);
#endif
				// Lattice type:
				//    1=P, 2=I, 3=rhombohedral obverse on hexagonal axes, 4=F, 5=A, 6=B, 7=C.
				// N must be made negative if the structure is non-centrosymmetric.

				if(lattice_indicator < 0)
				{
					// Mark non-centrosymmetric
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

	sgNumber = SgInfo.TabSgName ? SgInfo.TabSgName->SgNumber : 0;
	intlSymbolIn = SgInfo.TabSgName ? SgInfo.TabSgName->SgLabels : "";

	// Apply symmetries
	if(applySymmetries) {
		ApplyComputedSymmetries(fractionalCoordinates, atomsZ, SgInfo);
	}

	// Release everything
	free(SgInfo.ListSeitzMx);
	free(SgInfo.ListRotMxInfo);

#ifdef DEBUG
	cout << "\nSpace group: " << spaceGroup << "\n";

	cout << "Input len: " << fractionalCoordinates.size() << "\n";
	// for(auto v : fractionalCoordinates) cout << " " << v;
	// cout << "\n";
#endif
}

// Apply transformation from SPGLIB find symmetries
static void applyTransformations(SpglibDataset* dataset,
								 size_t natoms,
								 double (*positions)[3],
								 int *types,
								 vector<int32_t>& outTypes,
								 vector<double_t>& outFc)
{
	bool different = true;
	outTypes.clear();
	outFc.clear();

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

// Convert symmetry rotations and translations into
// _symmetry_equiv_pos_as_xyz strings
struct fraction_t {

	float value;
	string str;
};
// Fraction values in increasing usage frequency
vector<fraction_t> fractions = {
	{1.0f/2.0f, "1/2"},
	{1.0f/3.0f, "1/3"},
	{2.0f/3.0f, "2/3"},
	{1.0f/4.0f, "1/4"},
	{3.0f/4.0f, "3/4"},
	{1.0f/6.0f, "1/6"},
	{5.0f/6.0f, "5/6"},
	// These below seems never appear
	{1.0f/8.0f, "1/8"},
	{3.0f/8.0f, "3/8"},
	{5.0f/8.0f, "5/8"},
	{7.0f/8.0f, "7/8"}
};

static void oneConst(float t, int next, string& res)
{
	float tol = 1e-5f;

	if(t > -tol && t < tol) return;
	else if(t > 0.) {
		if(next) res.append("+");
	}
	else if(t < 0.) {
		res.append("-");
		t = -t;
	}

	for(auto x : fractions) {
		if(t > x.value-tol && t < x.value+tol) {
			res.append(x.str);
			return;
		}
	}
	res.append(to_string(t));
}

static int oneRot(float m, string var, int next, string& res)
{
	if(next) {
		if(m == 1.) {res.append("+"); res.append(var); return 1;}
		else if(m == -1.) {res.append("-"); res.append(var); return 1;}
		else if(m != 0.) {oneConst(m, 1, res); res.append(var); return 1;}
	}
	else {
		if(m == 1.) {res.append(var); return 1;}
		else if(m == -1.) {res.append("-"); res.append(var); return 1;}
		else if(m != 0.) {oneConst(m, 0, res); res.append(var); return 1;}
	}
	return next;
}

static string formatTransformations(SpglibDataset* dataset)
{
	std::string res = "";
	int next;
	int nops = dataset->n_operations;
	for(int i = 0; i < nops; i++)
	{
		next = oneRot(dataset->rotations[i][0][0], "x", 0, res);
		next = oneRot(dataset->rotations[i][0][1], "y", next, res);
		next = oneRot(dataset->rotations[i][0][2], "z", next, res);
		oneConst(dataset->translations[i][0], next, res);
		res.append(",");
		next = oneRot(dataset->rotations[i][1][0], "x", 0, res);
		next = oneRot(dataset->rotations[i][1][1], "y", next, res);
		next = oneRot(dataset->rotations[i][1][2], "z", next, res);
		oneConst(dataset->translations[i][1], next, res);
		res.append(",");
		next = oneRot(dataset->rotations[i][2][0], "x", 0, res);
		next = oneRot(dataset->rotations[i][2][1], "y", next, res);
		next = oneRot(dataset->rotations[i][2][2], "z", next, res);
		oneConst(dataset->translations[i][2], next, res);
		if(i < nops-1) res.append("\n");
	}

	return res;
}

#ifdef DEBUG
void dumpPOSCAR(double lattice[3][3], double position[][3], int types[], const int num_atom, string title)
{
	cout << title << endl << "1.0" << endl;
	cout << fixed << showpoint << setprecision(5) << lattice[0][0] << ' ' << lattice[0][1] << ' ' << lattice[0][2] << endl;
	cout << fixed << showpoint << setprecision(5) << lattice[1][0] << ' ' << lattice[1][1] << ' ' << lattice[1][2] << endl;
	cout << fixed << showpoint << setprecision(5) << lattice[2][0] << ' ' << lattice[2][1] << ' ' << lattice[2][2] << endl;

	cout << " O Fe" << endl;
	set<int> z;
	for(int i=0; i < num_atom; ++i) z.insert(types[i]);

	for(auto x : z)
	{
		int cnt = 0;
		for(int i=0; i < num_atom; ++i)
		{
			if(types[i] == x) ++cnt;
		}
		cout << ' ' << cnt;
	}
	cout << endl << "Direct" << endl;

	for(auto x : z)
	{
		for(int i=0; i < num_atom; ++i)
		{
			if(types[i] != x) continue;
			cout << fixed << showpoint << setprecision(5) << position[i][0] << ' ' << position[i][1] << ' ' << position[i][2] << endl;
		}
	}
}
#endif

// Entry point
string doFindAndApplySymmetries(
	vector<double_t>& basis,
	string& spaceGroup,
	vector<int32_t>& atomsZ,
	vector<double_t>& fractionalCoordinates,
	bool applyInputSymmetries,
	bool enableFindSymmetries,
	bool standardizeCell,
	bool standardizeOnly,
	bool createPrimitiveCell,
	double symprecStandardize,
	double symprecDataset,
	bool& unitCellModified,
	string& intlSymbol,
	string& intlSymbolIn,
	int& sgNumberIn,
	int& sgNumberOut)
{
	// Status to be returned
	string status("");
	unitCellModified = false;
	intlSymbol = "";
	intlSymbolIn = "";
	sgNumberIn = 0;
	sgNumberOut = 0;

	// Apply input symmetries
	if(spaceGroup != "")
	{
		applySymmetriesInput(spaceGroup, applyInputSymmetries, fractionalCoordinates, atomsZ, sgNumberIn, intlSymbolIn, status);
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
		// It is transposed to make the results equal to the Python version of the library
		double lattice[3][3];
		for(size_t j=0; j < 3; ++j)
		{
			lattice[0][j] = basis[3*j+0];
			lattice[1][j] = basis[3*j+1];
			lattice[2][j] = basis[3*j+2];
			// lattice[j][0] = basis[3*j+0];
			// lattice[j][1] = basis[3*j+1];
			// lattice[j][2] = basis[3*j+2];
		}

		// Prepare the mutable list of atoms' atomic numbers
		size_t natoms = atomsZ.size();
		int *types = (int *)malloc(4*natoms*sizeof(int));
		for(size_t i=0; i < natoms; ++i) types[i] = atomsZ[i];
		int num_primitive_atom = natoms;

		// Prepare the mutable list of atoms positions
		double (*positions)[3] { new double[4*natoms][3] };
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
			dumpPOSCAR(lattice, positions, types, natoms, "Before standardizing");
#endif
			num_primitive_atom = spg_standardize_cell(lattice, positions, types,
													  natoms, createPrimitiveCell ? 1 : 0,
													  0, symprecStandardize);
#ifdef DEBUG
			dumpPOSCAR(lattice, positions, types, num_primitive_atom, "After standardizing");
#endif
			if(num_primitive_atom == 0)
			{
				SpglibError code = spg_get_error_code();

				status += "Skipping cell standardization: ";
				status += spg_get_error_message(code);
				status += ".\n";
				num_primitive_atom = natoms;
			}
			else unitCellModified = true;
		}

		if(standardizeOnly)
		{
			// basis
			for(int i=0; i < 3; ++i)
			{
				for(int j=0; j < 3; ++j)
				{
					basis[3*i+j] = lattice[j][i];
					// basis[3*i+j] = lattice[i][j];
				}
			}
			// atomsZ
			atomsZ.resize(num_primitive_atom);
			for(size_t i=0; i < num_primitive_atom; ++i) atomsZ[i] = types[i];

			// fractionalCoordinates
			fractionalCoordinates.resize(3*num_primitive_atom);
			for(size_t j=0; j < num_primitive_atom; ++j)
			{
				fractionalCoordinates[3*j+0] = positions[j][0];
				fractionalCoordinates[3*j+1] = positions[j][1];
				fractionalCoordinates[3*j+2] = positions[j][2];
			}

			unitCellModified = true;

			// Compute symmetry parameters for display
			SpglibDataset* dataset = spg_get_dataset(lattice, positions, types,
												 	 num_primitive_atom, symprecDataset);
			if(dataset == NULL)
			{
				SpglibError code = spg_get_error_code();
				status += "Failed to get spglib dataset: ";
				status += spg_get_error_message(code);
				status += "\n";
			}
			else
			{
				spaceGroup  = formatTransformations(dataset);
				intlSymbol  = dataset->international_symbol;
				sgNumberOut = dataset->spacegroup_number;
			}

			free(types);
			delete [] positions;

			// Release the dataset
			spg_free_dataset(dataset);

			return status;
		}

		// Find symmetries
		SpglibDataset* dataset = spg_get_dataset(lattice, positions, types,
												 num_primitive_atom, symprecDataset);
		if(dataset == NULL)
		{
			SpglibError code = spg_get_error_code();
			status += "Failed to get spglib dataset: ";
			status += spg_get_error_message(code);
			status += "\n";
		}
		else
		{
			vector<int32_t> outTypes;
			vector<double_t> outPositions;
			applyTransformations(dataset, num_primitive_atom, positions,
								 types, outTypes, outPositions);

			// Compute the space group as symbol or as symmetry equivalent positions
			spaceGroup  = formatTransformations(dataset);
			intlSymbol  = dataset->international_symbol;
			sgNumberOut = dataset->spacegroup_number;

			// Copy back the values
			// Transpose the lattice to cancel the input transposition
			atomsZ = outTypes;
			fractionalCoordinates = outPositions;
			for(int i=0; i < 3; ++i)
			{
				for(int j=0; j < 3; ++j)
				{
					basis[3*i+j] = lattice[j][i];
					// basis[3*i+j] = lattice[i][j];
				}
			}

			// Release the dataset
			spg_free_dataset(dataset);
		}

		free(types);
		delete [] positions;
	}

	// Return the operation status
	return status;
}
