#!/bin/sh

d=/mnt/d/Projects/STMng
# mv STMng STMng-`date -I`
mv STMng STMng-$(date -I)
mkdir STMng
cd STMng

mkdir build dist dist-electron release doc
cp -R $d/public .
cp -R $d/resources .
cp -R $d/src .
cp -R $d/public .
cp -R $d/resources .
cp -R $d/src .

cp $d/doc/*.* doc
mkdir doc/vue doc/typedoc

cp $d/binding.gyp $d/docgen.config.js $d/electron-builder.yaml $d/eslint.config.mjs $d/eslint.yaml $d/example-project.stm $d/index.html $d/makedoc.sh $d/package.json $d/troika-three-text.d.ts $d/tsconfig.json $d/tsdoc.json $d/vite.config.mts .
