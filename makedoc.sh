# Should be explicitly run by sh
# No argument: run all
# -t: only the typescript part
# -v: only the Vue part
# -s: (future) documentation for only the .vue files
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
elif [ $1 = "-s" ]
then
	c=s
fi

root=`pwd | sed "s@/d/@/d:/@"`

if [ $c = "t" -o $c = "a" ]
then
echo "--- Extract typescript documentation"
node_modules/.bin/typedoc \
--name "See the Molecule new generation" \
--includeVersion \
--out "doc/typedoc" \
--readme none \
--validation \
--suppressCommentWarningsInDeclarationFiles \
--plugin typedoc-plugin-vue \
--plugin typedoc-plugin-missing-exports \
--placeInternalsInOwningModule \
--disableGit \
--excludeInternal \
--excludeExternals \
--sourceLinkTemplate "vscode://file$root/src/{path}:{line}:1" \
--tsconfig ./tsconfig.json \
`/bin/find src -name "*.ts" -type f | grep -v "vite-env" | grep -v "cpp/spglib" | grep -v KDtree`
fi


# if [ $c = "s" -o $c = "a" ]
# then
# echo "--- Extract SFC documentation"

# node_modules/.bin/typedoc \
# --name "See the Molecule new generation" \
# --out "doc/sfc" \
# --readme none \
# --suppressCommentWarningsInDeclarationFiles \
# --plugin typedoc-plugin-vue \
# --plugin typedoc-plugin-missing-exports \
# --disableGit \
# --excludeInternal \
# --excludeExternals \
# --placeInternalsInOwningModule \
# --sourceLinkTemplate "vscode://file$root/{path}:{line}:1" \
# --tsconfig ./tsconfig.json \
# `/bin/find "temporary-src-root" -name "*.ts" -type f`
# fi

if [ $c = "v" -o $c = "a" ]
then
echo "--- Extract Vue documentation"
node_modules/.bin/vue-docgen
if [ $? = 1 ]
then
	echo
	echo "Error creating documentation. Quitting."
	echo
	read -p ">>> " d
	exit 1
fi
pandoc -f gfm+pipe_tables -t html -s -c ../style.css -T "See the Molecule new generation" \
	--metadata title="Components" \
	--metadata abstract="Building blocks for the application." \
	--metadata lang="en" \
	--toc --toc-depth=1 \
	doc/vue/components.md | \
	sed 's/<\/nav>/<ul><li><a href="..\/index.html">Return to index<\/a><\/li><\/ul><\/nav>/' > doc/vue/components.html
pandoc -f gfm+pipe_tables -t html -s -c ../style.css -T "See the Molecule new generation" \
	--metadata title="User interface" \
	--metadata abstract="User interface modules." \
	--metadata lang="en" \
	--toc --toc-depth=1 \
	doc/vue/ui.md | \
	sed 's/<\/nav>/<ul><li><a href="..\/index.html">Return to index<\/a><\/li><\/ul><\/nav>/' > doc/vue/ui.html
pandoc -f gfm+pipe_tables -t html -s -c ../style.css -T "See the Molecule new generation" \
	--metadata title="Widgets" \
	--metadata abstract="Application-independent building blocks." \
	--metadata lang="en" \
	--toc --toc-depth=1 \
	doc/vue/widgets.md | \
	sed 's/<\/nav>/<ul><li><a href="..\/index.html">Return to index<\/a><\/li><\/ul><\/nav>/' > doc/vue/widgets.html
rm -f doc/vue/components.md doc/vue/ui.md doc/vue/widgets.md
fi

echo
read -p ">>> " d
