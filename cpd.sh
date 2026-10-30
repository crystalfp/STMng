jscpd -l 20 --reporters html --skip-comments -s -f typescript,vue -o local-doc \
`/bin/find src -name "*.ts" -o -name "*.vue" | grep -v src/cpp | grep -v KDtree.mjs`
read -p "> " d
