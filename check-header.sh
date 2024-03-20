for i in `/bin/find src -name "*.vue"`
do
n=`grep -c @component $i`
if [ $n != 1 ]
then
echo $i
fi
done

for i in `/bin/find src -name "*.ts"`
do
n=`grep -c @packageDocumentation $i`
if [ $n != 1 ]
then
echo $i
fi
done
read -p "> " d
