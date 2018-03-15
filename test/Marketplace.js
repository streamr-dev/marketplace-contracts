const web3 = require("web3")

const Marketplace = artifacts.require("./Marketplace.sol")
const MintableToken = artifacts.require("zeppelin-solidity/contracts/token/ERC20/MintableToken.sol")

const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")

// TODO: generally useful asserts, move in separate file ---->

/**
 * Assert equality in web3 return value sense, modulo conversions to "normal" JS strings and numbers
 */
function assertEqual(actual, expected) {
    // basic assert.equal comparison according to https://nodejs.org/api/assert.html#assert_assert_equal_actual_expected_message
    if (actual == expected) { return }
    // also handle arrays for convenience
    if (Array.isArray(actual) && Array.isArray(expected)) {
        assert(actual.length === expected.length, "Arrays have different lengths, supplied wrong number of expected values!")
        actual.forEach((a, i) => assertEqual(a, expected[i]))
        return
    }
    // convert BigNumbers if expecting a number
    // NB: there's a reason BigNumbers are used! Keep your numbers small!
    // if the number coming back from contract is big, then expect a BigNumber to avoid this conversion
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
    assert(log, `Event ${eventName} expected, got: ${truffleResponse.logs.map(log => log.event).join(", ")}`)
    for (arg in eventArgs) {
        assert(log.args.hasOwnProperty(arg), `Event ${eventName} doesn't have expected property "${arg}", try one of: ${Object.keys(log.args).join(", ")}`)
        assertEqual(log.args[arg], eventArgs[arg])
    }
}

async function assertFails(promise) {
    let failed = false
    try {
        await promise
    } catch (e) {
        failed = true
    }
    if (!failed) {
        throw new Error("Expected call to fail")
    }
}

// some kind of "now" (epoch) in seconds, valid-ish block.timestamp
function now() {
    return Number.parseInt(+new Date() / 1000)
}

// <----- end TODO

