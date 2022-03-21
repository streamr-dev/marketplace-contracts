// eslint-disable-next-line import/no-extraneous-dependencies
const config = require("@streamr/config")

const Marketplace = artifacts.require("./Marketplace.sol")

module.exports = async (deployer, network) => {
    const streamrUpdaterAddress = "0xb6aA9D2708475fB026a8052E20e63AeA23233613"
    let datacoinAddress = ""
    let marketplaceAddress
    switch (network) {
    case "test": {
        datacoinAddress = "0x8e3877fe5551f9c14bc9b062bbae9d84bc2f5d4e"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    // TODO Ethereum mainnet
    case "localsidechain": {
        const chains = config.Chains.load("development")
        datacoinAddress = chains.streamr.contracts.Token
        // ownerAddress = "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    case "polygonMainnet": {
        const chains = config.Chains.load("production")
        datacoinAddress = chains.polygon.contracts["DATA-token"]
        // ownerAddress = "0xC166609238736DDc36D6a4EFd50046ea9a2ad0AD"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    case "maticTest": {
        const chains = config.Chains.load("development")
        datacoinAddress = chains.streamr.contracts.Token
        // ownerAddress = "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    default: {
        throw new Error(`Unknown network: ${network}`)
    }
    }

    const gasPrice = await web3.eth.getGasPrice()
    const tx = await deployer.deploy(Marketplace, datacoinAddress, streamrUpdaterAddress, marketplaceAddress, {
        gasPrice: (new web3.utils.BN(gasPrice)).mul(new web3.utils.BN(1.5))
    })

    const tx2 = await Marketplace.deployed()
    if (network === "test") {
        await tx2.transferOwnership("0x3F2dA479B77cB583C3462577DCD2e89B965fe987", {
            gas: 400000
        })
    }
}
