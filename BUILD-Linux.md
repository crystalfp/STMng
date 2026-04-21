
# Build STMng on Linux

1. [Download](https://github.com/crystalfp/STMng/releases) and untar `STMng-<version>.tar.gz`
2. Rename directory `STMng-<version>` to `STMng`

## Prerequisite tools
1. Python 3.12
2. nodejs 25.x
3. CMake (to build SPGlib)
4. Check if the compilers are installed: `cc --version` and `g++ --version`. Install them if missing.

### Install needed libraries
2. `cd STMng`
3. Install the following libraries:
	1. **sginfo**

		- Download `sginfo_1_01open.tar.gz` from `https://cci.lbl.gov/sginfo/#getting_sginfo`
		- Untar under `src/cpp`
		- Rename directory `sginfo_1_01` to `sginfo`

	2. **SPGlib**

		- Download `spglib-2.7.0.tar.gz` from `https://github.com/spglib/spglib/releases/tag/v2.7.0`
		- Untar under `src/cpp`
		- `cd src/cpp/spglib-2.7.0`
		- `mkdir build-linux`
		- `cmake . -B ./build-linux`
		- `cmake --build ./build-linux --config Release` (ignore the errors from test build)
		
	3. **Eigen**

		- Download `eigen-5.0.0.tar.gz` from `https://libeigen.gitlab.io/`
		- Untar under `src/cpp`
		- `mv eigen-5.0.0/Eigen .`
		- `rm -rf eigen-5.0.0`

## Build STMng
1. Return to the `STMng` directory
2. `npm install`
3. `mv linux-scripts/* .`
3. Now you can run STMng in development mode by executing `npx vite` or `npm run dev` in the `STMng` directory
4. To build the bundled application: `npm run build` (ignore the typescript plugin errors)
6. You will have the bundled application under `release/<version>` as `STMng-<version>.AppImage`
8. To run the packaged version you need to have the package `fuse` installed. Then run `./release/<version>/STMng-<version>.AppImage`
