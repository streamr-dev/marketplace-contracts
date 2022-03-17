const Marketplace = artifacts.require("./Marketplace.sol")
const config = require("@streamr/config")
// const Community = artifacts.require("./MockCommunity.sol")

module.exports = async (deployer, network) => {
    const streamrUpdaterAddress = "0xb6aA9D2708475fB026a8052E20e63AeA23233613"
    let datacoinAddress
    // let ownerAddress
    let marketplaceAddress
    switch (network) {
    case "mainnet": {
        break
    }
    case "localsidechain": {
        const chains = config.Chains.load("development")
        datacoinAddress = chains.streamr.contracts["Token"]
        // ownerAddress = "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    case "polygonMainnet": {
        const chains = config.Chains.load("production")
        datacoinAddress = chains.streamr.contracts["DATA-Token"]
        // ownerAddress = "0xC166609238736DDc36D6a4EFd50046ea9a2ad0AD"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    case "maticTest": {
        const chains = config.Chains.load("development")
        datacoinAddress = chains.streamr.contracts["Token"]
        // ownerAddress = "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
        marketplaceAddress = "0x0000000000000000000000000000000000000000"
        break
    }
    }

    //const mainnet = network.indexOf("main") > -1
    //const streamrUpdaterAddress = "0xb6aA9D2708475fB026a8052E20e63AeA23233613"
    //const datacoinAddress = mainnet ? "0x0cf0ee63788a0849fe5297f3407f701e122cc023" : "0x8e3877fe5551f9c14bc9b062bbae9d84bc2f5d4e"
    //const ownerAddress = mainnet ? "0x1bb7804d12fa4f70ab63d0bbe8cb0b1992694338" : "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
    //there isn't a previous testnet marketplace
    //const marketplaceAddress = mainnet ? "0xa10151d088f6f2705a05d6c83719e99e079a61c1" : "0x0000000000000000000000000000000000000000"
    console.log("datacoinAddress", datacoinAddress)
    await deployer.deploy(Marketplace, datacoinAddress, streamrUpdaterAddress, marketplaceAddress)
    // await deployer.deploy(Community, Marketplace.deployed().address, { gas: 6000000 })
    const tx = await Marketplace.deployed()
    // console.log(tx)

    //await m.transferOwnership(ownerAddress, { gas: 400000 })
}
