module.exports = {

	componentsRoot: "src",
	outDir: "doc/vue",
	apiOptions: {
		addScriptHandlers: [
            function (
                documentation,
                _componentDefinition,
                astPath
            ) {

                const cd = astPath.tokens.filter(
												token => token.type === 'CommentBlock' &&
												token.value.includes('@component')
											)
				const rawValue = cd[0].value
						.replaceAll("\r", "")
						.replace(/^[*\n ]+/, "")
						.replace(/[*\n ]+$/, "")
						.replace(/^\*\n/, "")
						.replaceAll(/\n *\* */g, "\n")
						.replaceAll(/\\@/g, "#$%")
				const values = rawValue.split(/ *@/).map((item) => item.trim());

				for(const vv of values) {
					if(vv === "") continue;
					vv1 = vv.replaceAll("#$%", "@");
					if(vv1.startsWith("component")) {
						const text = vv1.replace(/^component[ \n]+/, "")
                    	documentation.set('description', text);
					}
					else if(vv1.startsWith("author")) {
						const text = vv1.replace(/^author[ \n]+/, "")
                    	documentation.set('author', text);
					}
					else if(vv1.startsWith("since")) {
						const text = vv1.replace(/^since[ \n]+/, "")
                    	documentation.set('since', text);
					}
				}
            }
        ]
	},
	templates: {
		component: (renderedUsage, doc, config, fileName, requiresMd, { isSubComponent, hasSubComponents }) => {
			const { displayName, description, docsBlocks, tags, functional, since, author } = doc;
			const { deprecated, version, see, link } = tags || {};
			const frontMatter = [];

			if(!config.outFile && deprecated) {
				// to avoid having the squiggles in the left menu for deprecated items
				// use the frontmatter feature of vuepress
				frontMatter.push(`title: ${displayName}`);
			}
			if(hasSubComponents) {
				// show more than one level on subcomponents
				frontMatter.push('sidebarDepth: 2');
			}

			return `${frontMatter.length > 0 && !isSubComponent ? `---\n${frontMatter.join('\n')}---` : ''}
  ${isSubComponent || hasSubComponents ? '#' : ''}# ${deprecated ? `~~${displayName}~~` : displayName}

  ${deprecated ? `> **Deprecated** ${deprecated[0].description}\n` : ''}
  ${description ?? ''}

  ${functional ? renderedUsage.functionalTag : ''}
  ${author ? `Author: ${author}` : ""}
  ${since ? `\\\nCreated: ${since}` : ""}
  ${version ? `Version: ${version[0].description}\n` : ''}
  ${see ? see.map(s => `[See](${s.description})\n`) : ''}
  ${link ? link.map(l => `[See](${l.description})\n`) : ''}
  ${docsBlocks ? '\n' + docsBlocks.join('\n---\n') : ''}

  ${renderedUsage.props}
  ${renderedUsage.methods}
  ${renderedUsage.events}
  ${renderedUsage.slots}

  ${requiresMd.length > 0
        ? '---\n' + requiresMd.map(component => component.content).join('\n---\n')
        : ''}
  `;
		}
	},
	pages: [
		{
		  components: "components/*.vue",
		  outFile: "components.md"
		},
		{
		  components: "ui/*.vue",
		  outFile: "ui.md"
		},
		{
		  components: "widgets/*.vue",
		  outFile: "widgets.md"
		}
	]
}
