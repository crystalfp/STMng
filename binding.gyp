{
  "targets": [
    {
      "target_name": "native",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
		    "src/cpp/native.cpp",
        "src/cpp/ComputeSymmetries.cpp",
        "src/cpp/sginfo/sgclib.c",
        "src/cpp/sginfo/sgfind.c",
        "src/cpp/sginfo/sghkl.c",
        "src/cpp/sginfo/sginfo.c",
        "src/cpp/sginfo/sgio.c",
        "src/cpp/sginfo/sgsi.c"
	    ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
			"defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.7"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {"ExceptionHandling": 1}
      },
      "conditions": [
	      ['OS=="linux"', {
	        "cflags": [
				    "-Wno-sign-compare",
			      "-Wno-implicit-fallthrough",
			      "-Wno-misleading-indentation",
			      "-Wno-maybe-uninitialized",
			      "-Wno-format-overflow"
			    ]
	      }]
      ]
    }
  ]
}
