scc --no-cocomo --wide --by-file --exclude-ext txt --exclude-dir sginfo,spglib-2.5.0,Eigen,stm4 \
--exclude-file Worker.js,KDtree.js --sort complexity --uloc --wide \
--count-as jsonc:json,gyp:py \
src public package.json tsconfig.json tsdoc.json troika-three-text.d.ts eslint.config.mjs .stylelintrc.yaml docgen.config.js .dependency-cruiser.js knip.jsonc electron-builder.yaml oxlint.json binding.gyp
read -p "> " d
