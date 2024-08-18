{
	"targets": [
		{
			"target_name": "native",
			"cflags!": [ "-fno-exceptions" ],
			"cflags_cc!": [ "-fno-exceptions" ],
			"sources": [
				"new/cpp/native.cpp",
				"new/cpp/sginfo/sgclib.c",
				"new/cpp/sginfo/sgfind.c",
				"new/cpp/sginfo/sghkl.c",
				"new/cpp/sginfo/sginfo.c",
				"new/cpp/sginfo/sgio.c",
				"new/cpp/sginfo/sgsi.c",
				"new/cpp/FindAndApplySymmetries.cpp"
			],
			"include_dirs": [
				"<!@(node -p \"require('node-addon-api').include\")",
				"new/cpp/spglib-develop/include"
			],
			"dependencies": [
				"<!(node -p \"require('node-addon-api').gyp\")"
			],
			"defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
			"conditions": [
				['OS=="linux"', {
					"cflags": [
						"-Wno-sign-compare",
						"-Wno-implicit-fallthrough",
						"-Wno-misleading-indentation",
						"-Wno-maybe-uninitialized",
						"-Wno-format-overflow"
					],
					"libraries": [
						"-Wl,-rpath=<(module_root_dir)/build/Release",
						"-L <(module_root_dir)/../spglib-develop -lsymspg -lm"
					],
					"copies": [
					{
						"destination": "<(module_root_dir)/build/Release",
						"files": [
							"<(module_root_dir)/../spglib-develop/libsymspg.so",
							"<(module_root_dir)/../spglib-develop/libsymspg.so.2",
							"<(module_root_dir)/../spglib-develop/libsymspg.so.2.3.2"
						]
					}
				]
				}],
				['OS=="win"', {
					"msvs_settings": {
						"VCCLCompilerTool": {
							"ExceptionHandling": 1,
							"WholeProgramOptimization": "true", # /GL, whole program optimization, needed for LTCG
							"OmitFramePointers": "true",
							"EnableFunctionLevelLinking": "true",
							"EnableIntrinsicFunctions": "true",
							"RuntimeTypeInfo": "false",
							"AdditionalOptions": [ "/EHsc" ]
						},
						"VCLibrarianTool": {
							"AdditionalOptions": [
								"/LTCG", # link time code generation
							],
						},
						"VCLinkerTool": {
							"LinkTimeCodeGeneration": 1, # link-time code generation
							"OptimizeReferences": 2, # /OPT:REF
							"EnableCOMDATFolding": 2, # /OPT:ICF
							"LinkIncremental": 1, # disable incremental linking
						},
					},
					"libraries": [
						"<(module_root_dir)/new/cpp/spglib-develop/Release/symspg.lib"
					],
					"copies": [
						{
							"destination": "<(module_root_dir)/build/Release",
							"files": ["<(module_root_dir)/new/cpp/spglib-develop/Release/symspg.dll"]
						}
					]
				}],
				['OS=="mac"', {
					"xcode_settings": {
						"GCC_ENABLE_CPP_EXCEPTIONS": "YES",
						"CLANG_CXX_LIBRARY": "libc++",
						"MACOSX_DEPLOYMENT_TARGET": "10.7"
					}
				}]
			]
		}
	]
}
