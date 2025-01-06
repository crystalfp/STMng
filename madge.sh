
for d in src/components src/ui src/widgets
do
  for f in `ls -1 $d/*.vue`
  do
    echo $f
    n=doc/madge/`basename $f .vue`.png
    madge --extensions ts,vue --ts-config tsconfig.json -i $n --warning $f
  done
done

for d in src/electron/nodes src/electron/fingerprint src/electron/modules
do
  for f in `ls -1 $d/*.ts`
  do
    echo $f
    n=doc/madge/`basename $f .ts`.png
    madge --extensions ts,vue --ts-config tsconfig.json -i $n --warning $f
  done
done
