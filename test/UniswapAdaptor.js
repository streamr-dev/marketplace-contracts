const Marketplace_prev = artifacts.require("./Marketplace_20180425.sol")
const Marketplace = artifacts.require("./Marketplace.sol")
const UniswapAdaptor = artifacts.require("./UniswapAdaptor.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")
const MockUniswapFactory = artifacts.require("./MockUniswapFactory.sol")
const MockUniswapExchange = artifacts.require("./MockUniswapExchange.sol")
const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")
const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)

const { assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")

const paths = require("../currencydata")
const bancor = require("../src/bancor")

contract("UniswapAdaptor", accounts => {
    let market
    let fromToken
    let dataToken
    let uniswapFactory
    let uniswapExchange
    let uniswapAdaptor
    const creator = accounts[0]
    const currencyUpdateAgent = accounts[1]
    const buyer = accounts[2]
    const streamOwner = accounts[3]
    const productId = "0x123"
    const testToleranceSeconds = 5
    const day=86400

    before(async () => {
        fromToken = await ERC20Mintable.new({ from: creator })
        dataToken = await ERC20Mintable.new({ from: creator })
        uniswapExchange = await MockUniswapExchange.new(fromToken.address,dataToken.address,{ from: creator } )
        uniswapFactory = await MockUniswapFactory.new(uniswapExchange.address,{ from: creator } )
        market_prev = await Marketplace_prev.new(dataToken.address, currencyUpdateAgent, { from: creator })
        market = await Marketplace.new(dataToken.address, currencyUpdateAgent, market_prev.address, { from: creator })
        uniswapAdaptor = await UniswapAdaptor.new(market.address, uniswapFactory.address, dataToken.address, { from: creator })

        // function createProduct(bytes32 id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) public whenNotHalted
        await market.createProduct(productId, "testproduct", streamOwner, w3.utils.toWei("1"), Currency.DATA, 1, { from: streamOwner })
        await dataToken.mint(uniswapExchange.address, w3.utils.toWei("100000000"), { from: creator })
        await fromToken.mint(buyer, w3.utils.toWei("100000000"), { from: creator })
    })

    describe("Check Adaptor", () => {
        const testToleranceSeconds = 5

        it("product is there", async () => {
            assertEqual((await market.getProduct(productId))[0], "testproduct")
        })

        it("too many seconds fails", async () => {
            var path = [fromToken.address, dataToken.address]
            // will return 10 data coin, which pays for 10s
            await assertFails(uniswapAdaptor.buyWithETH(productId, 11, day, { from: buyer, value: w3.utils.toWei("10") }))
        })

        it("can buy product with ETH", async () => {
            // path[0] is ignored when converting from ETH with MockBancorConverter
            var path = [fromToken.address, dataToken.address]
            const [validBefore, endtimeBefore] = await market.getSubscription(productId, buyer, { from: buyer })
            await uniswapAdaptor.buyWithETH(productId, 9, day, { from: buyer, value: w3.utils.toWei("10") })
            const [validAfter, endtimeAfter] = await market.getSubscription(productId, buyer, { from: buyer })
            assert(validAfter)
            assert(endtimeAfter - endtimeBefore > 10 - testToleranceSeconds)
        })

        it("can buy product with ERC20", async () => {
            var path = [fromToken.address, dataToken.address]
            const [validBefore, endtimeBefore] = await market.getSubscription(productId, buyer, { from: buyer })
            var value = w3.utils.toWei("10")
            await fromToken.approve(uniswapAdaptor.address, value, { from: buyer })
            await uniswapAdaptor.buyWithERC20(productId, 9,day,fromToken.address, value, { from: buyer })
            const [validAfter, endtimeAfter] = await market.getSubscription(productId, buyer, { from: buyer })
            assert(validAfter)
            assert(endtimeAfter - endtimeBefore > 10 - testToleranceSeconds)
        })

    })
})