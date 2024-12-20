
for d in src/components src/electron/nodes
do
  for f in `ls -1 $d`
  do
    echo $f
    n=doc/madge/`basename $f .vue`.png
    madge --extensions ts,vue --ts-config tsconfig.json -i $n --warning $d/$f
  done
done
