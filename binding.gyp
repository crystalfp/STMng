{
	"targets": [
		{
			"target_name": "native",
			"cflags!": [ "-fno-exceptions" ],
			"cflags_cc!": [ "-fno-exceptions" ],
			"sources": [
				"src/cpp/native.cpp",
				"src/cpp/sginfo/sgclib.c",
				"src/cpp/sginfo/sgfind.c",
				"src/cpp/sginfo/sghkl.c",
				"src/cpp/sginfo/sginfo.c",
				"src/cpp/sginfo/sgio.c",
				"src/cpp/sginfo/sgsi.c",
				"src/cpp/FindAndApplySymmetries.cpp",
				"src/cpp/ConvertSpaceGroupNumber.cpp",
				"src/cpp/MDS.cpp"
			],
			"include_dirs": [
				"<!@(node -p \"require('node-addon-api').include\")",
				"src/cpp/spglib-2.5.0/include",
				"src/cpp"
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
						"-L <(module_root_dir)/build/Release -lsymspg -lm"
						# "-L src/cpp/spglib-2.5.0/build-linux -lsymspg -lm"
					],
					"copies": [
					{
						"destination": "<(module_root_dir)/build/Release",
						"files": [
							"<(module_root_dir)/src/cpp/spglib-2.5.0/build-linux/libsymspg.so",
							"<(module_root_dir)/src/cpp/spglib-2.5.0/build-linux/libsymspg.so.2",
							"<(module_root_dir)/src/cpp/spglib-2.5.0/build-linux/libsymspg.so.2.5.0"
						]
					}
				]
				}],
				['OS=="win"', {
					"msvs_settings": {
						"VCCLCompilerTool": {
							"ExceptionHandling": 1,
							# /GL, whole program optimization, needed for LTCG
							"WholeProgramOptimization": "true",
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
						"<(module_root_dir)/src/cpp/spglib-2.5.0/build/Release/symspg.lib"
					],
					"copies": [
						{
							"destination": "<(module_root_dir)/build/Release",
							"files": ["<(module_root_dir)/src/cpp/spglib-2.5.0/build/Release/symspg.dll"]
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
} # type: ignore
