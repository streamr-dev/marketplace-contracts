const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
//const log = require("debug")("Streamr:du:test:DataUnionSidechain")

const Marketplace_prev = artifacts.require("./Marketplace20180425.sol")
const Marketplace = artifacts.require("./Marketplace.sol")
const Uniswap2Adapter = artifacts.require("./Uniswap2Adapter.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")
//const MockUniswapFactory = artifacts.require("./MockUniswapFactory.sol")
//const MockUniswapExchange = artifacts.require("./MockUniswapExchange.sol")
const { Marketplace: { Currency } } = require("../src/contracts/enums")

const { assertEqual, assertFails } = require("./testHelpers")

//Uniswap v2
const UniswapV2FactoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json")
const UniswapV2Router02Json = require("@uniswap/v2-periphery/build/UniswapV2Router02.json")
const WETH9Json = require("@uniswap/v2-periphery/build/WETH9.json")
const UniswapV2Factory = new w3.eth.Contract(UniswapV2FactoryJson.abi, null, { data: UniswapV2FactoryJson.bytecode })
const UniswapV2Router02 = new w3.eth.Contract(UniswapV2Router02Json.abi, null, { data: UniswapV2Router02Json.bytecode })
const WETH9 = new w3.eth.Contract(WETH9Json.abi, null, { data: WETH9Json.bytecode })

const futureTime = 4449513600

/*
function absFractionalDifference(ref, val){
    let diff = Math.abs((ref - val) / ref)
    //console.log(`diff ${ref} ${val} = ${diff}`)
    return diff
}
*/

async function deployUniswap2(creator) {
    const weth = await WETH9.deploy(({ arguments: [] })).send({ gas: 6000000, from: creator })
    const factory = await UniswapV2Factory.deploy(({ arguments: [creator] })).send({ gas: 6000000, from: creator })
    const router = await UniswapV2Router02.deploy(({ arguments: [factory.options.address, weth.options.address] })).send({ gas: 6000000, from: creator })
    return router
}


