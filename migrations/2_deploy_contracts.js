const Marketplace = artifacts.require("./Marketplace.sol")

module.exports = async deployer => {  
  const datacoinAddress = "0x0cf0ee63788a0849fe5297f3407f701e122cc023"
  const streamrUpdaterAddress = "0x195d3b9d5954780e1c6107c68965fccbdd2192ff"
  const ownerAddress = "0x1bb7804d12fa4f70ab63d0bbe8cb0b1992694338"
  await deployer.deploy(Marketplace, datacoinAddress, streamrUpdaterAddress, { gas: 3000000 })
  Marketplace.deployed().then(m => m.transferOwnership(ownerAddress, { gas: 40000 }))
}
