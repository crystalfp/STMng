module.exports = {

	componentsRoot: "src",
	outDir: "doc/vue",
	apiOptions: {
		addScriptHandlers: [
            function (
                documentation,
                componentDefinition,
                astPath,
                opt
            ) {
                const componentDoc = astPath.tokens
											.filter(
												token => token.type === 'CommentBlock' &&
												token.value.includes('@component')
											)
											.find(() => true);
                if(componentDoc) {
					const text = componentDoc.value
						.replaceAll("\r", "")
						.replace(/^\*\n/, "\n")
						.replace(/\n +\* +@component */, "")
						.replace(/\n +\* +@remarks */, "\n\n**Note:** ")
						.replaceAll(/\n +\* +([^-])/g, " $1")
						.replaceAll(/\n +\* -/g, "\n-")
						.replace(/[*\n ]+$/, "")
						.replace(/^[\n ]+/, "")
						.replaceAll(" *", "")
                    documentation.set('description', text);
                }
            }
        ]
	},
	templates: {
		component: (renderedUsage, doc, config, fileName, requiresMd, { isSubComponent, hasSubComponents }) => {
			const { displayName, description, docsBlocks, tags, functional } = doc;
			const { deprecated, author, since, version, see, link } = tags || {};
			const frontMatter = [];
			if (!config.outFile && deprecated) {
				// to avoid having the squiggles in the left menu for deprecated items
				// use the frontmatter feature of vuepress
				frontMatter.push(`title: ${displayName}`);
			}
			if (hasSubComponents) {
				// show more than one level on subcomponents
				frontMatter.push('sidebarDepth: 2');
			}
			return `${frontMatter.length && !isSubComponent ? `---\n${frontMatter.join('\n')}---` : ''}
  ${isSubComponent || hasSubComponents ? '#' : ''}# ${deprecated ? `~~${displayName}~~` : displayName}

  ${deprecated ? `> **Deprecated** ${deprecated[0].description}\n` : ''}
  ${description ? description : ''}

  ${functional ? renderedUsage.functionalTag : ''}
  ${author ? author.map(a => `Author: ${a.description}\n`) : ''}
  ${since ? `Since: ${since[0].description}\n` : ''}
  ${version ? `Version: ${version[0].description}\n` : ''}
  ${see ? see.map(s => `[See](${s.description})\n`) : ''}
  ${link ? link.map(l => `[See](${l.description})\n`) : ''}
  ${docsBlocks ? '\n' + docsBlocks.join('\n---\n') : ''}

  ${renderedUsage.props}
  ${renderedUsage.methods}
  ${renderedUsage.events}
  ${renderedUsage.slots}

  ${requiresMd.length
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
		  components: "widgets/*.vue",
		  outFile: "widgets.md"
		}
	]
}