//console.log(uniswap_exchange_abi);
contract("Uniswap2Adapter", accounts => {
    let market
    let market_prev
    let fromToken
    let dataToken
    let uniswapRouter
    let uniswap2Adapter
    const creator = accounts[0]
    const currencyUpdateAgent = accounts[1]
    const buyer = accounts[2]
    const streamOwner = accounts[3]
    const productId = "0x123"
    //const testToleranceSeconds = 5
    const day = 86400

    before(async () => {
        uniswapRouter = await deployUniswap2(creator)
        //token for testing ERC20 purchase
        fromToken = await ERC20Mintable.new({ from: creator })
        dataToken = await ERC20Mintable.new({ from: creator })
        await dataToken.mint(creator, w3.utils.toWei("100000000"), { from: creator })
        await fromToken.mint(creator, w3.utils.toWei("100000000"), { from: creator })
        await fromToken.mint(buyer, w3.utils.toWei("100000000"), { from: creator })
        market_prev = await Marketplace_prev.new(dataToken.address, currencyUpdateAgent, { from: creator })
        market = await Marketplace.new(dataToken.address, currencyUpdateAgent, market_prev.address, { from: creator })
        uniswap2Adapter = await Uniswap2Adapter.new(market.address, uniswapRouter.options.address, dataToken.address, { from: creator })
        await market.createProduct(productId, "testproduct", streamOwner, w3.utils.toWei(".001"), Currency.DATA, 1, { from: streamOwner })
        let dtAmount = w3.utils.toWei("10")
        let ftAmount = w3.utils.toWei("100")
        assert(await fromToken.approve(uniswapRouter.options.address, ftAmount, { from: creator }))
        assert(await dataToken.approve(uniswapRouter.options.address, dtAmount, { from: creator }))
        //10 fromToken ~= 1 dataToken
        await uniswapRouter.methods.addLiquidity(dataToken.address, fromToken.address, dtAmount, ftAmount, 0, 0, creator, futureTime).send({gas: 6000000, from: creator})
        assert(await dataToken.approve(uniswapRouter.options.address, dtAmount, { from: creator }))
        //1 dataToken ~= 1 ETH
        await uniswapRouter.methods.addLiquidityETH(dataToken.address, dtAmount, 0, 0, creator, futureTime).send({gas: 6000000, from: creator, value: dtAmount})
    })

    describe("Check Adaptor", () => {
        const testToleranceSeconds = 5

        it("product is there", async () => {
            assertEqual((await market.getProduct(productId))[0], "testproduct")
        })

        it("too many seconds fails", async () => {
            // will return ~10 data coin, which pays for 10s
            await assertFails(uniswap2Adapter.buyWithETH(productId, 20, day, { from: buyer, value: w3.utils.toWei(".01") }))
            await fromToken.approve(uniswap2Adapter.address, 0, { from: buyer })
            //=.001 eth which pays for about 1s
            let value = w3.utils.toWei(".01")
            await fromToken.approve(uniswap2Adapter.address, value, { from: buyer })
            await assertFails(uniswap2Adapter.buyWithERC20(productId, 9, day, fromToken.address, value, { from: buyer }))
        })

        it("can buy product with ETH", async () => {
            const subBefore = await market.getSubscription(productId, buyer, { from: buyer })
            //.01 eth pays for about 10s
            await uniswap2Adapter.buyWithETH(productId, 9, day, { from: buyer, value: w3.utils.toWei(".01") })
            const subAfter = await market.getSubscription(productId, buyer, { from: buyer })
            assert(subAfter.isValid)
            assert(subAfter.endTimestamp - subBefore.endTimestamp > 10 - testToleranceSeconds)
        })

        it("can buy product with ERC20", async () => {
            const subBefore = await market.getSubscription(productId, buyer, { from: buyer })
            //=.01 eth or about 10s
            let value = w3.utils.toWei("0.1")
            await fromToken.approve(uniswap2Adapter.address, value, { from: buyer })
            await uniswap2Adapter.buyWithERC20(productId, 9, day, fromToken.address, value, { from: buyer })
            const subAfter = await market.getSubscription(productId, buyer, { from: buyer })
            assert(subAfter.isValid)
            assert(subAfter.endTimestamp - subBefore.endTimestamp > 10 - testToleranceSeconds)
        })

        /*
        it("test exchange rates", async () => {
            let amt = 1000.0
            const address0 = "0x0000000000000000000000000000000000000000"
            
            let ethToDataIn = (await uniswap2Adapter.getConversionRateInput(dataToken.address, address0, amt, {from: buyer})) / amt
            assert(absFractionalDifference(ethToDataIn, 1) < .1)
            let ethToFtIn = (await uniswap2Adapter.getConversionRateInput(address0, fromToken.address, amt, {from: buyer})) / amt
            assert(absFractionalDifference(ethToFtIn, 10) < .1)
            let ftToDataIn = (await uniswap2Adapter.getConversionRateInput(fromToken.address, dataToken.address, amt, {from: buyer})) / amt
            assert(absFractionalDifference(ftToDataIn, .1) < .1)

            let ethToDataOut = (await uniswap2Adapter.getConversionRateOutput(dataToken.address, address0, amt, {from: buyer})) / amt
            assert(absFractionalDifference(ethToDataOut, 1) < .1)
            let ethToFtOut = (await uniswap2Adapter.getConversionRateOutput(address0, fromToken.address, amt, {from: buyer})) / amt
            assert(absFractionalDifference(ethToFtOut, .1) < .1)
            let ftToDataOut = (await uniswap2Adapter.getConversionRateOutput(fromToken.address, dataToken.address, amt, {from: buyer})) / amt
            assert(absFractionalDifference(ftToDataOut, 10) < .1)

        })
        */


    })
})