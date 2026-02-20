import vuePlugin from "eslint-plugin-vue";

export const vueRules = {
	...vuePlugin.configs["flat/essential"].rules,
	...vuePlugin.configs["flat/strongly-recommended"].rules,
	...vuePlugin.configs["flat/recommended"].rules,

	// "vue/first-attribute-linebreak": "off",
	// "vue/html-indent": "off",
	// "vue/max-attributes-per-line": "off",
	// "vue/html-closing-bracket-newline": "off",
	// "vue/multiline-html-element-content-newline": "off",
	// "vue/singleline-html-element-content-newline": "off",
	// "vue/no-v-html": "off",
	// "vue/multi-word-component-names": "off",
	// "vue/comment-directive": "warn",
	"vue/v-bind-style": ["warn", "shorthand", {sameNameShorthand: "always"}],
	"vue/attributes-order": "warn",
	"vue/no-undef-components": ["error", {ignorePatterns: ["^v-", "^router-"]}],
	"vue/prefer-use-template-ref": "error",
	"vue/no-unused-properties": ["error", {
		groups: ["props", "data", "computed", "methods"]
	}],
	"vue/no-unused-refs": "error",
	"vue/no-unused-emit-declarations": "error",
}
