# See The Molecule new generation (STMng)
See The Molecule new generation (STMng) is a chemical and crystallographic structures visualization and analysis tool that implements some of the functionalities of the old <a href="http://mariovalle.name/STM4/index.html">STM4</a> visualization tool.

STMng primary use is to analyze the results of the [USPEX](https://uspex-team.org/) computational material discovery system.

Unlike its predecessor, STMng is built on top of open source framework and libraries.

Remember: Goal of STMng is to help your understanding, not providing fancy images only!


## Current Status

The tool is stable. Instead, the README and the GitHub repository are under development 🚧

## Documentation

A quick tutorial is available <a href="https://www.youtube.com/watch?si=tfdwvTi0Kd8BjGCk&v=2t7hD9XwINQ&feature=youtu.be">here</a>.

You can access the documentation from STMng with the F1 key.
## Installing
### Windows (Windows 11)
- Download STMng-*\<version\>*-setup.exe
- Execute it as Administrator
- Select an installation directory (normally: "C:\Program Files\STMng")
- Run STMng from the start menu

### Linux (Ubuntu 22)
- Download STMng-*\<version\>*.AppImage
- Verify you have the package **fuse** installed
- Install SPGlib
- chmod a+x ./STMng-*\<version\>*.AppImage
- Run ./STMng-*\<version\>*.AppImage\
  Sometimes this step fails with: “The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /tmp/.mount_STMng-*nnnn*/chrome-sandbox is owned by root and has mode 4755.”


## Contribute

There are many ways to [contribute](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md) to TypeScript.
* [Submit bugs](https://github.com/microsoft/TypeScript/issues) and help us verify fixes as they are checked in.
* Review the [source code changes](https://github.com/microsoft/TypeScript/pulls).
* [Contribute bug fixes](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md).
