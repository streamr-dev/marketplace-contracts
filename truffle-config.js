module.exports = {

    networks: {
        local: {
            host: "localhost",
            port: 8545,
            network_id: "*",
        },
        "local-rinkeby": {
            host: "localhost",
            port: 8546,
            network_id: "4",
        },
        "local-mainnet": {
            host: "localhost",
            port: 8547,
            network_id: "1",
            gasPrice: "4000000000",
            gas: "50000", // enough for migration setCompleted
        },
        rinkeby: {
            host: "94.130.239.166",
            port: 8546,
            network_id: "4",
        },
        mainnet: {
            host: "94.130.239.166",
            port: 8547,
            network_id: "1",
        },
        /*
        test: {
            gas: "1000000",
            provider: function() {
                return new HDWalletProvider("testrpc", "http://127.0.0.1:8545/");
            },
            network_id: '*',
        }
        */
    },

    plugins: [
        "solidity-coverage"
    ],

    compilers: {
        solc: {
            version: "0.5.16",      // Fetch exact version from solc-bin (default: truffle's version)
            // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
            settings: {             // See the solidity docs for advice about optimization and evmVersion
                optimizer: {
                    enabled: true,
                    runs: 1500
                },
                evmVersion: "byzantium"
            }
        }
    }
}
