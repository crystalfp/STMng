#include <iostream>
#include <string>
#include <vector>
#include <stdlib.h>
#include <cstring>
#include <math.h>

#define SGCOREDEF__
extern "C" {
#include "./sginfo/sginfo.h"
}
// #define DEBUG

static const char *errorMsg(const char *msg, const char *extra)
{
	static char str[512];
	sprintf(str, "%.250s %.250s", msg, extra);
	return str;
}

static std::vector<double_t> ApplySymmetries(std::vector<double_t>& fc, T_SgInfo& SgInfo)
{
	// Replicate the atoms using the symmetries found
	const float EPS = 1e-5F;

	int nLoopInv   = Sg_nLoopInv(&SgInfo);
	int nTrV       = SgInfo.LatticeInfo->nTrVector;
	const int *TrV = SgInfo.LatticeInfo->TrVector;

	// Compute the resulting number of atoms and prepare the list of coordinates and indices
	int    nrepl       = nTrV * nLoopInv * SgInfo.nList;
	int    out_ncoords = fc.size() * nrepl;
	double* fcoords    = new double[out_ncoords];

	// Compute all symmetries (see http://www.kristall.ethz.ch/LFK/software/sginfo/sginfo_loop_symops.html)
	int atoms_start_idx = 0;
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
						if(Bfr[j] > 1.F+EPS)   Bfr[j] -= floorf(Bfr[j]);
						else if(Bfr[j] < -EPS) Bfr[j] += 1.F-ceilf(Bfr[j]);
					}
#ifdef DEBUG
printf("+ atom %d [%f, %f, %f] -> [%f, %f, %f]\n", i, fc[i*3+0], fc[i*3+1], fc[i*3+2], Bfr[0], Bfr[1], Bfr[2]);
#endif
					// Save the fractional coordinates
					fcoords[atoms_start_idx++] = Bfr[0];
					fcoords[atoms_start_idx++] = Bfr[1];
					fcoords[atoms_start_idx++] = Bfr[2];
				}
			}
		}
	}

	std::vector<double_t> fcOut(fcoords, fcoords + out_ncoords);
	delete [] fcoords;

	return fcOut;
}

std::vector<double_t> compute(std::string& sg, std::vector<double_t>& fc, std::string& error) {

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
		return fc;
	}

	SgInfo.ListRotMxInfo = (T_RotMxInfo *)malloc(SgInfo.MaxList * sizeof(*SgInfo.ListRotMxInfo));
	if(SgInfo.ListRotMxInfo == NULL)
	{
		error = "Not enough memory for ListRotMxInfo";

		free(SgInfo.ListSeitzMx);
		return fc;
	}

	// Initialize the SgInfo structure
	InitSgInfo(&SgInfo);

	// Access the SG library
	const T_TabSgName *tsgn;
    tsgn = FindTabSgNameEntry(sg.c_str(), 'A');
    if(tsgn != NULL)
	{
		// Fill with the SG table name
		SgInfo.TabSgName = tsgn;

		// Translate the Hall symbol and generate the whole group
		ParseHallSymbol(tsgn->HallSymbol, &SgInfo);
		if(SgError != NULL)
		{
			error = errorMsg(SgError, "(from ParseHallSymbol)");
			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return fc;
		}

		// Do some book-keeping and derive crystal system, point group,
		// and - if not already set - find the entry in the internal
		// table of space group symbols
		if(CompleteSgInfo(&SgInfo) != 0)
		{
			error = errorMsg(SgError, "(from CompleteSgInfo)");

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return fc;
		}
	}
	else
	{
		// Prepare parsing of the multiline Seitz matrix in XYZ form
		int len = sg.size();
		char *SymXYZ = (char *)malloc(len+1);
		strcpy(SymXYZ, sg.c_str());
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
						error = errorMsg(SgError, "(from AddInversion2ListSeitzMx)");

						free(SgInfo.ListSeitzMx);
						free(SgInfo.ListRotMxInfo);
						return fc;
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
				error = errorMsg(SgError, "(from CompleteSgInfo)");

				free(SgInfo.ListSeitzMx);
				free(SgInfo.ListRotMxInfo);
				return fc;
			}
		}
		else
		{
			// No matching table entry
			error = errorMsg("Invalid space group symbol: ", sg.c_str());

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return fc;
		}
	}

	// Apply symmetries
	std::vector<double_t> fcOut = ApplySymmetries(fc, SgInfo);

	// Release everything
	free(SgInfo.ListSeitzMx);
	free(SgInfo.ListRotMxInfo);

#ifdef DEBUG
	std::cout << "\nSpace group: " << sg << "\n";

	std::cout << "Input len: " << fc.size() << "\n";
	// for(auto v : fc) std::cout << " " << v;
	// std::cout << "\n";

	std::cout << "Output len: " << fcOut.size() << "\n";
#endif

	return fcOut;
}
