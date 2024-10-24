#include "ConvertSpaceGroupNumber.h"

#define SGCOREDEF__
extern "C" {
#include "./sginfo/sginfo.h"
}

std::string doConvertSpaceGroupNumber(int spaceGroupNumber, int variation, int &errorNumber)
{
	char msg[256];

	// Conversion of space group number to space group symbol
	for(int i=0; ; ++i)
	{
		int id = TabSgName[i].SgNumber;
		if(id == 0) break;
		if(id == spaceGroupNumber)
		{
			errorNumber = 0;

			if(TabSgName[i+variation].SgNumber != spaceGroupNumber)
			{
				errorNumber = 1;
				variation = 0;
			}
			const char *s = TabSgName[i+variation].SgLabels;
			char tmp[32];
			int j = 0;
			for(; s[j] && s[j] != ' '; ++j) tmp[j] = s[j];
			tmp[j] = '\0';

			return std::string(tmp);
		}
	}

	errorNumber = 2;
	sprintf(msg, "Space group %d not found", spaceGroupNumber);
	return std::string(msg);
}
