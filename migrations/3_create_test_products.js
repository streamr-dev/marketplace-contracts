const Marketplace = artifacts.require("./Marketplace.sol")
const fetch = require("node-fetch")

module.exports = async (deployer, network) => {
  // only for test network
  if (network.indexOf("main") > -1) {
    return;
  }

  const datacoinAddress = "0x8e3877fe5551f9c14bc9b062bbae9d84bc2f5d4e"
  const streamrUpdaterAddress = "0xb6aA9D2708475fB026a8052E20e63AeA23233613"

  const productListURL = "http://localhost:8081/streamr-core/api/v1/products?publicAccess=true"

  const market = await Marketplace.deployed()
  const products = await (await fetch(productListURL)).json()

  for (let p of products) {
    await market.createProduct("0x" + p.id, p.name, streamrUpdaterAddress, p.pricePerSecond, p.priceCurrency == "DATA" ? 0 : 1, p.minimumSubscriptionInSeconds)//, {from: streamrUpdaterAddress})
    if (p.state == "NOT_DEPLOYED") {
      await market.deleteProduct("0x" + p.id)
    }
  }
}
