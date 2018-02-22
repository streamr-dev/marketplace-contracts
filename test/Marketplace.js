const web3 = require("web3")

const chai = require("chai")
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
chai.should()

const Marketplace = artifacts.require("./Marketplace.sol")
const MintableToken = artifacts.require("zeppelin-solidity/contracts/token/ERC20/MintableToken.sol")

// TODO: generally useful asserts, move in separate file ---->

/**
 * Assert equality in web3 return value sense, modulo conversions to "normal" JS strings and numbers
 */
function assertEqual(actual, expected) {
    // basic assert.equal comparison according to https://nodejs.org/api/assert.html#assert_assert_equal_actual_expected_message
    if (actual == expected) { return }
    // also handle arrays
    if (Array.isArray(actual) && Array.isArray(expected)) {
        assert(actual.length === expected.length, "Arrays have different lengths, supplied wrong number of expected values!")
        actual.forEach((a, i) => assertEqual(a, expected[i]))
        return
    }
    // convert BigNumbers if expecting a number
    // NB: there's a reason BigNumbers are used! Keep your numbers small!
    if (typeof expected === "number") {
        assert.equal(+actual, +expected)
        return
    }
    // convert hex bytes to string
    if (typeof expected === "string" && !isNaN(+actual)) {
        assert.equal(web3.utils.hexToString(actual), expected)
        return
    }
    // fail now with nice error if didn't hit the filters
    assert.equal(actual, expected)
}

function assertEvent(truffleResponse, eventName, eventArgs) {
    const log = truffleResponse.logs.find(log => log.event == eventName)
    assert(log, `Event ${eventName} expected, not found`)
    for (arg in eventArgs) {
        assert(log.args.hasOwnProperty(arg), `Event ${eventName} doesn't have expected property "${arg}", try one of: ${Object.keys(log.args).join(", ")}`)
        assertEqual(log.args[arg], eventArgs[arg])
    }
}

// <----- end TODO

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
            const res = await market.createProduct("test", "test", accounts[0], 1, 1, {from: accounts[0]})            
            assertEvent(res, "ProductCreated", {
                owner: accounts[0],
                id: "test",
                name: "test",
                beneficiary: accounts[0],
                pricePerSecond: 1,
                minimumSubscriptionSeconds: 1
            })            
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, 1, 1])    // ProductState == Deployed
        })

        it("deletes the previously created product", async () => {
            const res = await market.deleteProduct("test", {from: accounts[0]})
            assertEvent(res, "ProductDeleted")            
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, 1, 0])    // ProductState == NotDeployed
        })

        it("redeploys the previously deleted product", async () => {
            const res = await market.redeployProduct("test", {from: accounts[0]})
            assertEvent(res, "ProductRedeployed")            
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, 1, 1])
        })

        it("can only be deleted/modified by owner", async () => {
            market.deleteProduct("test", {from: accounts[1]}).should.be.rejectedWith("VM Exception while processing transaction: revert")
        })

        it("product can be updated", async () => {
            const res = await market.updateProduct("test", "lol", accounts[3], 2, 2, {from: accounts[0]})
            assertEvent(res, "ProductUpdated", {
                owner: accounts[0],
                id: "test",
                name: "lol",
                beneficiary: accounts[3],
                pricePerSecond: 2,
                minimumSubscriptionSeconds: 2
            })            
            assertEqual(await market.getProduct("test"), ["lol", accounts[0], accounts[3], 2, 2, 1])    // ProductState == Deployed
        })

        it("ownership can be transferred", async () => {            
            assertEvent(await market.offerProductOwnership("test", accounts[1], {from: accounts[0]}), "ProductOwnershipOffered", {
                owner: accounts[0],
                id: "test",                
                to: accounts[1]
            })
            assertEvent(await market.claimProductOwnership("test", {from: accounts[1]}), "ProductOwnershipChanged", {
                newOwner: accounts[1],
                id: "test",                
                oldOwner: accounts[0]
            })
            assertEqual(await market.getProduct("test"), ["lol", accounts[1], accounts[3], 2, 2, 1])
        })
    })

    describe("Buying products", () => {
        let productId = "test"
        beforeEach(async () => {            
            productId += "x"
            await market.createProduct(productId, "test", accounts[3], 1, 1, {from: accounts[0]})
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
            const res = await market.buy(productId, 100, {from: accounts[1]})
            assertEvent(res, "NewSubscription", {
                productId,
                subscriber: accounts[1]
            })
            assert(await market.hasValidSubscription(productId, accounts[1]), {from: accounts[0]})
        })

        // TODO: test extending subscription

        // TODO: test transferSubscription
    })
});
