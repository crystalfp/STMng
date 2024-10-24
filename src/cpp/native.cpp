#include <napi.h>
#include <string>
#include "FindAndApplySymmetries.h"
#include "ConvertSpaceGroupNumber.h"

using namespace std;

Napi::Value findAndApplySymmetries(const Napi::CallbackInfo& info) {

	Napi::Env env = info.Env();

	// Check arguments
	if(info.Length() != 10) {
    	Napi::TypeError::New(env, "Expecting exactly ten arguments").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 0: basis
	if(!info[0].IsTypedArray()) {
    	Napi::TypeError::New(env, "First argument should be a typed array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 1: spaceGroup
	if(!info[1].IsString()) {
    	Napi::TypeError::New(env, "Second argument should be a string").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 2: atomsZ
	if(!info[2].IsTypedArray()) {
    	Napi::TypeError::New(env, "Third argument should be a typed array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 3: fractionalCoordinates
	if(!info[3].IsTypedArray()) {
    	Napi::TypeError::New(env, "Fourth argument should be a typed array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 4: applyInputSymmetries
	if(!info[4].IsBoolean()) {
    	Napi::TypeError::New(env, "Fifth argument should be a boolean").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 5: enableFindSymmetries
	if(!info[5].IsBoolean()) {
    	Napi::TypeError::New(env, "Sixth argument should be a boolean").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 6: standardizeCell
	if(!info[6].IsBoolean()) {
    	Napi::TypeError::New(env, "Seventh argument should be a boolean").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 7: standardizeOnly
	if(!info[7].IsBoolean()) {
    	Napi::TypeError::New(env, "Eighth argument should be a boolean").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 8: symprecStandardize
	if(!info[8].IsNumber()) {
    	Napi::TypeError::New(env, "Nineth argument should be a number").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 9: symprecDataset
	if(!info[9].IsNumber()) {
    	Napi::TypeError::New(env, "Tenth argument should be a number").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}


	// Argument 0: array of floats
	Napi::TypedArray typedArray = info[0].As<Napi::TypedArray>();

	if(typedArray.TypedArrayType() != napi_float64_array) {
		Napi::Error::New(info.Env(), "Argument 0: expected a Float64Array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}
	Napi::Float64Array basisArray = typedArray.As<Napi::Float64Array>();
	size_t basisLength = basisArray.ElementLength();
	std::vector<double_t> basis(basisArray.Data(), basisArray.Data() + basisLength);

	// Argument 1: string
	std::string spaceGroup = static_cast<std::string>(info[1].As<Napi::String>());

	// Argument 2: array of integers
	typedArray = info[2].As<Napi::TypedArray>();

	if(typedArray.TypedArrayType() != napi_int32_array) {
		Napi::Error::New(info.Env(), "Argument 2: expected an Int32Array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}
	Napi::Int32Array atomsZArray = typedArray.As<Napi::Int32Array>();
	size_t atomsZLength = atomsZArray.ElementLength();
	std::vector<int32_t> atomsZ(atomsZArray.Data(), atomsZArray.Data() + atomsZLength);

	// Argument 3: array of floats
	typedArray = info[3].As<Napi::TypedArray>();

	if(typedArray.TypedArrayType() != napi_float64_array) {
		Napi::Error::New(info.Env(), "Argument 3: expected a Float64Array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}
	Napi::Float64Array fractionalCoordinatesArray = typedArray.As<Napi::Float64Array>();
	size_t fractionalCoordinatesLength = fractionalCoordinatesArray.ElementLength();
	std::vector<double_t> fractionalCoordinates(fractionalCoordinatesArray.Data(),
												fractionalCoordinatesArray.Data() +
												fractionalCoordinatesLength);

	// Argument 4: boolean
	bool applyInputSymmetries = static_cast<bool>(info[4].As<Napi::Boolean>());

	// Argument 5: boolean
	bool enableFindSymmetries = static_cast<bool>(info[5].As<Napi::Boolean>());

	// Argument 6: boolean
	bool standardizeCell = static_cast<bool>(info[6].As<Napi::Boolean>());

	// Argument 7: boolean
	bool standardizeOnly = static_cast<bool>(info[7].As<Napi::Boolean>());

	// Argument 8: float
	double symprecStandardize = static_cast<double>(info[8].As<Napi::Number>());

	// Argument 9: float
	double symprecDataset = static_cast<double>(info[9].As<Napi::Number>());

	bool unitCellModified;

	std::string out = doFindAndApplySymmetries(
		basis,
		spaceGroup,
		atomsZ,
		fractionalCoordinates,
		applyInputSymmetries,
		enableFindSymmetries,
		standardizeCell,
		standardizeOnly,
		symprecStandardize,
		symprecDataset,
		unitCellModified
	);

	// Return the data
	Napi::Object obj = Napi::Object::New(env);
	obj.Set("spaceGroup", spaceGroup);

	Napi::Float64Array basisOut = Napi::Float64Array::New(env, 9);
	for(size_t i=0; i < 9; ++i) basisOut[i] = basis[i];
	obj.Set("basis", basisOut);

	int natomsOut = atomsZ.size();
	Napi::Int32Array atomsZOut = Napi::Int32Array::New(env, natomsOut);
	for(size_t i=0; i < natomsOut; ++i) atomsZOut[i] = atomsZ[i];
	obj.Set("atomsZ", atomsZOut);

	Napi::Float64Array fcOut = Napi::Float64Array::New(env, natomsOut*3);
	for(size_t i=0; i < natomsOut*3; ++i) fcOut[i] = fractionalCoordinates[i];
	obj.Set("fractionalCoordinates", fcOut);

	obj.Set("noCellChanges", unitCellModified);

	obj.Set("status", out);

	return obj;
}

Napi::Value convertSpaceGroupNumber(const Napi::CallbackInfo& info) {

	Napi::Env env = info.Env();

	// Check arguments
	if(info.Length() != 2) {
    	Napi::TypeError::New(env, "Expecting exactly two arguments").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 0: spaceGroupNumber
	if(!info[0].IsNumber()) {
    	Napi::TypeError::New(env, "First argument should be a number").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 1: variation
	if(!info[1].IsNumber()) {
    	Napi::TypeError::New(env, "Second argument should be a number").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 0: integer
	int spaceGroupNumber = static_cast<int>(info[0].As<Napi::Number>());

	// Argument 1: integer
	int variation = static_cast<int>(info[1].As<Napi::Number>());

	// Execute the native function
	int errorNumber;
	std::string out = doConvertSpaceGroupNumber(spaceGroupNumber, variation, errorNumber);

	// Return the data
	Napi::Object obj = Napi::Object::New(env);
	obj.Set("spaceGroup", out);
	obj.Set("errorNumber", errorNumber);

	return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {

	exports.Set(Napi::String::New(env, "findAndApplySymmetries"),
				Napi::Function::New(env, findAndApplySymmetries));
	exports.Set(Napi::String::New(env, "convertSpaceGroupNumber"),
				Napi::Function::New(env, convertSpaceGroupNumber));
	return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
