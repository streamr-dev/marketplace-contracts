const chai = require("chai")
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
chai.should()

const Marketplace = artifacts.require("./Marketplace.sol")
const MintableToken = artifacts.require("zeppelin-solidity/contracts/token/ERC20/MintableToken.sol")

contract("Marketplace", accounts => {
    let market, token
    before(async () => {
        token = await MintableToken.new({from: accounts[0]})        
        await Promise.all(accounts.map(acco => token.mint(acco, 1000000)))
        market = await Marketplace.new(token.address, {from: accounts[0]})
    })

    // function getProduct(bytes32 id) public view returns (string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds, ProductState state)
    describe("Creating & deleting products", () => {
        it("creates a product with correct params", async () => {
            const res = await market.createProduct("test", "test", 1, 1, {from: accounts[0]})            
            assert(res.logs.find(log => log.event == "ProductCreated"), "event not found")            
            const product = await market.getProduct("test")
            assert.equal(product[0], "test")
            assert.equal(product[1], accounts[0])
            assert.equal(+product[2], 1)    // + converts BigNumber to JS number
            assert.equal(+product[3], 1)
            assert.equal(+product[4], 1)    // ProductState == Deployed
        })

        it("deletes the previously created product", async () => {
            const res = await market.deleteProduct("test", {from: accounts[0]})
            assert(res.logs.find(log => log.event == "ProductDeleted"), "event not found")            
            const p = await market.getProduct("test")            
            const product = await market.getProduct("test")
            assert.equal(product[0], "test")
            assert.equal(product[1], accounts[0])
            assert.equal(+product[2], 1)
            assert.equal(+product[3], 1)
            assert.equal(+product[4], 0)    // ProductState == NotDeployed
        })

        it("redeploys the previously deleted product", async () => {
            const res = await market.redeployProduct("test", {from: accounts[0]})
            assert(res.logs.find(log => log.event == "ProductRedeployed"), "event not found")            
            const p = await market.getProduct("test")            
            const product = await market.getProduct("test")
            assert.equal(product[0], "test")
            assert.equal(product[1], accounts[0])
            assert.equal(+product[2], 1)
            assert.equal(+product[3], 1)
            assert.equal(+product[4], 1)    // ProductState == Deployed
        })        
    })

    describe("Buying products", () => {
        let productId = "test"
        beforeEach(async () => {            
            productId += "x"
            await market.createProduct(productId, "test", 1, 1, {from: accounts[0]})
        })

        it("fails for bad arguments", () => {
            market.buy(productId, 0, {from: accounts[0]}).should.be.rejectedWith("VM Exception while processing transaction: revert")
            market.buy(productId, 0, {from: accounts[1]}).should.be.rejectedWith("VM Exception while processing transaction: revert")
        })

        it("fails if allowance not given", () => {
            market.buy(productId, 100, {from: accounts[0]}).should.be.rejectedWith("VM Exception while processing transaction: revert")
            market.buy(productId, 100, {from: accounts[1]}).should.be.rejectedWith("VM Exception while processing transaction: revert")
        })

        it("fails if too little allowance was given", async () => {
            await token.approve(market.address, 10, {from: accounts[1]})            
            market.buy(productId, 100, {from: accounts[1]}).should.be.rejectedWith("VM Exception while processing transaction: revert")
        })        

        it("works if enough allowance was given", async () => {
            await token.approve(market.address, 1000, {from: accounts[1]})
            await market.buy(productId, 100, {from: accounts[1]})
            assert(await market.hasValidSubscription(productId, accounts[1]), {from: accounts[0]})
        })
    })    
});
