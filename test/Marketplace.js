var Marketplace = artifacts.require("./Marketplace.sol");

contract("Marketplace", accounts => {

    // function getProduct(bytes32 id) public view returns (string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds)
    describe("Creating & deleting products", () => {
        it("should create a product with correct params", async () => {
            const market = await Marketplace.deployed()            
            await market.createProduct("test", "test", accounts[0], 1, 1)
            const p = await market.getProduct("test")            
            assert.equal(p[0], "test")
            assert.equal(p[1], accounts[0])            
        })

        it("should delete the previously created product", async () => {
            const market = await Marketplace.deployed()
            await market.deleteProduct("test")
            const p = await market.getProduct("test")            
            assert.equal(p[0], "")
            assert.equal(p[1], "0x0000000000000000000000000000000000000000")
        })
    })
});
