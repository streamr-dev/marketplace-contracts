const Marketplace = artifacts.require("./Marketplace.sol")
const BancorConverter = artifacts.require("./BancorConverter.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")

const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")

const { assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")

const paths = require("../currencydata")
const bancor = require("../src/contracts/bancor")

contract("BancorConverter", accounts => {
    let market
    let token
    const currencyUpdateAgent = accounts[9]
    const admin = accounts[8]
    before(async () => {
        token = await ERC20Mintable.new({from: accounts[0]})
        await Promise.all(accounts.map(acco => token.mint(acco, 1000000)))
        market = await Marketplace.new(token.address, currencyUpdateAgent, {from: admin})
    })
})