const Marketplace = artifacts.require("./Marketplace.sol")

module.exports = deployer => {  
  const datacoinAddress = "0x0cf0ee63788a0849fe5297f3407f701e122cc023"  
  deployer.deploy(Marketplace, datacoinAddress)  
}
