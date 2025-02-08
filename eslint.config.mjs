import tsParser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";

import vuePlugin from "eslint-plugin-vue";
import promisePlugin from "eslint-plugin-promise";
import importPlugin from "eslint-plugin-import";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import commentsPlugin from "eslint-plugin-eslint-comments";
import unicornPlugin from "eslint-plugin-unicorn";
import securityPlugin from "eslint-plugin-security";
import deprecatePlugin from "eslint-plugin-deprecate";
import sonarjsPlugin from "eslint-plugin-sonarjs";
import regexpPlugin from "eslint-plugin-regexp";
import maxlenPlugin from "@alasdair/eslint-plugin-max-len";
import tsdocPlugin from "eslint-plugin-tsdoc";
import electronPlugin from "eslint-plugin-electron-extension";
import jsPlugin from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin";
import * as depend from "eslint-plugin-depend";

/* @type {import('eslint').Linter.Config[]} */
export default [{
    ignores: [
        "src/vite-env.d.ts",
		"src/assets"
    ]}, {
    files: [
        "src/**/*.ts",
        "src/**/*.vue",
        "eslint.config.mjs"
    ],
    languageOptions: {
        parser: vueParser,
        globals: {
            document: "readonly",
            window: "readonly",
            NodeJS: "readonly",
            expect: "readonly",
            test: "readonly",
            afterAll: "readonly",
            beforeAll: "readonly",
            describe: "readonly",
            process: "readonly",
            requestAnimationFrame: "readonly",
            setTimeout: "readonly",
            setInterval: "readonly",
            clearInterval: "readonly",
            clearTimeout: "readonly",
            console: "readonly",
            Buffer: "readonly",
            require: "readonly",
            structuredClone: "readonly",
            addEventListener: "readonly",
        },
        parserOptions: {
            parser: tsParser,
            ecmaFeatures: {impliedStrict: true},
            projectService: true,
            warnOnUnsupportedTypeScriptVersion: false,
            extraFileExtensions: ['.vue'],
            vueFeatures: {filter: false},
        }
    },
    processor: vuePlugin.processors['.vue'],
    linterOptions: {
        reportUnusedDisableDirectives: "error",
        reportUnusedInlineConfigs: "error"
    },
    plugins: {
        vue: vuePlugin,
        promise: promisePlugin,
        import: importPlugin,
        "@typescript-eslint": typescriptPlugin,
        "eslint-comments": commentsPlugin,
        unicorn: unicornPlugin,
        security: securityPlugin,
        deprecate: deprecatePlugin,
        sonarjs: sonarjsPlugin,
        regexp: regexpPlugin,
        "@alasdair/max-len": maxlenPlugin,
        tsdoc: tsdocPlugin,
        "electron-extension": electronPlugin,
        "@stylistic": stylistic,
        depend: depend,
    },
    settings: {
        "import/parsers": {"@typescript-eslint/parser": [".ts", ".tsx"]},
        "import/extensions": [".js", ".ts", ".vue", ".mts"],
        "import/ignore": ["node_modules"],
        "import/resolver": {
            "typescript": {"alwaysTryTypes": true},
            "alias": {"map": {"@/": "./src/"},
            "extensions": [".vue", ".ts"]}
        }
    },
    rules: {
        ...jsPlugin.configs.recommended.rules,
        ...commentsPlugin.configs.recommended.rules,
        ...promisePlugin.configs.recommended.rules,
        ...importPlugin.configs.recommended.rules,
        ...importPlugin.configs.typescript.rules,
        ...unicornPlugin.configs.recommended.rules,
        ...securityPlugin.configs.recommended.rules,
        ...securityPlugin.configs["recommended-legacy"].rules,
        ...sonarjsPlugin.configs.recommended.rules,
        ...regexpPlugin.configs.recommended.rules,
        ...vuePlugin.configs["flat/essential"].rules,
        ...vuePlugin.configs["flat/strongly-recommended"].rules,
        ...vuePlugin.configs["flat/recommended"].rules,
        ...typescriptPlugin.configs.recommended.rules,
        ...typescriptPlugin.configs["recommended-type-checked"].rules,
        ...typescriptPlugin.configs["stylistic-type-checked"].rules,
        ...typescriptPlugin.configs["strict-type-checked"].rules,
        ...depend.configs["flat/recommended"].rules,

        // "@typescript-eslint/consistent-type-assertions": ["warn", {assertionStyle: "as"}],
        // "@typescript-eslint/array-type": ["warn", {default: "array", readonly: "array"}],

        "@typescript-eslint/no-unnecessary-condition": "off",
        "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
        "@typescript-eslint/restrict-template-expressions": ["warn", {allowNumber: true}],

        // "max-len": ["off", 130],
        // "@alasdair/max-len/max-len": ["warn", {
        //         code: 130,
        //         ignoreTrailingComments: true,
        //         ignoreUrls: true,
        //         ignoreStrings: true,
        //         ignoreTemplateLiterals: true,
        //         ignoreRegExpLiterals: true
        //     }
        // ],
        // "no-dupe-class-members": "off",
        "@typescript-eslint/no-dupe-class-members": "error",
        // "no-buffer-constructor": "error",
        // "no-redeclare": ["off", {builtinGlobals: true}],
        // "@typescript-eslint/no-redeclare": ["error", {builtinGlobals: true}],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "error",
        // "no-empty-function": "off",
        // "@typescript-eslint/no-empty-function": "warn",
        "no-useless-constructor": "off",
        "@typescript-eslint/no-useless-constructor": "warn",
        // "lines-between-class-members": "off",
        // "@typescript-eslint/lines-between-class-members": "off",
        "@stylistic/quotes": ["warn", "double", {avoidEscape: true}],
        // "no-loop-func": "off",
        // "@typescript-eslint/no-loop-func": "error",
        "no-unused-expressions": "off",
        "@typescript-eslint/no-unused-expressions": "warn",
        "@stylistic/space-before-function-paren": [
            "error", {anonymous: "never", named: "never", asyncArrow: "always"}
        ],
        // "no-shadow": "off",
        // "@typescript-eslint/no-shadow": [
        //     "error", {hoist: "all", builtinGlobals: true, allow: ["event", "self", "window"]}
        // ],
        "@stylistic/comma-spacing": ["error", {before: false, after: true}],
        // "keyword-spacing": "off",
        // "@typescript-eslint/keyword-spacing": ["off",
        //     {before: true, after: false, overrides: {
        //             else: {after: true},
        //             return: {after: true},
        //             try: {after: true},
        //             catch: {after: false},
        //             case: {after: true},
        //             const: {after: true},
        //             throw: {after: true},
        //             let: {after: true},
        //             do: {after: true},
        //             of: {after: true},
        //             as: {after: true},
        //             finally: {after: true},
        //             from: {after: true},
        //             import: {after: true},
        //             export: {after: true},
        //             default: {after: true},
        //         }
        //     }
        // ],
        "@stylistic/object-curly-spacing": ["warn"],
        "@stylistic/brace-style": ["warn", "stroustrup", {allowSingleLine: true}],
        // "comma-dangle": ["off", "never"],
        // "@typescript-eslint/comma-dangle": ["off", {arrays: "only-multiline", objects: "only-multiline"}],
        // "no-implicit-coercion": "error",
        // "no-undef": "error",
        // "no-extend-native": "error",
        // "no-sequences": "error",
        // "no-new": "error",
        // "no-bitwise": "off",
        // "no-unsafe-negation": ["warn", {enforceForOrderingRelations: true}],
        "eqeqeq": ["error", "always"],
        // "strict": ["error", "global"],
        // "max-params": ["warn", 6],
        // "space-before-blocks": "warn",
        "no-unused-private-class-members": "error",
        // "guard-for-in": "off",
        // "no-unneeded-ternary": "warn",
        // "no-trailing-spaces": "warn",
        // "id-length": ["warn", {exceptions: [
        //                             "i", "j", "k", "x", "y", "z", "n",
        //                             "w", "h", "r", "g", "a", "b", "c", "t", "v"
        //                        ]}],
        "prefer-const": "warn",
        // "for-direction": "error",
        // "no-template-curly-in-string": "error",
        // "consistent-return": "off",
        // "@typescript-eslint/consistent-return": ["error", {treatUndefinedAsUnspecified: true}],
        // "no-unmodified-loop-condition": "error",
        // "array-bracket-spacing": ["warn", "never"],
        // "spaced-comment": ["warn", "always", {markers: [":", "-", "+", "::", "/"]}],
        // "no-var": "error",
        // "block-scoped-var": "error",
        // "yoda": "error",
        "camelcase": ["warn", {properties: "never"}],
        // "max-depth": ["warn", 8],
        // "arrow-parens": "error",
        "no-confusing-arrow": ["error", {allowParens: true}],
        // "dot-location": ["error", "property"],
        // "no-else-return": "error",
        // "no-throw-literal": "off",
        // "@typescript-eslint/only-throw-error": "error",
        // "require-await": "off",
        // "@typescript-eslint/require-await": "error",
        // "no-return-await": "off",
        // "@typescript-eslint/return-await": "error",
        // "dot-notation": "off",
        // "@typescript-eslint/dot-notation": "off",
        "eol-last": ["error", "always"],
        // "newline-per-chained-call": ["error", {ignoreChainWithDepth: 3}],
        // "nonblock-statement-body-position": ["warn", "beside"],
        // "space-infix-ops": "off",
        // "@typescript-eslint/space-infix-ops": "off",
        "semi-spacing": "error",
        // "operator-assignment": ["error", "always"],
        // "object-shorthand": ["error", "properties", {avoidQuotes: true}],
        // "no-process-exit": "off",
        "no-negated-condition": "warn",
        // "no-constant-condition": ["error", {checkLoops: false}],
        // "prefer-destructuring": ["error", {
        //         VariableDeclarator: {"array": false, "object": true},
        //         AssignmentExpression: {"array": false, "object": false}
        //     },
        //     {enforceForRenamedProperties: false}
        // ],
        "@stylistic/no-extra-parens": ["warn", "functions"],
        // "no-invalid-this": "off",
        // "@typescript-eslint/no-invalid-this": ["off", {capIsConstructor: false}],
        // "prefer-template": "off",
        "@stylistic/semi": ["error", "always"],
        // "@typescript-eslint/explicit-function-return-type": ["warn", {allowExpressions: true}],
        // "@typescript-eslint/method-signature-style": "warn",
        // "@typescript-eslint/prefer-includes": "warn",
        // "@typescript-eslint/prefer-nullish-coalescing": "warn",
        // "@typescript-eslint/prefer-optional-chain": "warn",
        // "@typescript-eslint/no-base-to-string": "warn",
        // "@typescript-eslint/non-nullable-type-assertion-style": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        // "@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",
        // "@typescript-eslint/prefer-readonly": "warn",
        // "@typescript-eslint/prefer-readonly-parameter-types": "off",
        "@typescript-eslint/no-confusing-void-expression": ["off", {ignoreArrowShorthand: true}],
        // "@typescript-eslint/explicit-member-accessibility": ["warn", {
        //         accessibility: "explicit",
        //         overrides: {
        //             constructors: "no-public",
        //             properties: "explicit",
        //             parameterProperties: "explicit",
        //             methods: "no-public",
        //             accessors: "no-public"
        //         }
        //     }
        // ],
        // "@typescript-eslint/no-import-type-side-effects": "error",
        "no-multiple-empty-lines": ["warn", {max: 2, maxEOF: 1}],
        // "prefer-arrow-callback": "warn",
        // "array-callback-return": ["error", {allowImplicit: true}],

        // "init-declarations": "off",
        // "@typescript-eslint/init-declarations": "off",
        "@stylistic/func-call-spacing": "warn",
        // "default-param-last": "off",
        // "@typescript-eslint/default-param-last": "warn",
        // "vue/first-attribute-linebreak": "off",
        // "vue/html-indent": "off",
        // "vue/max-attributes-per-line": "off",
        // "vue/html-closing-bracket-newline": "off",
        // "vue/multiline-html-element-content-newline": "off",
        // "vue/singleline-html-element-content-newline": "off",
        // "vue/no-v-html": "off",
        // "vue/multi-word-component-names": "off",
        // "vue/comment-directive": "warn",
        // "import/no-cycle": "off",
        // "import/namespace": "off",
        "import/default": "off",
        // "import/no-named-as-default": "off",
        // "import/no-named-as-default-member": "off",
        // "unicorn/no-keyword-prefix": ["warn", {checkProperties: false}],
        // "unicorn/prefer-array-some": "warn",
        // "unicorn/prefer-default-parameters": "warn",
        // "unicorn/prefer-array-index-of": "warn",
        // "unicorn/prefer-regexp-test": "warn",
        // "unicorn/consistent-destructuring": "warn",
        // "unicorn/prefer-string-starts-ends-with": "warn",
        // "@typescript-eslint/prefer-string-starts-ends-with": "warn",
        "unicorn/numeric-separators-style": ["off", {number: {onlyIfContainsSeparator: true, minimumDigits: 3}}],
        // "unicorn/no-console-spaces": "warn",
        // "unicorn/prefer-string-replace-all": "warn",
        "unicorn/prevent-abbreviations": ["warn", {
                replacements: {
                    len: false,
                    params: false,
                    doc: false,
                    pkg: false,
                    ctx: false,
                    i: false,
                    j: false,
                    idx: false,
                    args: false,
                    dir: false,
                    props: false,
                    db: false,
                    obj: false,
                    ext: false,
                    dist: false
                },
                checkFilenames: false
            }
        ],
        // "unicorn/template-indent": ["warn", {indent: 4}],

        "unicorn/prefer-top-level-await": "off",
        "unicorn/no-zero-fractions": "off",
        "unicorn/no-for-loop": "off",
        "promise/catch-or-return": ["warn", {allowFinally: true}],
        // "deprecate/function": "warn",
        // "deprecate/member-expression": "warn",
        // "deprecate/import": "off",
        "@stylistic/member-delimiter-style": "warn",
        "tsdoc/syntax": "warn",
        // "no-fallthrough": ["error", {allowEmptyCase: true, commentPattern: "[Ff]alls?\\s?through"}],
        // "electron-extension/no-incompatible-api": "warn",
        // "no-loss-of-precision": "off",
        // "@typescript-eslint/no-loss-of-precision": "error",
        "promise/always-return": "off",
        // "no-mixed-spaces-and-tabs": "off",
        "unicorn/filename-case": ["off", {case: "camelCase"}],
        "unicorn/throw-new-error": "off",
        "unicorn/new-for-builtins": "off",
        // "unicorn/expiring-todo-comments": "off",
        "security/detect-non-literal-fs-filename": "off",
        "security/detect-object-injection": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "sonarjs/cognitive-complexity": ["off", 40],
        // "sonarjs/no-duplicate-string": ["off", 6],
        // "sonarjs/elseif-without-else": "off",
        // "sonarjs/no-nested-switch": "off",
        "sonarjs/no-commented-code": "warn",
        "sonarjs/void-use": "off",
        "sonarjs/different-types-comparison": "off",
        // "unicorn/better-regex": "off",
        // "unicorn/no-null": "off",
        // "unicorn/prefer-add-event-listener": "warn",
        "unicorn/switch-case-braces": "off",
        // "@typescript-eslint/no-unsafe-enum-comparison": "off",

        // "arrow-body-style": "warn",
        // "sonarjs/sonar-no-fallthrough": "off",

        // "sonarjs/no-gratuitous-expressions": "warn",
        // "sonarjs/no-empty-collection": "warn",
        // "sonarjs/no-unused-collection": "warn",
        // "sonarjs/no-use-of-empty-return-value": "warn",
        // "sonarjs/no-extra-arguments": "warn",
        // "sonarjs/no-redundant-jump": "warn",
        // "sonarjs/no-one-iteration-loop": "warn",
        // "promise/no-return-wrap": "warn",
        // "promise/no-promise-in-callback": "warn",
        // "promise/no-nesting": "warn",
        // "promise/no-callback-in-promise": "warn",
        // "security/detect-child-process": "warn",

        "@stylistic/array-bracket-newline": ["warn", "consistent"],
        "@stylistic/array-bracket-spacing": ["warn", "never"],
        "@stylistic/arrow-parens": ["warn", "always"],

        // "depend/ban-dependencies": ["error", {
        //                             "presets": ["native", "microutilities", "preferred"]
        // }],
        // "@typescript-eslint/consistent-type-imports": "error",
        "sonarjs/no-unenclosed-multiline-block": "off",

        // "@typescript-eslint/no-misused-promises": "error",
        // "@typescript-eslint/no-floating-promises": "error"
        "sonarjs/fixme-tag": "off",
    }
}];
