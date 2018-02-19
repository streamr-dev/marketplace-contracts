const Marketplace = artifacts.require("./Marketplace.sol");
const Ownable = artifacts.require('zeppelin-solidity/contracts/ownership/Ownable.sol');
const MintableToken = artifacts.require('zeppelin-solidity/contracts/token/ERC20/MintableToken.sol');

module.exports = function(deployer) {  
  var datacoinAddressPromise = Promise.resolve("0x0cf0ee63788a0849fe5297f3407f701e122cc023")
  
  // deploy token that can be used in testing
  if (deployer.network == "test") {
    datacoinAddressPromise = deployer.deploy(MintableToken).then(() => {      
      return MintableToken.deployed()
    }).then((Token) => {
      return Token.transferOwnership("0xb3428050ea2448ed2e4409be47e1a50ebac0b2d2")
    }).then(() => {
      return MintableToken.address
    })
  }

  datacoinAddressPromise.then(datacoinAddress => {
    return deployer.deploy(Marketplace, datacoinAddress)
  })  
};
