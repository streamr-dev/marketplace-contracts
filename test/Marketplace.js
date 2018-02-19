var Marketplace = artifacts.require("./Marketplace.sol");

contract("Marketplace", accounts => {

    describe("Creating & deleting products", () => {
        it("should create a product with correct params", async () => {
            const market = await Marketplace.deployed()
            debugger;
            const ret = await market.createProduct("test", "test", accounts[0], 1, 1)
            const p = await market.getProduct("test")
            console.log(JSON.stringify(p))
            assert.equal(p.id, "test")
            assert.equal(p.beneficiary, accounts[0])
            //assert.equal(1,2)
        })

        it("should delete the previously created product", async () => {
            const market = await Marketplace.deployed()
            await market.deleteProduct("test")
            const p = await market.getProduct("test")
            console.log(JSON.stringify(p))
            assert.equal(p.id, "")
            assert.equal(p.beneficiary, "0")
        })
    })
});