contract("Marketplace", accounts => {
    let market, token
    const currencyUpdateAgent = accounts[9]
    before(async () => {
        token = await MintableToken.new({from: accounts[0]})        
        await Promise.all(accounts.map(acco => token.mint(acco, 1000000)))
        market = await Marketplace.new(token.address, currencyUpdateAgent, {from: accounts[0]})
    })

    // function getProduct(bytes32 id) public view returns (string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds, ProductState state)
    describe("Creating & deleting products", () => {
        it("creates a product with correct params", async () => {
            const res = await market.createProduct("test", "test", accounts[0], 1, Currency.DATA, 1, {from: accounts[0]})
            assertEvent(res, "ProductCreated", {
                owner: accounts[0],
                id: "test",
                name: "test",
                beneficiary: accounts[0],
                pricePerSecond: 1,
                currency: Currency.DATA,
                minimumSubscriptionSeconds: 1
            })            
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed])
        })

        it("will not accept empty product ID", async () => {
            await assertFails(market.createProduct("", "test", accounts[0], 1, Currency.DATA, 1, {from: accounts[1]}))
        })

        it("can only be deleted/modified by owner", async () => {
            await assertFails(market.deleteProduct("test", {from: accounts[1]}))
            await assertFails(market.updateProduct("test", "lol", accounts[3], 2, 2, {from: accounts[1]}))
            await assertFails(market.offerProductOwnership("test", accounts[1], {from: accounts[1]}))
        })

        it("deletes the previously created product", async () => {            
            assertEvent(await market.deleteProduct("test", {from: accounts[0]}), "ProductDeleted")
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.NotDeployed])
        })

        it("can only be redeployed by owner", async () => {
            await assertFails(market.redeployProduct("test", {from: accounts[1]}))
        })

        it("redeploys the previously deleted product", async () => {
            const res = await market.redeployProduct("test", {from: accounts[0]})
            assertEvent(res, "ProductRedeployed")            
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed])
        })

        it("allows product be updated", async () => {
            const res = await market.updateProduct("test", "lol", accounts[3], 2, Currency.USD, 2, {from: accounts[0]})
            assertEvent(res, "ProductUpdated", {
                owner: accounts[0],
                id: "test",
                name: "lol",
                beneficiary: accounts[3],
                pricePerSecond: 2,
                minimumSubscriptionSeconds: 2
            })            
            assertEqual(await market.getProduct("test"), ["lol", accounts[0], accounts[3], 2, Currency.USD, 2, ProductState.Deployed])
        })

        it("allows ownership be transferred", async () => {            
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
            assertEqual(await market.getProduct("test"), ["lol", accounts[1], accounts[3], 2, Currency.USD, 2, ProductState.Deployed])
        })

        it("claiming fails if not designated as newOwnerCandidate", async () => {            
            await assertFails(market.claimProductOwnership("test", {from: accounts[1]}))
        })
    })

    describe("Buying products", () => {
        let productId
        let testIndex = 0
        beforeEach(async () => {
            productId = "test_buy_" + testIndex++            
            await market.createProduct(productId, "test", accounts[3], 1, Currency.DATA, 1, {from: accounts[0]})
        })

        it("fails for bad arguments", async () => {
            await assertFails(market.buy(productId, 0, {from: accounts[0]}))
            await assertFails(market.buy(productId, 0, {from: accounts[1]}))
        })

        it("fails if allowance not given", async () => {
            await assertFails(market.buy(productId, 100, {from: accounts[0]}))
            await assertFails(market.buy(productId, 100, {from: accounts[1]}))
        })

        it("fails if too little allowance was given", async () => {
            await token.approve(market.address, 10, {from: accounts[1]})            
            await assertFails(market.buy(productId, 100, {from: accounts[1]}))
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
    })

    describe("Subscription", () => {
        const testToleranceSeconds = 5

        before(async () => {            
            await market.createProduct("test_sub", "test", accounts[3], 1, Currency.DATA, 1, {from: accounts[0]})
            await token.approve(market.address, 1000, {from: accounts[1]})
            await market.buy("test_sub", 100, {from: accounts[1]})
        })

        it("can be extended", async () => {            
            const [valid_before, endtime_before, remaining_before] = await market.getSubscriptionTo("test_sub", {from: accounts[1]})
            assert(valid_before)
            assert(remaining_before > 100 - testToleranceSeconds)
            await market.buy("test_sub", 100, {from: accounts[1]})
            const [valid_after, endtime_after, remaining_after] = await market.getSubscriptionTo("test_sub", {from: accounts[1]})
            assert(valid_after)            
            assert(endtime_after - endtime_before > 100 - testToleranceSeconds)
            assert(remaining_after > 200 - testToleranceSeconds)
        })

        it("can be transferred", async () => {
            const [valid1_before, endtime1_before, remaining1_before] = await market.getSubscription("test_sub", accounts[1])
            const [valid2_before, endtime2_before, remaining2_before] = await market.getSubscription("test_sub", accounts[2])
            await market.transferSubscription("test_sub", accounts[2], {from: accounts[1]})
            const [valid1_after, endtime1_after, remaining1_after] = await market.getSubscription("test_sub", accounts[1])
            const [valid2_after, endtime2_after, remaining2_after] = await market.getSubscription("test_sub", accounts[2])
            assert(valid1_before)
            assert(!valid2_before)
            assert(!valid1_after)
            assert(valid2_after)
            assert(endtime2_after > endtime1_before - testToleranceSeconds)
            assert(remaining2_after > remaining1_before - testToleranceSeconds)
        })
    })

    describe("Currency exchange rates", () => {
        before(async () => {            
            await market.createProduct("test_currencies", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
        })

        it("can not be set by non-currencyUpdateAgent", async () => {
            await assertFails(market.updateExchangeRates(now(), 100, {from: accounts[0]}))
        })

        it("determine product price", async () => {            
            await token.approve(market.address, 1000, {from: accounts[1]})
            await market.updateExchangeRates(now(), 10, {from: currencyUpdateAgent})
            await assertFails(market.buy("test_currencies", 200, {from: accounts[1]}))
            await market.updateExchangeRates(now(), 3, {from: currencyUpdateAgent})
            assertEvent(await market.buy("test_currencies", 200, {from: accounts[1]}), "Subscribed")
            assert.equal(await token.allowance(accounts[1], market.address), 1000 - 200 * 3)
        })
    })
});
