root="src"
for i in `/bin/find $root -name "*.vue"`
do
n=`grep -c -E "@component|@author|@since" $i`
if [ $n != 3 ]
then
echo $i
fi
done

for i in `/bin/find $root -name "*.ts"`
do
n=`grep -c -E "@packageDocumentation|@author|@since" $i`
if [ $n != 3 ]
then
echo $i
fi
done
read -p "> " d
