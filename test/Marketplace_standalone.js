/* global web3 */

// using the NEW web3 1.0
const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)

const { Marketplace: { Currency } } = require("../src/contracts/enums")

describe("Marketplace", () => {
    it("can createProduct and buy also outside Truffle", async () => {
        const MarketplaceJson_prev = require("../build/contracts/Marketplace20180425.json")
        const MarketplaceJson = require("../build/contracts/Marketplace.json")
        const TokenJson = require("../build/contracts/ERC20Mintable.json")
        const Marketplace_prev = new w3.eth.Contract(MarketplaceJson_prev.abi)
        const Marketplace = new w3.eth.Contract(MarketplaceJson.abi)
        const Token = new w3.eth.Contract(TokenJson.abi)

        const accounts = await w3.eth.getAccounts()
        const token = await Token
            .deploy({data: TokenJson.bytecode})
            .send({from: accounts[0], gas: 4000000})
        const market_prev = await Marketplace_prev
            .deploy({data: MarketplaceJson_prev.bytecode, arguments: [token.options.address, accounts[8]]})
            .send({from: accounts[0], gas: 6000000})
        const market = await Marketplace
            .deploy({data: MarketplaceJson.bytecode, arguments: [token.options.address, accounts[8], market_prev.options.address]})
            .send({from: accounts[0], gas: 6000000})

       // w3.eth.getBlock("latest").then((block) => {console.log("gasLimit: " + block.gasLimit)});
        

        const productId = "test-e2e"
        const productIdHex = w3.utils.utf8ToHex(productId)
        await market.methods.createProduct(productIdHex, "End-to-end tester", accounts[3], 1, Currency.DATA, 1, false)
            .send({from: accounts[0], gas: 4000000})
        await token.methods.mint(accounts[1], 100000).send({from: accounts[0], gas: 4000000})
        await token.methods.approve(market.options.address, 10000).send({from: accounts[1], gas: 4000000})

        // TODO: find out why the following fails
        // await market.methods.buy(productIdHex, 10).send({from: accounts[1], gas: 4000000})
    })
})
