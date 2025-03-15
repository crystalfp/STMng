jscpd -l 10 `/bin/find src -name "*.ts" -o -name "*.vue" | grep -v src/cpp | grep -v KDtree.js`
read -p "> " d
