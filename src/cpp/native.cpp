#include <napi.h>
#include <string>
#include "ComputeSymmetries.h"

Napi::Value computeSymmetries(const Napi::CallbackInfo& info) {

	Napi::Env env = info.Env();

	// Check arguments
	if(info.Length() != 2) {
    	Napi::TypeError::New(env, "Expecting exactly two arguments").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	if(!info[0].IsString()) {
    	Napi::TypeError::New(env, "First argument should be a string").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	if(!info[1].IsTypedArray()) {
    	Napi::TypeError::New(env, "Second argument should be a typed array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}

	// Argument 0: string
	std::string sg = static_cast<std::string>(info[0].As<Napi::String>());

	// Argument 1: array of floats
	Napi::TypedArray typedArray = info[1].As<Napi::TypedArray>();

	if(typedArray.TypedArrayType() != napi_float64_array) {
		Napi::Error::New(info.Env(), "Expected a Float64Array").ThrowAsJavaScriptException();
		return info.Env().Undefined();
	}
	Napi::Float64Array doubleArray = typedArray.As<Napi::Float64Array>();
	size_t arrayLength = doubleArray.ElementLength();

	// Copy to std::vector<double_t>:
	std::vector<double_t> inputValues(doubleArray.Data(), doubleArray.Data() + arrayLength);

	// Compute symmetries
	std::string errorMessage;
	std::vector<double_t> out = compute(sg, inputValues, errorMessage);

	// Transform result into a JSON formatted string
	std::string json = "{\"coords\":[";
	size_t len = out.size();
	for(size_t i = 0; i < len; ++i) {
		if(i > 0) json.append(",");
		json.append(std::to_string(out[i]));
	}
	json.append("],\"error\":\"");
	json.append(errorMessage);
	json.append("\"}");

	// Return the new coordinates already formatted for sending to client
	return Napi::String::New(env, json.c_str());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {

	exports.Set(Napi::String::New(env, "computeSymmetries"), Napi::Function::New(env, computeSymmetries));
	return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
