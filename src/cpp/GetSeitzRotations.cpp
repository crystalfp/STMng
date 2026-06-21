#include <string>
#include <vector>
#include <stdio.h>
using namespace std;

#include "GetSeitzRotations.h"

#define SGCOREDEF__
extern "C" {
#include "./sginfo/sginfo.h"
}

string doGetSeitzRotations(string& spaceGroup, vector<int32_t>& rotationMatrices)
{
	// Now compute the list of Seitz matrices
	T_SgInfo SgInfo;

	// Allocate memory for the list of Seitz matrices and
	// a supporting list which holds the characteristics of
	// the rotation parts of the Seitz matrices
	SgInfo.MaxList = 192; // absolute maximum number of symops
	SgInfo.ListSeitzMx = (T_RTMx *)malloc(SgInfo.MaxList * sizeof(*SgInfo.ListSeitzMx));
	if(SgInfo.ListSeitzMx == NULL)
	{
		return "Not enough memory for ListSeitzMx";
	}

	SgInfo.ListRotMxInfo = (T_RotMxInfo *)malloc(SgInfo.MaxList * sizeof(*SgInfo.ListRotMxInfo));
	if(SgInfo.ListRotMxInfo == NULL)
	{
		free(SgInfo.ListSeitzMx);
		return "Not enough memory for ListRotMxInfo";
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
			string error = SgError;
			error += " (from ParseHallSymbol)";

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return error;
		}

		// Do some book-keeping and derive crystal system, point group,
		// and - if not already set - find the entry in the internal
		// table of space group symbols
		if(CompleteSgInfo(&SgInfo) != 0)
		{
			string error = SgError;
			error += " (from CompleteSgInfo)";

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return error;
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
						string error = SgError;
						error += " (from AddInversion2ListSeitzMx)";

						free(SgInfo.ListSeitzMx);
						free(SgInfo.ListRotMxInfo);
						return error;
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
				string error = SgError;
				error += " (from CompleteSgInfo)";

				free(SgInfo.ListSeitzMx);
				free(SgInfo.ListRotMxInfo);
				return error;
			}
		}
		else
		{
			// No matching table entry
			string error = "Invalid space group symbol: ";
			error += spaceGroup;

			free(SgInfo.ListSeitzMx);
			free(SgInfo.ListRotMxInfo);
			return error;
		}
	}

	// Compute all symmetries
	// see http://www.kristall.ethz.ch/LFK/software/sginfo/sginfo_loop_symops.html
	int nLoopInv = Sg_nLoopInv(&SgInfo);
	for(int iLoopInv = 0; iLoopInv < nLoopInv; iLoopInv++)
	{
		int f = (iLoopInv == 0) ? 1 : -1;

		const T_RTMx *lsmx = SgInfo.ListSeitzMx;

		for(int iList = 0; iList < SgInfo.nList; iList++, lsmx++)
		{
			T_RTMx SMx;

			for(int i = 0; i < 9; i++) SMx.s.R[i] = f * lsmx->s.R[i];
			int *R = SMx.s.R;
			rotationMatrices.insert(std::end(rotationMatrices), R, R+9);

#ifdef DEBUG
			printf("[%2d %2d %2d;\n %2d %2d %2d;\n %2d %2d %2d]\n",
					R[0], R[1], R[2],
					R[3], R[4], R[5],
					R[6], R[7], R[8]
			);
			fflush(stdout);
#endif
		}
	}

	// Release everything
	free(SgInfo.ListSeitzMx);
	free(SgInfo.ListRotMxInfo);

	return string("");
}
