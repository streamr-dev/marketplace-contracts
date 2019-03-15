var fs = require('fs');
const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)

const Marketplace_prev = artifacts.require("./Marketplace20180425.sol")
const Marketplace = artifacts.require("./Marketplace.sol")
const UniswapAdaptor = artifacts.require("./UniswapAdaptor.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")
const MockUniswapFactory = artifacts.require("./MockUniswapFactory.sol")
const MockUniswapExchange = artifacts.require("./MockUniswapExchange.sol")
const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")

const { assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")


//from https://github.com/Uniswap/contracts-vyper
const uniswap_exchange_abi = JSON.parse(fs.readFileSync('./contracts/abi/uniswap_exchange.json', 'utf-8'));
const uniswap_factory_abi = JSON.parse(fs.readFileSync('./contracts/abi/uniswap_factory.json', 'utf-8'));
const uniswap_exchange_bytecode = fs.readFileSync('./contracts/bytecode/uniswap_exchange.txt', 'utf-8');
const uniswap_factory_bytecode = fs.readFileSync('./contracts/bytecode/uniswap_factory.txt', 'utf-8');

const UniswapFactory = new w3.eth.Contract(uniswap_factory_abi, null, { data: uniswap_factory_bytecode });
const UniswapExchange = new w3.eth.Contract(uniswap_exchange_abi, null, { data: uniswap_exchange_bytecode });
const futureTime = 4449513600;
//console.log(uniswap_exchange_abi);
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
    const day = 86400

    before(async () => {
        //token for testing ERC20 purchase
        fromToken = await ERC20Mintable.new({ from: creator })
        dataToken = await ERC20Mintable.new({ from: creator })
        await dataToken.mint(creator, w3.utils.toWei("100000000"), { from: creator })
        await fromToken.mint(creator, w3.utils.toWei("100000000"), { from: creator })
        await fromToken.mint(buyer, w3.utils.toWei("100000000"), { from: creator })
        uniswapFactory = await UniswapFactory.deploy(({ arguments: [] })).send({ gas: 6000000, from: creator });
        const templateExchange = await UniswapExchange.deploy(({ arguments: [] })).send({ gas: 6000000, from: creator });
        await uniswapFactory.methods.initializeFactory(templateExchange.options.address).send({ gas: 6000000, from: creator });
        await uniswapFactory.methods.createExchange(fromToken.address).send({ gas: 6000000, from: creator });
        await uniswapFactory.methods.createExchange(dataToken.address).send({ gas: 6000000, from: creator });
        let fromtoken_exchange = await uniswapFactory.methods.getExchange(fromToken.address).call();
        let datatoken_exchange = await uniswapFactory.methods.getExchange(dataToken.address).call();
        const fromTokenUniswapExchange = new w3.eth.Contract(uniswap_exchange_abi, fromtoken_exchange, { data: uniswap_exchange_bytecode });
        const dataTokenUniswapExchange = new w3.eth.Contract(uniswap_exchange_abi, datatoken_exchange, { data: uniswap_exchange_bytecode });
        market_prev = await Marketplace_prev.new(dataToken.address, currencyUpdateAgent, { from: creator })
        market = await Marketplace.new(dataToken.address, currencyUpdateAgent, market_prev.address, { from: creator })
        uniswapAdaptor = await UniswapAdaptor.new(market.address, uniswapFactory.options.address, dataToken.address, { from: creator })
        await market.createProduct(productId, "testproduct", streamOwner, w3.utils.toWei(".001"), Currency.DATA, 1, { from: streamOwner })
        let dtAmount = w3.utils.toWei("10");
        let ftAmount = w3.utils.toWei("10");
        assert(await fromToken.approve(fromtoken_exchange, ftAmount, { from: creator }));
        assert(await dataToken.approve(datatoken_exchange, dtAmount, { from: creator }));
        assert(await dataToken.approve(templateExchange.options.address, dtAmount, { from: creator }));
        //10 fromToken ~= 1 ETH
        await fromTokenUniswapExchange.methods.addLiquidity(w3.utils.toWei("10"), w3.utils.toWei("10"), futureTime).send({ from: creator, gas: 6000000, value: w3.utils.toWei("1") });
        //1 dataToken ~= 1 ETH
        await dataTokenUniswapExchange.methods.addLiquidity(dtAmount, dtAmount, futureTime).send({ from: creator, gas: 6000000, value: dtAmount });
    })

    describe("Check Adaptor", () => {
        const testToleranceSeconds = 5

        it("product is there", async () => {
            assertEqual((await market.getProduct(productId))[0], "testproduct")
        })

        it("too many seconds fails", async () => {
            // will return ~10 data coin, which pays for 10s
            await assertFails(uniswapAdaptor.buyWithETH(productId, 20, day, { from: buyer, value: w3.utils.toWei(".01") }))
            await fromToken.approve(uniswapAdaptor.address, 0, { from: buyer })
            //=.001 eth which pays for about 1s
            let value = w3.utils.toWei(".01");
            await fromToken.approve(uniswapAdaptor.address, value, { from: buyer })
            await assertFails(uniswapAdaptor.buyWithERC20(productId, 9, day, fromToken.address, value, { from: buyer }))

        })

        it("can buy product with ETH", async () => {
            const [validBefore, endtimeBefore] = await market.getSubscription(productId, buyer, { from: buyer })
            //.01 eth pays for about 10s
            await uniswapAdaptor.buyWithETH(productId, 9, day, { from: buyer, value: w3.utils.toWei(".01") })
            const [validAfter, endtimeAfter] = await market.getSubscription(productId, buyer, { from: buyer })
            assert(validAfter)
            assert(endtimeAfter - endtimeBefore > 10 - testToleranceSeconds)
        })

        it("can buy product with ERC20", async () => {
            const [validBefore, endtimeBefore] = await market.getSubscription(productId, buyer, { from: buyer })
            //=.01 eth or about 10s
            var value = w3.utils.toWei("0.1")
            await fromToken.approve(uniswapAdaptor.address, value, { from: buyer })
            await uniswapAdaptor.buyWithERC20(productId, 9, day, fromToken.address, value, { from: buyer })
            const [validAfter, endtimeAfter] = await market.getSubscription(productId, buyer, { from: buyer })
            assert(validAfter)
            assert(endtimeAfter - endtimeBefore > 10 - testToleranceSeconds)
        })

        it("test exchange rates", async () => {
            let amt = 1000.0;
            let ethToData = (await uniswapAdaptor.getConversionRate(dataToken.address, 0x0, amt, {from: buyer}))/amt;
            assert(Math.abs(ethToData - 1) < .1);
            let ethToFt = (await uniswapAdaptor.getConversionRate(0x0, fromToken.address, amt, {from: buyer}))/amt;
            assert(Math.abs(ethToFt - 10) < 1);
            let ftToData = (await uniswapAdaptor.getConversionRate(fromToken.address, dataToken.address, amt, {from: buyer}))/amt;
            assert(Math.abs(ftToData - .1) < .01);
        })


    })
})