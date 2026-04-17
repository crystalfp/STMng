import {defineConfig} from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";

import vuePlugin from "eslint-plugin-vue";
// import promisePlugin from "eslint-plugin-promise";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import commentsPlugin from "@eslint-community/eslint-plugin-eslint-comments";
import unicornPlugin from "eslint-plugin-unicorn";
import securityPlugin from "eslint-plugin-security";
import sonarjsPlugin from "eslint-plugin-sonarjs";
import regexpPlugin from "eslint-plugin-regexp";
import tsdocPlugin from "eslint-plugin-tsdoc";
import jsPlugin from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import depend from "eslint-plugin-depend";
import {createNodeResolver, importX} from "eslint-plugin-import-x";
import {createTypeScriptImportResolver} from "eslint-import-resolver-typescript";

import {vueRules} from "./eslint.vue.config.mjs";

export default defineConfig([
    stylistic.configs.customize({
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
        "src/electron/fingerprint/rolldown.config.mjs",
        "src/electron/fingerprint/KDtree.js",
        "src/electron/fingerprint/.rollup.cache/**",
    ]}, {
    files: [
        "src/**/*.ts",
        "src/**/*.vue",
        "eslint.config.mjs",
        "eslint.vue.config.mjs",
        "vite.config.mts"
    ],
    languageOptions: {
        parser: vueParser,
        ecmaVersion: "latest",
        globals: {
            document: "readonly",
            window: "readonly",
            NodeJS: "readonly",
            test: "readonly",
            afterAll: "readonly",
            beforeAll: "readonly",
            describe: "readonly",
            process: "readonly",
            setTimeout: "readonly",
            setInterval: "readonly",
            clearInterval: "readonly",
            clearTimeout: "readonly",
            console: "readonly",
            Buffer: "readonly",
            structuredClone: "readonly",
            addEventListener: "readonly",
            ResizeObserver: "readonly",
            defineProps: "readonly",
            defineEmits: "readonly",
            defineModel: "readonly",
            withDefaults: "readonly"
        },
        parserOptions: {
            parser: tsParser,
            ecmaFeatures: {impliedStrict: true},
            projectService: {
                defaultProject: "tsconfig.json",
            },
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
        // promise: promisePlugin,
        "import-x": importX,
        "@typescript-eslint": typescriptPlugin,
        unicorn: unicornPlugin,
        security: securityPlugin,
        sonarjs: sonarjsPlugin,
        regexp: regexpPlugin,
        tsdoc: tsdocPlugin,
        "@stylistic": stylistic,
        depend: depend,
        "@eslint-community/eslint-comments": commentsPlugin,
        "@eslint/js": jsPlugin,
    },
    settings: {
        "import-x/parsers": {"@typescript-eslint/parser": [".ts", ".tsx", ".mts"]},
        "import-x/extensions": [".js", ".ts", ".vue", ".mts", ".mjs"],
        "import-x/ignore": ["node_modules"],
        "import-x/core-modules": ["electron"],
        "import-x/resolver-next": [
            createTypeScriptImportResolver(),
            createNodeResolver()
        ]
    },
    rules: {
        ...jsPlugin.configs.recommended.rules,
        ...commentsPlugin.configs.recommended.rules,
        // ...promisePlugin.configs.recommended.rules,
        ...importX.flatConfigs.recommended.rules,
        ...importX.flatConfigs.typescript.rules,
        ...unicornPlugin.configs.all.rules,
        ...securityPlugin.configs.recommended.rules,
        ...sonarjsPlugin.configs.recommended.rules,
        ...regexpPlugin.configs.recommended.rules,
        ...typescriptPlugin.configs.recommended.rules,
        ...typescriptPlugin.configs["recommended-type-checked"].rules,
        ...typescriptPlugin.configs["stylistic-type-checked"].rules,
        ...typescriptPlugin.configs["strict-type-checked"].rules,
        // oxlint-disable-next-line no-named-as-default-member
        ...depend.configs["flat/recommended"].rules,


        // > ******************* unified rules ***********************
        ...vueRules,

        // > ******************* language rules ***********************
        "@typescript-eslint/consistent-type-assertions": ["warn", {assertionStyle: "as"}],
        "@typescript-eslint/array-type": ["warn", {default: "array", readonly: "array"}],
        "@typescript-eslint/no-unnecessary-condition": "off",
        "@typescript-eslint/restrict-template-expressions": ["warn", {allowNumber: true}],

        // "max-len": ["off", 130],
        "no-dupe-class-members": "error",
        // "no-buffer-constructor": "error",
        "no-redeclare": ["off", {builtinGlobals: true}],
        "@typescript-eslint/no-redeclare": ["error", {builtinGlobals: true}],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["error", {
            vars: "all",
            args: "all",
            argsIgnorePattern: "^_",
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
            destructuredArrayIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            ignoreRestSiblings: true
        }],
        "no-empty-function": "warn",
        "no-useless-constructor": "warn",

        "no-loop-func": "warn",
        "no-unused-expressions": "warn",
        "no-shadow": "off",
        "@typescript-eslint/no-shadow": [
            "error", {hoist: "functions-and-types"}
        ],
        "no-restricted-syntax": ["error", "BinaryExpression[operator='in']"],
        // "no-implicit-coercion": "error",
        // "no-undef": "error",
        // "no-extend-native": "error",
        // "no-sequences": "error",
        // "no-new": "error",
        // "no-bitwise": "off",
        // "no-unsafe-negation": ["warn", {enforceForOrderingRelations: true}],
        eqeqeq: ["error", "always"],
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
        camelcase: ["warn", {properties: "never"}],
        // "max-depth": ["warn", 8],
        // "arrow-parens": "error",
        "no-confusing-arrow": ["error", {allowParens: true}],
        // "dot-location": ["error", "property"],
        "no-else-return": "error",
        "no-array-constructor": "error",
        // "class-methods-use-this": "warn",
        // "no-throw-literal": "off",
        "require-await": "off",
        "@typescript-eslint/require-await": "error",
        "no-return-await": "off",
        "@typescript-eslint/return-await": "error",
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
        "no-invalid-this": "off",
        "@typescript-eslint/no-invalid-this": ["error", {capIsConstructor: false}],
        // "prefer-template": "off",
        "@typescript-eslint/explicit-function-return-type": ["warn", {allowExpressions: true}],
        // "@typescript-eslint/method-signature-style": "warn",
        "@typescript-eslint/prefer-includes": "warn",
        "@typescript-eslint/prefer-nullish-coalescing": "warn",
        "@typescript-eslint/prefer-optional-chain": "warn",
        // "@typescript-eslint/prefer-readonly": "warn",
        // "@typescript-eslint/prefer-readonly-parameter-types": "off",
        "@typescript-eslint/no-confusing-void-expression": ["error", {ignoreArrowShorthand: true}],
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
        "@typescript-eslint/no-non-null-assertion": "off",
        // "arrow-body-style": "warn",
        // "@typescript-eslint/consistent-type-imports": "error",
        // "@typescript-eslint/prefer-string-starts-ends-with": "warn",
        // "no-fallthrough": ["error", {allowEmptyCase: true, commentPattern: "[Ff]alls?\\s?through"}],
        "no-loss-of-precision": "error",
        // "no-mixed-spaces-and-tabs": "off",
        "no-duplicate-imports": ["error", {allowSeparateTypeImports: true}],

        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/no-array-delete": "error",
        "@typescript-eslint/no-base-to-string": "error",
        "@typescript-eslint/no-duplicate-type-constituents": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-for-in-array": "error",
        "@typescript-eslint/no-implied-eval": "error",
        "@typescript-eslint/no-meaningless-void-operator": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/no-misused-spread": "error",
        "@typescript-eslint/no-mixed-enums": "error",
        "@typescript-eslint/no-redundant-type-constituents": "error",
        "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
        "@typescript-eslint/no-unnecessary-template-expression": "error",
        "@typescript-eslint/no-unnecessary-type-arguments": "error",
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-unsafe-enum-comparison": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-return": "error",
        "@typescript-eslint/no-unsafe-type-assertion": "off",
        "@typescript-eslint/no-unsafe-unary-minus": "error",
        "@typescript-eslint/non-nullable-type-assertion-style": "error",
        "@typescript-eslint/only-throw-error": "error",
        "@typescript-eslint/prefer-promise-reject-errors": "error",
        "@typescript-eslint/prefer-reduce-type-parameter": "error",
        "@typescript-eslint/prefer-return-this-type": "error",
        "@typescript-eslint/promise-function-async": "error",
        "@typescript-eslint/related-getter-setter-pairs": "error",
        "@typescript-eslint/require-array-sort-compare": "error",
        "@typescript-eslint/restrict-plus-operands": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/unbound-method": "error",
        "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
        "no-dupe-keys": "error",
        "@typescript-eslint/no-useless-default-assignment": "warn",
        "@typescript-eslint/no-deprecated": "warn",
        "@typescript-eslint/consistent-generic-constructors": "warn",

        // > ******************* stylistic ***********************
        "@stylistic/lines-between-class-members": "warn",
        "@stylistic/quotes": ["warn", "double", {avoidEscape: true}],
        "@stylistic/space-before-function-paren": [
            "error", {anonymous: "never", named: "never", asyncArrow: "always", catch: "never"}
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
        "@stylistic/max-statements-per-line": ["warn", {max: 2}],
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
        "@stylistic/member-delimiter-style": "warn",
        "@stylistic/array-bracket-newline": ["warn", "consistent"],
        "@stylistic/array-bracket-spacing": ["warn", "never"],
        "@stylistic/arrow-parens": ["warn", "always"],
        "@stylistic/yield-star-spacing": ["error", {after: true, before: false}],
        "@stylistic/generator-star-spacing": ["error", {after: true, before: false}],
        "@stylistic/eol-last": ["error", "always"],
        "@stylistic/new-parens": "error",
        "@stylistic/quote-props": ["warn", "as-needed"],

        // > ******************* unicorn ***********************
        "unicorn/numeric-separators-style": ["off", {number: {onlyIfContainsSeparator: true, minimumDigits: 3}}],
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
                    dist: false,
                    dev: false,
                    temp: false,
                    e: false
                },
                checkFilenames: false
            }
        ],
        "unicorn/prefer-top-level-await": "off",
        "unicorn/no-zero-fractions": "off",
        "unicorn/no-for-loop": "off",
        "unicorn/prefer-import-meta-properties": "off",
        "unicorn/filename-case": ["off", {case: "camelCase"}],
        "unicorn/throw-new-error": "off",
        "unicorn/new-for-builtins": "off",
        "unicorn/switch-case-braces": "off",
        "unicorn/prefer-json-parse-buffer": "off",
        "unicorn/prefer-class-fields": "warn",
        "unicorn/better-regex": "warn",              // Simplify regexes: /[0-9]/ → /\d/
        "unicorn/custom-error-definition": "error",  // Correct Error subclassing
        "unicorn/no-unused-properties": "warn",      // Dead code detection
        "unicorn/consistent-destructuring": "warn",  // Use destructured vars consistently
        "unicorn/no-keyword-prefix": ["warn", {"checkProperties": false}],

        // > ******************* sonarjs ***********************
        "sonarjs/cognitive-complexity": ["off", 40],
        "sonarjs/void-use": "off",
        "sonarjs/different-types-comparison": "off",
        "sonarjs/no-unenclosed-multiline-block": "off",
        "sonarjs/fixme-tag": "off",
        "sonarjs/no-labels": "off",
        "sonarjs/todo-tag": "off",
        "sonarjs/pseudo-random": "off",
        "sonarjs/no-selector-parameter": "off",
        "sonarjs/array-constructor": "error",
        "sonarjs/destructuring-assignment-syntax": "warn",
        "sonarjs/no-collapsible-if": "warn",
        "sonarjs/no-collection-size-mischeck": "warn",
        "sonarjs/no-unused-function-argument": "warn",
        "sonarjs/prefer-immediate-return": "warn",
        "sonarjs/prefer-object-literal": "warn",
        "sonarjs/no-unused-vars": "off",

        // > ******************* other plugins ***********************
        "depend/ban-dependencies": ["warn", {
                                    presets: ["native", "microutilities", "preferred"]
        }],
        // "import/no-cycle": "error",
        // "import/namespace": "off",
        // "import/no-named-as-default": "off",
        // "import/no-named-as-default-member": "off",
        "import-x/no-unresolved": "error",
        "import-x/default": "off",
        // "promise/no-return-wrap": "warn",
        // "promise/no-promise-in-callback": "warn",
        // "promise/no-nesting": "warn",
        // "promise/no-callback-in-promise": "warn",
        // "promise/always-return": "off",
        // "promise/catch-or-return": ["warn", {allowFinally: true}],
        // "security/detect-child-process": "warn",
        "security/detect-non-literal-fs-filename": "off",
        "security/detect-object-injection": "off",
        "security/detect-unsafe-regex": "error",
        "security/detect-no-csrf-before-method-override": "error",
        "@eslint-community/eslint-comments/disable-enable-pair": "off",
        // "@eslint-community/eslint-comments/no-aggregating-enable": "warn",
        // "@eslint-community/eslint-comments/no-duplicate-disable": "warn",
        // "@eslint-community/eslint-comments/no-unlimited-disable": "warn",
        "@eslint-community/eslint-comments/no-unused-disable": "warn",
        "@eslint-community/eslint-comments/no-unused-enable": "warn",
        "tsdoc/syntax": "warn",
    }
}]);
