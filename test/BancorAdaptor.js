const Marketplace = artifacts.require("./Marketplace.sol")
const BancorAdaptor = artifacts.require("./BancorAdaptor.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")
const MockBancorConverter = artifacts.require("./MockBancorConverter.sol")
const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")
const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)

const { assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")

const paths = require("../currencydata")
const bancor = require("../src/contracts/bancor")

contract("BancorAdaptor", accounts => {
    let market
    let fromToken
    let dataToken
    let bancorConvertor
    let bancorAdaptor
    const creator = accounts[0]
    const currencyUpdateAgent = accounts[1]
    const buyer = accounts[2]
    const streamOwner = accounts[3]
    const productId  ='0x123'
    const testToleranceSeconds = 5
//    const admin = accounts[8]
    before(async () => {
        bancorConvertor = await MockBancorConverter.new({from: creator});
        fromToken = await ERC20Mintable.new({from: creator})
        dataToken = await ERC20Mintable.new({from: creator})
        market = await Marketplace.new(dataToken.address, currencyUpdateAgent, {from: creator})
        bancorAdaptor = await BancorAdaptor.new(market.address, bancorConvertor.address,dataToken.address, {from: creator});
    //    function createProduct(bytes32 id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) public whenNotHalted {
    
        await market.createProduct(productId, "testproduct",streamOwner,w3.utils.toWei('1'),Currency.DATA,1,{from: streamOwner})
        await dataToken.mint(bancorConvertor.address,w3.utils.toWei('100000000'),{from: creator});
        //await Promise.all(accounts.map(acco => token.mint(acco, 1000000)))
        await fromToken.mint(buyer,w3.utils.toWei('100000000'),{from: creator});
    })

    describe("Check Adaptor", () => {
        const testToleranceSeconds = 5

        it("product is there", async () => {
            assertEqual((await market.getProduct(productId))[0],"testproduct");
        });
        it("too many seconds fails", async () => {
            var path = [fromToken.address, dataToken.address]
            //will return 10 data coin, which pays for 10s
            await assertFails(bancorAdaptor.buyWithETH(productId, path,11,{from: buyer, value: w3.utils.toWei('10')}));
        })
        it("can buy product with ETH", async () => {
            //path[0] is ignored when converting from ETH with MockBancorConverter
            var path = [fromToken.address, dataToken.address]
            const [validBefore, endtimeBefore]  = await market.getSubscription(productId,buyer, {from: buyer});
            await bancorAdaptor.buyWithETH(productId, path,9,{from: buyer, value: w3.utils.toWei('10')})       
            const [validAfter, endtimeAfter]  = await market.getSubscription(productId,buyer, {from: buyer});
            assert(validAfter);
            assert(endtimeAfter - endtimeBefore > 10 - testToleranceSeconds)

        })
        it("can buy product with ERC20", async () => {
            var path = [fromToken.address, dataToken.address]
            const [validBefore, endtimeBefore]  = await market.getSubscription(productId,buyer, {from: buyer});
            var value = w3.utils.toWei('10');
            await fromToken.approve(bancorAdaptor.address,value,{from: buyer});
            await bancorAdaptor.buyWithERC20(productId, path,9, value,{from: buyer})
            const [validAfter, endtimeAfter]  = await market.getSubscription(productId,buyer, {from: buyer});
            assert(validAfter);
            assert(endtimeAfter - endtimeBefore > 10 - testToleranceSeconds)
        })

    })
})