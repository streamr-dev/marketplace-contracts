const Migrations = artifacts.require("./Migrations.sol")

module.exports = (deployer) => {
    return deployer.deploy(Migrations, {gas: 300000})
}
