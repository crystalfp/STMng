jscpd -l 10 --reporters html --skip-comments -s \
`/bin/find src -name "*.ts" -o -name "*.vue" | grep -v src/cpp | grep -v KDtree.mjs`
read -p "> " d
