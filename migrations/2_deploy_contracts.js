const Marketplace = artifacts.require("./Marketplace.sol")

module.exports = deployer => {  
  const datacoinAddress = "0x0cf0ee63788a0849fe5297f3407f701e122cc023"
  const streamrUpdaterCanvasAddress = "0xb3428050ea2448ed2e4409be47e1a50ebac0b2d2"  // TODO: this is publicly known dummy!
  deployer.deploy(Marketplace, datacoinAddress, streamrUpdaterCanvasAddress)  
}
