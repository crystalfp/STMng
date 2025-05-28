import {defineConfig} from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";

import vuePlugin from "eslint-plugin-vue";
import promisePlugin from "eslint-plugin-promise";
import importPlugin from "eslint-plugin-import";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import commentsPlugin from "eslint-plugin-eslint-comments";
import unicornPlugin from "eslint-plugin-unicorn";
import securityPlugin from "eslint-plugin-security";
import sonarjsPlugin from "eslint-plugin-sonarjs";
import regexpPlugin from "eslint-plugin-regexp";
import tsdocPlugin from "eslint-plugin-tsdoc";
import jsPlugin from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin";
import * as depend from "eslint-plugin-depend";

export default defineConfig([
    stylistic.configs.customize({
        flat: true, // required for flat config
        indent: 4,
        quotes: "double",
        semi: true,
        jsx: false,
        blockSpacing: false,
        arrowParens: true,
    }), {
    ignores: [
        "src/vite-env.d.ts",
		"src/assets",
        "src/cpp",
        "src/electron/fingerprint/rollup.config.mjs",
        "src/electron/fingerprint/KDtree.js"
    ]}, {
    files: [
        "src/**/*.ts",
        "src/**/*.vue",
        "eslint.config.mjs",
        "vite.config.mts"
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
            structuredClone: "readonly",
            addEventListener: "readonly",
        },
        parserOptions: {
            parser: tsParser,
            ecmaFeatures: {impliedStrict: true},
            projectService: true,
            warnOnUnsupportedTypeScriptVersion: false,
            extraFileExtensions: [".vue"],
            vueFeatures: {filter: false},
        }
    },
    processor: vuePlugin.processors[".vue"],
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
        sonarjs: sonarjsPlugin,
        regexp: regexpPlugin,
        tsdoc: tsdocPlugin,
        "@stylistic": stylistic,
        depend: depend,
    },
    settings: {
        "import/parsers": {"@typescript-eslint/parser": [".ts", ".tsx", ".mts"]},
        "import/extensions": [".js", ".ts", ".vue", ".mts", ".mjs"],
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
        ...unicornPlugin.configs.all.rules,
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

        // > ******************* language rules ***********************
        "no-unassigned-vars": "warn",

        // "@typescript-eslint/consistent-type-assertions": ["warn", {assertionStyle: "as"}],
        // "@typescript-eslint/array-type": ["warn", {default: "array", readonly: "array"}],
        "@typescript-eslint/no-unnecessary-condition": "off",
        "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
        "@typescript-eslint/restrict-template-expressions": ["warn", {allowNumber: true}],

        // "max-len": ["off", 130],
        "no-dupe-class-members": "error",
        // "no-buffer-constructor": "error",
        // "no-redeclare": ["off", {builtinGlobals: true}],
        // "@typescript-eslint/no-redeclare": ["error", {builtinGlobals: true}],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["error", {
            "args": "all",
            "argsIgnorePattern": "^_",
            "caughtErrors": "all",
            "caughtErrorsIgnorePattern": "^_",
            "destructuredArrayIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "ignoreRestSiblings": true
        }],
        "no-empty-function": "warn",
        "no-useless-constructor": "warn",

        "no-loop-func": "warn",
        "no-unused-expressions": "warn",
        // "no-shadow": "off",
        // "@typescript-eslint/no-shadow": [
        //     "error", {hoist: "all", builtinGlobals: true, allow: ["event", "self", "window"]}
        // ],
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
        // "no-var": "error",
        // "block-scoped-var": "error",
        // "yoda": "error",
        "camelcase": ["warn", {properties: "never"}],
        // "max-depth": ["warn", 8],
        // "arrow-parens": "error",
        "no-confusing-arrow": ["error", {allowParens: true}],
        // "dot-location": ["error", "property"],
        "no-else-return": "error",
        "no-array-constructor": "error",
        // "class-methods-use-this": "warn",
        // "no-throw-literal": "off",
        // "@typescript-eslint/only-throw-error": "error",
        // "require-await": "off",
        // "@typescript-eslint/require-await": "error",
        // "no-return-await": "off",
        // "@typescript-eslint/return-await": "error",
        // "dot-notation": "off",
        // "@typescript-eslint/dot-notation": "off",
        // "newline-per-chained-call": ["error", {ignoreChainWithDepth: 3}],
        // "nonblock-statement-body-position": ["warn", "beside"],
        // "space-infix-ops": "off",
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
        "no-invalid-this": "warn",
        // "@typescript-eslint/no-invalid-this": ["off", {capIsConstructor: false}],
        // "prefer-template": "off",
        "@typescript-eslint/explicit-function-return-type": ["warn", {allowExpressions: true}],
        // "@typescript-eslint/method-signature-style": "warn",
        "@typescript-eslint/prefer-includes": "warn",
        "@typescript-eslint/prefer-nullish-coalescing": "warn",
        "@typescript-eslint/prefer-optional-chain": "warn",
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
        // "prefer-arrow-callback": "warn",
        // "array-callback-return": ["error", {allowImplicit: true}],
        // "init-declarations": "off",
        // "@typescript-eslint/init-declarations": "off",
        "default-param-last": "warn",
        // "@typescript-eslint/no-unsafe-enum-comparison": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        // "arrow-body-style": "warn",
        // "@typescript-eslint/consistent-type-imports": "error",
        // "@typescript-eslint/no-misused-promises": "error",
        // "@typescript-eslint/no-floating-promises": "error"
        // "@typescript-eslint/prefer-string-starts-ends-with": "warn",
        // "no-fallthrough": ["error", {allowEmptyCase: true, commentPattern: "[Ff]alls?\\s?through"}],
        "no-loss-of-precision": "error",
        // "no-mixed-spaces-and-tabs": "off",

        // > ******************* stylistic ***********************
        "@stylistic/lines-between-class-members": "warn",
        "@stylistic/quotes": ["warn", "double", {avoidEscape: true}],
        "@stylistic/space-before-function-paren": [
            "error", {anonymous: "never", named: "never", asyncArrow: "always"}
        ],
        "@stylistic/comma-spacing": ["error", {before: false, after: true}],
        "@stylistic/keyword-spacing": ["warn", {before: true, after: true, overrides: {
            if: {after: false},
            switch: {after: false},
            catch: {after: false},
            while: {after: false},
            for: {after: false},
        }}],
        "@stylistic/object-curly-spacing": ["warn", "never"],
        "@stylistic/brace-style": ["warn", "stroustrup", {allowSingleLine: true}],
        "@stylistic/no-multi-spaces": "off",
        "@stylistic/multiline-ternary": "off",
        "@stylistic/operator-linebreak": "off",
        "@stylistic/indent-binary-ops": "off",
        "@stylistic/key-spacing": "off",
        "@stylistic/max-statements-per-line": ["warn", {"max": 2}],
        "@stylistic/comma-dangle": ["off", {arrays: "only-multiline", objects: "only-multiline"}],
        "@stylistic/spaced-comment": ["warn", "always", {markers: [":", "-", "+", "::", "/"]}],
        "@stylistic/space-infix-ops": "off",
        "@stylistic/semi-spacing": "error",
        "@stylistic/no-extra-semi": "error",
        "@stylistic/no-extra-parens": ["warn", "functions"],
        "@stylistic/semi": ["error", "always"],
        "@stylistic/no-multiple-empty-lines": ["warn", {max: 2, maxEOF: 1, maxBOF: 0}],
        "@stylistic/padded-blocks": "off",
        "@stylistic/indent": "off",
        "@stylistic/no-tabs": "off",
        "@stylistic/no-mixed-spaces-and-tabs": "off",
        "@stylistic/func-call-spacing": "warn",
        "@stylistic/member-delimiter-style": "warn",
        "@stylistic/array-bracket-newline": ["warn", "consistent"],
        "@stylistic/array-bracket-spacing": ["warn", "never"],
        "@stylistic/arrow-parens": ["warn", "always"],
        "@stylistic/yield-star-spacing": ["error", {after: true, before: false}],
        "@stylistic/generator-star-spacing": ["error", {after: true, before: false}],
        "@stylistic/eol-last": ["error", "always"],
        "@stylistic/new-parens": "error",

        // > ******************* unicorn ***********************
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
        "unicorn/prefer-import-meta-properties": "off",
        // "unicorn/no-keyword-prefix": ["warn", {checkProperties: false}],
        // "unicorn/prefer-array-some": "warn",
        // "unicorn/prefer-default-parameters": "warn",
        // "unicorn/prefer-array-index-of": "warn",
        // "unicorn/prefer-regexp-test": "warn",
        // "unicorn/consistent-destructuring": "warn",
        // "unicorn/prefer-string-starts-ends-with": "warn",
        "unicorn/filename-case": ["off", {case: "camelCase"}],
        "unicorn/throw-new-error": "off",
        "unicorn/new-for-builtins": "off",
        // "unicorn/expiring-todo-comments": "off",
        // "unicorn/better-regex": "off",
        // "unicorn/no-null": "off",
        // "unicorn/prefer-add-event-listener": "warn",
        "unicorn/switch-case-braces": "off",

        // > ******************* sonarjs ***********************
        "sonarjs/cognitive-complexity": ["off", 40],
        // "sonarjs/no-duplicate-string": ["off", 6],
        // "sonarjs/elseif-without-else": "off",
        // "sonarjs/no-nested-switch": "off",
        "sonarjs/no-commented-code": "warn",
        "sonarjs/void-use": "off",
        "sonarjs/different-types-comparison": "off",
        // "sonarjs/sonar-no-fallthrough": "off",
        // "sonarjs/no-gratuitous-expressions": "warn",
        // "sonarjs/no-empty-collection": "warn",
        // "sonarjs/no-unused-collection": "warn",
        // "sonarjs/no-use-of-empty-return-value": "warn",
        // "sonarjs/no-extra-arguments": "warn",
        // "sonarjs/no-redundant-jump": "warn",
        // "sonarjs/no-one-iteration-loop": "warn",
        "sonarjs/no-unenclosed-multiline-block": "off",
        "sonarjs/fixme-tag": "off",

        // > ******************* other plugins ***********************
        // "promise/no-return-wrap": "warn",
        // "promise/no-promise-in-callback": "warn",
        // "promise/no-nesting": "warn",
        // "promise/no-callback-in-promise": "warn",
        // "security/detect-child-process": "warn",
        // "depend/ban-dependencies": ["error", {
        //                             "presets": ["native", "microutilities", "preferred"]
        // }],
        // "vue/first-attribute-linebreak": "off",
        // "vue/html-indent": "off",
        // "vue/max-attributes-per-line": "off",
        // "vue/html-closing-bracket-newline": "off",
        // "vue/multiline-html-element-content-newline": "off",
        // "vue/singleline-html-element-content-newline": "off",
        // "vue/no-v-html": "off",
        // "vue/multi-word-component-names": "off",
        // "vue/comment-directive": "warn",
        // "import/no-cycle": "error",
        "import/no-unresolved": "error",
        // "import/namespace": "off",
        // "import/no-named-as-default": "off",
        // "import/no-named-as-default-member": "off",
        "vue/v-bind-style": ["warn", "shorthand", {"sameNameShorthand": "always"}],
        "vue/attributes-order": "warn",
        "import/default": "off",
        "tsdoc/syntax": "warn",
        "promise/always-return": "off",
        "promise/catch-or-return": ["warn", {allowFinally: true}],
        "security/detect-non-literal-fs-filename": "off",
        "security/detect-object-injection": "off",
    }
}]);
