const Marketplace = artifacts.require("./Marketplace.sol")
const MockCommunity = artifacts.require("./MockCommunity.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")

const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")

const { assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")

contract("Marketplace", accounts => {
    let market
    let token
    const currencyUpdateAgent = accounts[9]
    const admin = accounts[8]
    before(async () => {
        token = await ERC20Mintable.new({from: accounts[0]})
        await Promise.all(accounts.map(acco => token.mint(acco, 1000000)))
        market = await Marketplace.new(token.address, currencyUpdateAgent, {from: admin})
    })

    // function getProduct(bytes32 id) public view
    // returns (string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds, ProductState state)
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
                minimumSubscriptionSeconds: 1,
            })
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed])
        })

        it("will not accept empty product ID", async () => {
            await assertFails(market.createProduct("", "test", accounts[0], 1, Currency.DATA, 1, {from: accounts[1]}), "error_nullProductId")
        })

        it("can only be deleted/modified by owner", async () => {
            await assertFails(market.deleteProduct("test", {from: accounts[1]}), "error_productOwnersOnly")
            await assertFails(market.updateProduct("test", "lol", accounts[3], 2, Currency.USD, 2, {from: accounts[1]}), "error_productOwnersOnly")
            await assertFails(market.offerProductOwnership("test", accounts[1], {from: accounts[1]}), "error_productOwnersOnly")
        })

        it("deletes the previously created product", async () => {
            assertEvent(await market.deleteProduct("test", {from: accounts[0]}), "ProductDeleted")
            assertEqual(await market.getProduct("test"), ["test", accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.NotDeployed])
        })

        it("can only be redeployed by owner", async () => {
            await assertFails(market.redeployProduct("test", {from: accounts[1]}), "error_productOwnersOnly")
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
                minimumSubscriptionSeconds: 2,
            })
            assertEqual(await market.getProduct("test"), ["lol", accounts[0], accounts[3], 2, Currency.USD, 2, ProductState.Deployed])
        })

        it("allows ownership be transferred", async () => {
            assertEvent(await market.offerProductOwnership("test", accounts[1], {from: accounts[0]}), "ProductOwnershipOffered", {
                owner: accounts[0],
                id: "test",
                to: accounts[1],
            })
            assertEvent(await market.claimProductOwnership("test", {from: accounts[1]}), "ProductOwnershipChanged", {
                newOwner: accounts[1],
                id: "test",
                oldOwner: accounts[0],
            })
            assertEqual(await market.getProduct("test"), ["lol", accounts[1], accounts[3], 2, Currency.USD, 2, ProductState.Deployed])
        })

        it("claiming fails if not designated as newOwnerCandidate", async () => {
            await assertFails(market.claimProductOwnership("test", {from: accounts[1]}), "error_notPermitted")
        })
    })

    describe("Buying products", () => {
        let productId
        let testIndex = 0
        beforeEach(async () => {
            productId = `test_buy_${testIndex}`
            testIndex += 1
            await market.createProduct(productId, "test", accounts[3], 1, Currency.DATA, 1, {from: accounts[0]})
        })

        it("fails for bad arguments", async () => {
            await assertFails(market.buy(productId, 0, {from: accounts[0]}), "error_newSubscriptionTooSmall")
            await assertFails(market.buy(productId, 0, {from: accounts[1]}), "error_newSubscriptionTooSmall")
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
                subscriber: accounts[1],
            })
            assert(await market.hasValidSubscription(productId, accounts[1]), {from: accounts[0]})
        })

        it("activates a PurchaseListener", async () => {
            const listener = await MockCommunity.new(market.address, {from: admin})
            await market.updateProduct(productId, "test", listener.address, 1, Currency.DATA, 1, {from: accounts[0]})
            const res = await market.buy(productId, 100, {from: accounts[1]})
            assertEventBySignature(res, "PurchaseRegistered()")
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
            const [validBefore, endtimeBefore] = await market.getSubscriptionTo("test_sub", {from: accounts[1]})
            assert(validBefore)
            await market.buy("test_sub", 100, {from: accounts[1]})
            const [validAfter, endtimeAfter] = await market.getSubscriptionTo("test_sub", {from: accounts[1]})
            assert(validAfter)
            assert(endtimeAfter - endtimeBefore > 100 - testToleranceSeconds)
        })

        it("can be transferred", async () => {
            const [valid1Before, endtime1Before] = await market.getSubscription("test_sub", accounts[1])
            const [valid2Before] = await market.getSubscription("test_sub", accounts[2])
            await market.transferSubscription("test_sub", accounts[2], {from: accounts[1]})
            const [valid1After] = await market.getSubscription("test_sub", accounts[1])
            const [valid2After, endtime2After] = await market.getSubscription("test_sub", accounts[2])
            assert(valid1Before)
            assert(!valid2Before)
            assert(!valid1After)
            assert(valid2After)
            assert(endtime2After > endtime1Before - testToleranceSeconds)
        })
    })

    describe("Currency exchange rates", () => {
        before(async () => {
            await market.createProduct("test_currencies", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
        })

        it("can not be set by non-currencyUpdateAgent", async () => {
            await assertFails(market.updateExchangeRates(now(), 100, {from: accounts[0]}), "error_notPermitted")
        })

        it("getters report the correct rates", async () => {
            assertEqual(await market.dataPerUsd(), 0.1e18)
            await market.updateExchangeRates(now(), 3e18, {from: currencyUpdateAgent})
            assertEqual(await market.dataPerUsd(), 3e18)
        })

        it("getPriceInData calculates prices correctly", async () => {
            await market.updateExchangeRates(now(), 3e18, {from: currencyUpdateAgent})
            assertEqual(await market.getPriceInData(13, 1e18, Currency.DATA), 13e18)
            assertEqual(await market.getPriceInData(13, 1e18, Currency.USD), 39e18)
        })

        it("determine product price", async () => {
            await token.approve(market.address, 1000, {from: accounts[1]})
            await market.updateExchangeRates(now(), 10e18, {from: currencyUpdateAgent})
            await assertFails(market.buy("test_currencies", 200, {from: accounts[1]}))
            await market.updateExchangeRates(now(), 3e18, {from: currencyUpdateAgent})
            assertEvent(await market.buy("test_currencies", 200, {from: accounts[1]}), "Subscribed")
            assertEqual(await token.allowance(accounts[1], market.address), 1000 - (200 * 3))
        })
    })

    describe("Admin powers", () => {
        it("can't be invoked by non-admins", async () => {
            await assertFails(market.halt({from: accounts[0]}), "onlyOwner")
            await assertFails(market.resume({from: currencyUpdateAgent}), "onlyOwner")
            await assertFails(market.reInitialize(token.address, accounts[3], {from: accounts[2]}), "onlyOwner")
        })

        it("can halt product creation and buying except for the owner", async () => {
            await market.createProduct("test_admin_halt", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
            await token.approve(market.address, 1000, {from: accounts[2]})
            await token.approve(market.address, 1000, {from: admin})
            await market.buy("test_admin_halt", 100, {from: accounts[2]})

            await market.halt({from: admin})
            await assertFails(market.createProduct("test_admin_halt2", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]}), "error_halted")
            await assertFails(market.buy("test_admin_halt", 100, {from: accounts[2]}), "error_halted")
            await assertFails(market.transferSubscription("test_admin_halt", accounts[1], {from: accounts[2]}), "error_halted")
            await market.createProduct("test_admin_halt3", "test", accounts[3], 1, Currency.USD, 1, {from: admin})
            await market.buy("test_admin_halt", 100, {from: admin})

            await market.resume({from: admin})
            await market.createProduct("test_admin_halt4", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
            await market.buy("test_admin_halt4", 100, {from: accounts[2]})
        })

        it("can halt subscription and product ownership transfers", async () => {
            await market.createProduct("test_admin_halt_transfer", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
            await market.offerProductOwnership("test_admin_halt_transfer", accounts[1], {from: accounts[0]})
            await market.claimProductOwnership("test_admin_halt_transfer", {from: accounts[1]})
            await token.approve(market.address, 1000, {from: accounts[2]})
            await token.approve(market.address, 1000, {from: admin})
            await market.buy("test_admin_halt_transfer", 100, {from: accounts[2]})
            await market.transferSubscription("test_admin_halt_transfer", accounts[3], {from: accounts[2]})

            await market.halt({from: admin})
            await market.offerProductOwnership("test_admin_halt_transfer", accounts[0], {from: accounts[1]})
            await assertFails(market.claimProductOwnership("test_admin_halt_transfer", {from: accounts[0]}), "error_halted")
            await assertFails(market.transferSubscription("test_admin_halt_transfer", accounts[2], {from: accounts[3]}), "error_halted")

            await market.resume({from: admin})
            await market.claimProductOwnership("test_admin_halt_transfer", {from: accounts[0]})
            await market.transferSubscription("test_admin_halt_transfer", accounts[2], {from: accounts[3]})
        })

        it("can re-initialize the contract", async () => {
            await market.updateExchangeRates(now(), 3, {from: currencyUpdateAgent})
            await market.reInitialize(token.address, accounts[5], {from: admin})
            await assertFails(market.updateExchangeRates(now(), 5, {from: currencyUpdateAgent}), "error_notPermitted")
            await market.updateExchangeRates(now(), 5, {from: accounts[5]})
            await market.reInitialize(token.address, currencyUpdateAgent, {from: admin})
            await market.updateExchangeRates(now(), 7, {from: currencyUpdateAgent})
        })

        it("can control all products", async () => {
            await market.createProduct("test_admin_control", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
            await assertFails(market.deleteProduct("test_admin_control", {from: currencyUpdateAgent}), "error_productOwnersOnly")
            await market.deleteProduct("test_admin_control", {from: admin})
            await assertFails(market.redeployProduct("test_admin_control", {from: accounts[5]}), "error_productOwnersOnly")
            await market.redeployProduct("test_admin_control", {from: admin})
            await assertFails(market.updateProduct("test_admin_control", "lol", accounts[3], 2, Currency.DATA, 2, {from: accounts[1]}), "error_productOwnersOnly")
            await market.updateProduct("test_admin_control", "lol", accounts[3], 2, Currency.DATA, 2, {from: admin})
            await assertFails(market.offerProductOwnership("test_admin_control", accounts[1], {from: accounts[1]}), "error_productOwnersOnly")
            await market.offerProductOwnership("test_admin_control", admin, {from: admin})
        })

        it("can be transferred", async () => {
            await assertFails(market.halt({from: accounts[0]}), "onlyOwner")
            market.transferOwnership(accounts[0], {from: admin})
            market.claimOwnership({from: accounts[0]})
            await market.halt({from: accounts[0]})
            await assertFails(market.createProduct("test_admin_transfer", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[1]}), "error_halted")
            await assertFails(market.createProduct("test_admin_transfer", "test", accounts[3], 1, Currency.USD, 1, {from: admin}), "error_halted")
            await market.createProduct("test_admin_transfer", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[0]})
            market.transferOwnership(admin, {from: accounts[0]})
            market.claimOwnership({from: admin})
            await assertFails(market.resume({from: accounts[0]}), "onlyOwner")
            await market.resume({from: admin})
            await market.createProduct("test_admin_transfer2", "test", accounts[3], 1, Currency.USD, 1, {from: accounts[1]})
        })
    })
})
