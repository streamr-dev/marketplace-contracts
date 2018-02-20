var Marketplace = artifacts.require("./Marketplace.sol");

contract("Marketplace", accounts => {
    let market
    before(async () => {
        market = await Marketplace.deployed()
    })

    // function getProduct(bytes32 id) public view returns (string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds, ProductState state)
    describe("Creating & deleting products", () => {
        it("should create a product with correct params", async () => {
            const res = await market.createProduct("test", "test", 1, 1, {from: accounts[0]})            
            assert(res.logs.find(log => log.event == "ProductCreated"), "event not found")            
            const product = await market.getProduct("test")
            assert.equal(product[0], "test")
            assert.equal(product[1], accounts[0])
            assert.equal(+product[2], 1)    // + converts BigNumber to JS number
            assert.equal(+product[3], 1)
            assert.equal(+product[4], 1)    // ProductState == Deployed
        })

        it("should delete the previously created product", async () => {
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

        it("should redeploy the previously deleted product", async () => {
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
});
