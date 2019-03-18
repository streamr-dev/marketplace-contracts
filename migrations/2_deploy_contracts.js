const Marketplace = artifacts.require("./Marketplace.sol")
// const Community = artifacts.require("./MockCommunity.sol")

module.exports = async (deployer, network) => {
    const mainnet = network.indexOf("main") > -1
    const datacoinAddress = mainnet ? "0x0cf0ee63788a0849fe5297f3407f701e122cc023" : "0x8e3877fe5551f9c14bc9b062bbae9d84bc2f5d4e"
    const streamrUpdaterAddress = "0xb6aA9D2708475fB026a8052E20e63AeA23233613"
    const ownerAddress = mainnet ? "0x1bb7804d12fa4f70ab63d0bbe8cb0b1992694338" : "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
    //there isn't a previous testnet marketplace
    const marketplaceAddress = mainnet ? "0xa10151d088f6f2705a05d6c83719e99e079a61c1":"0x0"
    await deployer.deploy(Marketplace, datacoinAddress, streamrUpdaterAddress, marketplaceAddress, { gas: 6000000 })
    // await deployer.deploy(Community, Marketplace.deployed().address, { gas: 6000000 })
    Marketplace.deployed().then(m => m.transferOwnership(ownerAddress, { gas: 40000 }))
}
