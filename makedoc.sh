# Should be explicitly run by sh
# No argument: run all
# -t: only the typescript part
# -v: only the Vue part
#
if [ "x$1" = "x" ]
then
	c=a
elif [ $1 = "-t" ]
then
	c=t
elif [ $1 = "-v" ]
then
	c=v
fi

if [ $c != "v" ]
then
echo "--- Extract typescript documentation"
node_modules/.bin/typedoc \
--name "See the Molecule new generation" \
--out "doc/typedoc" \
--readme none \
--suppressCommentWarningsInDeclarationFiles \
--plugin typedoc-plugin-vue \
--plugin @zamiell/typedoc-plugin-not-exported \
--disableGit \
--excludeInternal \
--sourceLinkTemplate "vscode://file/D:/Projects/STMng/{path}:{line}:1" \
--tsconfig ./tsconfig.json \
`/bin/find src -name "*.ts" -type f | grep -v "vite-env"`
fi

if [ $c != "t" ]
then
echo "--- Extract Vue documentation"
node_modules/.bin/vue-docgen
if [ $? = 1 ]
then
	echo "\nError creating documentation. Quitting.\n"
	read -p ">>> " d
	exit 1
fi
pandoc -f gfm+pipe_tables -t html -s -c ../style.css -T "See the Molecule new generation" \
	--metadata title="Components" \
	--metadata abstract="Building blocks for the application." \
	--metadata lang="en" \
	--toc --toc-depth=1 \
	doc/vue/components.md | sed 's/<\/nav>/<ul><li><a href="..\/index.html">Return to index<\/a><\/li><\/ul><\/nav>/' > doc/vue/components.html
pandoc -f gfm+pipe_tables -t html -s -c ../style.css -T "See the Molecule new generation" \
	--metadata title="Widgets" \
	--metadata abstract="Application-independent building blocks." \
	--metadata lang="en" \
	--toc --toc-depth=1 \
	doc/vue/widgets.md | sed 's/<\/nav>/<ul><li><a href="..\/index.html">Return to index<\/a><\/li><\/ul><\/nav>/' > doc/vue/widgets.html
rm -f doc/vue/components.md doc/vue/widgets.md
fi

echo
read -p ">>> " d
