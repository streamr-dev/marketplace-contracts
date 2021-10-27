const { expect, use } = require("chai")
const { Contract, ContractFactory, BigNumber } = require("ethers")
const { AddressZero } = require("ethers").constants
const { parseEther, formatBytes32String, solidityPack } = require("ethers").utils
const { deployContract, MockProvider, solidity } = require("ethereum-waffle")
const bn = require("bignumber.js")

const UniswapV3FactoryJson = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json")
const UniswapV3RouterJson = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json")
const ERC20Mintable = require("../artifacts/contracts/ERC20Mintable.sol/ERC20Mintable.json")
const Marketplace = require("../artifacts/contracts/Marketplace.sol/Marketplace.json")
const Uniswap3Adapter = require("../artifacts/contracts/Uniswap3Adapter.sol/Uniswap3Adapter.json")
const NonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json")

const { Marketplace: { Currency } } = require("../src/contracts/enums")

const WETH9 = require("@uniswap/v2-periphery/build/WETH9.json")
const futureTime = BigNumber.from(4449513600)
const day = 86400
const testToleranceSeconds = 5



bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })
function encodePriceSqrt(reserve1, reserve0) {
    console.log(`encodePriceSqrt ${reserve1} ${reserve0}`)
    return BigNumber.from(
        new bn(reserve1.toString())
            .div(reserve0.toString())
            .sqrt()
            .multipliedBy(new bn(2).pow(96))
            .integerValue(3)
            .toString()
    )
}
async function deployUniswap3(wallet) {
    let deployer = new ContractFactory(WETH9.abi, WETH9.bytecode, wallet)
    let tx = await deployer.deploy()
    const weth = await tx.deployed()
    console.log(`WETH deployed to ${weth.address}`)

    deployer = new ContractFactory(UniswapV3FactoryJson.abi, UniswapV3FactoryJson.bytecode, wallet)
    tx = await deployer.deploy()
    const factory = await tx.deployed()
    console.log(`Uniswap3 factory deployed to ${factory.address}`)

    deployer = new ContractFactory(UniswapV3RouterJson.abi, UniswapV3RouterJson.bytecode, wallet)
    tx = await deployer.deploy(factory.address, weth.address)
    const router = await tx.deployed()
    console.log(`Uniswap3 router deployed to ${router.address}`)
    return router
}
describe("Uniswap3Adapter", () => {
    const productId = formatBytes32String("test")
    let uniswapRouter
    let uniswap3Adapter
    let liquidityManager
    let accounts
    let fromToken, dataToken
    let buyer, creator, currencyUpdateAgent, streamOwner
    let market
    before(async () => {
        accounts = await ethers.getSigners()
        creator = accounts[0]
        currencyUpdateAgent = accounts[1]
        buyer = accounts[2]
        streamOwner = accounts[3]
        uniswapRouter = await deployUniswap3(creator)
        const factory = new Contract(await uniswapRouter.factory(), UniswapV3FactoryJson.abi, creator)
        const weth9 = new Contract(await uniswapRouter.WETH9(), WETH9.abi, creator)
        let deployer = new ContractFactory(NonfungiblePositionManager.abi, NonfungiblePositionManager.bytecode, creator)
        let tx = await deployer.deploy(factory.address, weth9.address, AddressZero)
        liquidityManager = await tx.deployed()
        deployer = new ContractFactory(ERC20Mintable.abi, ERC20Mintable.bytecode, creator)
        tx = await deployer.deploy()
        fromToken = await tx.deployed()
        tx = await deployer.deploy()
        dataToken = await tx.deployed()
        tx = await dataToken.mint(creator.address, parseEther("100000000"))
        tx = await fromToken.mint(creator.address, parseEther("100000000"))
        tx = await fromToken.mint(buyer.address, parseEther("100000000"))
        deployer = new ContractFactory(Marketplace.abi, Marketplace.bytecode, creator)
        tx = await deployer.deploy(dataToken.address, currencyUpdateAgent.address, AddressZero)
        market = await tx.deployed()
        deployer = new ContractFactory(Uniswap3Adapter.abi, Uniswap3Adapter.bytecode, creator)
        tx = await deployer.deploy(market.address, uniswapRouter.address, dataToken.address)
        uniswap3Adapter = await tx.deployed()

        tx = await market.connect(streamOwner).createProduct(productId, "testproduct", streamOwner.address, parseEther(".001"), Currency.DATA, 1)
        await tx.wait()

        const dtAmount = parseEther("10")
        const ftAmount = parseEther("100")
        /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
        //        const MIN_TICK = BigNumber.from(-887272);
        /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
        //      const MAX_TICK = BigNumber.from(887272);
        // from https://github.com/Uniswap/v3-periphery/blob/b23b6cce28ae33548365cef6c1f6d2f94ee4faef/test/shared/ticks.ts#L3
        const MIN_TICK = BigNumber.from(-887220);
        const MAX_TICK = BigNumber.from(887220);

        const poolFee = BigNumber.from(3000)
        const priceSqrt = encodePriceSqrt(ftAmount, dtAmount)
        console.log(`priceSqrt ${priceSqrt}`)


        //IMPORTANT: when creating and minting the tokens must be passed in address ASCENDING ORDER

        // make dataToken - fromToken pool and add liquidity
        tx = await liquidityManager.createAndInitializePoolIfNecessary(dataToken.address, fromToken.address, poolFee, priceSqrt)

        console.log(`pack`)
        //const mintParams = solidityPack([ 'address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256', 'uint256', 'uint256', 'address','uint256'], args);
        let mintParams = {
            token0: dataToken.address,
            token1: fromToken.address,
            fee: poolFee,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: dtAmount,
            amount1Desired: ftAmount,
            amount0Min: 0,
            amount1Min: 0,
            recipient: creator.address,
            deadline: futureTime
        }
        // make WETH - dataToken pool and add liquidity

        tx = await fromToken.approve(liquidityManager.address, ftAmount)
        tx = await dataToken.approve(liquidityManager.address, dtAmount)
        console.log(`mintParams ${mintParams}`)
        tx = await liquidityManager.mint(mintParams)
        console.log(`mint`)
        //10 fromToken ~= 1 dataToken
        //tx = await uniswapRouter.addLiquidity(dataToken.address, fromToken.address, dtAmount, ftAmount, 0, 0, creator, futureTime).send()
        mintParams = {
            token0: weth9.address,
            token1: dataToken.address,
            fee: poolFee,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: dtAmount,
            amount1Desired: dtAmount,
            amount0Min: 0,
            amount1Min: 0,
            recipient: creator.address,
            deadline: futureTime
        }
        tx = await weth9.deposit({ value: dtAmount })
        tx = await dataToken.approve(liquidityManager.address, dtAmount)
        tx = await weth9.approve(liquidityManager.address, dtAmount)
        //let pool = await factory.getPool(weth9.address, dataToken.address, poolFee)
        
        //IMPORTANT: when creating and minting the tokens must be passed in address ascending ORDER
        tx = await liquidityManager.createAndInitializePoolIfNecessary(weth9.address, dataToken.address, poolFee, encodePriceSqrt(dtAmount, dtAmount))
        let pool = await factory.getPool(weth9.address, dataToken.address, poolFee)
        console.log(`pool ${pool}`)
        //console.log(`create2`)
        tx = await liquidityManager.mint(mintParams)

        //1 dataToken ~= 1 ETH
        //tx = await uniswapRouter.addLiquidityETH(dataToken.address, dtAmount, 0, 0, creator, futureTime).send({value: dtAmount})

    })

    it("product is there", async () => {
        expect((await market.getProduct(productId))[0]).to.equal("testproduct")
    })

    it("too many seconds fails", async () => {
        // will return ~10 data coin, which pays for 10s
        await expect(uniswap3Adapter.connect(buyer).buyWithETH(productId, 20, day, {value: parseEther(".01") })).to.be.reverted
        /*
        await fromToken.approve(uniswap2Adapter.address, 0, { from: buyer })
        //=.001 eth which pays for about 1s
        let value = w3.utils.toWei(".01")
        await fromToken.approve(uniswap2Adapter.address, value, { from: buyer })
        await assertFails(uniswap2Adapter.buyWithERC20(productId, 9, day, fromToken.address, value, { from: buyer }))
        */
    })

    it("can buy product with ETH", async () => {
        const subBefore = await market.getSubscription(productId, buyer.address)
        //.01 eth pays for about 10s
        await uniswap3Adapter.connect(buyer).buyWithETH(productId, 9, day, { value: parseEther(".01") })
        const subAfter = await market.getSubscription(productId, buyer.address)
        expect(subAfter.isValid).to.be.true
        expect(subAfter.endTimestamp - subBefore.endTimestamp).to.be.gt(10 - testToleranceSeconds)
    })

    it("can buy product with ERC20", async () => {
        const subBefore = await market.getSubscription(productId, buyer.address)
        //=.01 eth or about 10s
        let value = parseEther("0.1")
        await fromToken.connect(buyer).approve(uniswap3Adapter.address, value)
        await uniswap3Adapter.connect(buyer).buyWithERC20(productId, 9, day, fromToken.address, value)
        const subAfter = await market.getSubscription(productId, buyer.address)
        expect(subAfter.isValid).to.be.true
        expect(subAfter.endTimestamp - subBefore.endTimestamp).to.be.gt(10 - testToleranceSeconds)
    })


})


/*


const Marketplace_prev = artifacts.require("./Marketplace20180425.sol")
const Marketplace = artifacts.require("./Marketplace.sol")
const Uniswap2Adapter = artifacts.require("./Uniswap2Adapter.sol")
const ERC20Mintable = artifacts.require("./ERC20Mintable.sol")
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



async function deployUniswap2(creator) {
    const weth = await WETH9.deploy(({ arguments: [] })).send({ gas: 6000000, from: creator })
    const factory = await UniswapV2Factory.deploy(({ arguments: [creator] })).send({ gas: 6000000, from: creator })
    const router = await UniswapV2Router02.deploy(({ arguments: [factory.options.address, weth.options.address] })).send({ gas: 6000000, from: creator })
    return router
}


//console.log(uniswap_exchange_abi);
contract("Uniswap3Adapter", accounts => {
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
    })
})
*/