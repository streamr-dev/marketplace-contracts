const PrivateKeyProvider = require("truffle-privatekey-provider")

module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    compilers: {
        solc: {
            version: "0.6.6",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                },
                evmVersion: "istanbul"
            }
        }
    },
    networks: {
        localsidechain: {
            network_id: 8997,
            host: "localhost",
            provider: new PrivateKeyProvider("0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0", "http://localhost:8546"),
            port: 8546
        },
        polygonMainnet: {
            network_id: 137,
            provider: new PrivateKeyProvider(process.env.POLYGON_PK || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0", "http://polygon-rpc.com"),
            host: "polygon-rpc.com",
        }
    }
}
