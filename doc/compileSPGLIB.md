# Unpack
```
unzip spglib-2.7.0.zip
cp -R spglib-2.7.0 Projects/STMng/src/cpp
```

# Windows

```
cd Projects/STMng/src/cpp/spglib-2.7.0

cmake . -B ./build
cmake --build ./build --config Release
```
The library will be under `./build/Release`

# Linux
```
cd Projects/STMng/src/cpp/spglib-2.7.0

cmake . -B ./build-linux
cmake --build ./build-linux --config Release
```
There are warnings from test code that can be ignored

The library will be under `./build-linux/Release`

# Final
At the end should correct:
```
.gitignore
binding.gyp
electron-builder.yaml
```
