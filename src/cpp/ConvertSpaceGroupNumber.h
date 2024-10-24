#include <string>

extern std::string doConvertSpaceGroupNumber(
	int spaceGroupNumber,	// Space group number (1-230)
	int variation,			// Variation (>= 0)
	int& errorNumber		// 0: No error
							// 1: Has been retried with variation = 0
							// 2: Other errors, the message is in the output string
);
