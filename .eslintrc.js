module.exports = {
    extends: 'eslint-config-streamr-nodejs',
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        artifacts: 'readonly',
        web3: 'readonly'
    },
    rules: {
        'max-len': ['warn', 200]
    }
}
