module.exports = {
    "env": {
        "commonjs": true,
        "node": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2019
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "never"
        ],
        "no-var": "error",
        "comma-dangle": ["error", {
            "arrays": "only-multiline",
            "objects": "only-multiline",
        }],
        "no-console": "warn",
        "space-infix-ops": "warn",
    }
}
