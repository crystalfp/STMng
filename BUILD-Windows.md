
# Build STMng on Windows

1. [Download](https://github.com/crystalfp/STMng/releases) the source code and unzip `STMng-<version>.zip`
2. Rename directory `STMng-<version>` to `STMng`

## Prerequisite tools
1. Python 3.12
2. NodeJS 25.x
3. Visual Studio or Visual Studio Community (2022)
4. CMake (to build SPGlib)

### Install needed libraries
1. Next steps need a terminal open
2. In the terminal: `cd STMng`
3. Install the following libraries:
	1. **sginfo**

		- Download `sginfo_1_01open.zip` from <https://cci.lbl.gov/sginfo/#getting_sginfo>
		- Unzip under `src/cpp`
		- Rename directory `sginfo_1_01` to `sginfo`

	2. **SPGlib**

		- Download `v2.7.0.zip` from <https://github.com/spglib/spglib/releases/tag/v2.7.0>
		- Unzip under `src/cpp`
		- `cd src/cpp/spglib-2.7.0`
		- `mkdir build`
		- `cmake . -B ./build`
		- `cmake --build ./build --config Release`

	3. **Eigen**

		- Download `eigen-5.0.0.zip` from <https://libeigen.gitlab.io/>
		- Unzip under `src/cpp`
		- `mv eigen-5.0.0/Eigen .`
		- Remove directory `eigen-5.0.0`

## Build STMng
1. Return to the `STMng` directory
2. `npm install`
3. Now you can run STMng in development mode from here by executing `npx vite` or `npm run dev`
4. To build the installer: `npm run build` (ignore the typescript plugin errors)
5. For some unknown reason sometimes the step above hangs after running rolldown. Simply kill it and rerun step 4.
6. You will have the installer under `release/<version>` as `STMng-<version>-setup.exe`
7. To install the production version execute `STMng-<version>-setup.exe`, select an installation directory then run STMng from the Start menu
