# Linux installation from sources

The following instructions have been tried on Ubuntu 22.0.4 under WSL (Windows Linux subsystem).

1. Unpack the application tree under `STMng` for example in the home directory `~`
2. Install NodeJS following the instructions here <https://nodejs.org/en/download/package-manager/current>
3. Verify the installation running `node --version ` and `npm --version`
4. Check the compilers are installed: `cc --version` and `g++ --version`. Install them if missing.
5. Go to the application directory `cd STMng` and run `npm install`. At the end you will have the environment setup.
6. Try to run the developer version with `npx vite`. Possibly this fails with errors due to missing libraries. In my setup the missing libraries are (in parenthesis the package to install):
	- libnss3.so (libnss3)
	- libatk-1.0.so.0 (libatk1.0-0)
	- libatk-bridge-2.0.so.0 (libatk-bridge2.0-0)
	- libcups.so.2 (libcups2)
	- libgtk-3.so.0 (libgtk-3-0)
	- libgbm.so.1 (libgbm1)
	- libasound.so.2 (libasound2)
7. To package the application do `npm run -s build`. Under `release/<version>` you will find the file `STMng-<version>.AppImage`.
8. To run the packaged version you need to have the package `fuse` installed. Then run `./release/<version>/STMng-<version>.AppImage`
