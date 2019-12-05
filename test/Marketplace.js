const Marketplace = artifacts.require("./Marketplace20180425.sol")
const Marketplace2 = artifacts.require("./Marketplace.sol")
const MockCommunity = artifacts.require("./MockCommunity.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")

const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")

const { assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")

contract("Marketplace2", accounts => {
    let market
    let market2
    let token
    const currencyUpdateAgent = accounts[9]
    const admin = accounts[8]
    before(async () => {
        token = await ERC20Mintable.new({ from: accounts[0] })
        await Promise.all(accounts.map(acco => token.mint(acco, 1000000)))
        market = await Marketplace.new(token.address, currencyUpdateAgent, { from: admin })
        market2 = await Marketplace2.new(token.address, currencyUpdateAgent, market.address, { from: admin })
        market2using1api = await Marketplace.at(market2.address)
    })

    // function getProduct(bytes32 id) public view
    // returns (string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds, ProductState state)
    describe("Creating, deleting products in market1 and market2", () => {
        //product created in market1
        let id1 = "test1";
        //product created in market2
        let id2 = "test2";
        it("creates a product with correct params", async () => {
            const res = await market.createProduct(id1, id1, accounts[0], 1, Currency.DATA, 1, { from: accounts[0] })
            assertEvent(res, "ProductCreated", {
                owner: accounts[0],
                id: id1,
                name: id1,
                beneficiary: accounts[0],
                pricePerSecond: 1,
                currency: Currency.DATA,
                minimumSubscriptionSeconds: 1,
            })
            assertEqual(await market2.getProduct(id1), [id1, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])

            const res2 = await market2.createProduct(id2, id2, accounts[0], 1, Currency.DATA, 1, { from: accounts[0] })
            assertEvent(res2, "ProductCreated", {
                owner: accounts[0],
                id: id2,
                name: id2,
                beneficiary: accounts[0],
                pricePerSecond: 1,
                currency: Currency.DATA,
                minimumSubscriptionSeconds: 1,
            })
            assertEqual(await market2.getProduct(id2), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])
        })

        it("Marketplace2.getProduct() works using Marketplace1 ABI", async () => {
            assertEqual(await market2using1api.getProduct(id2), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed])
        })

        it("will not accept empty product ID", async () => {
            await assertFails(market2.createProduct("", "test", accounts[0], 1, Currency.DATA, 1, { from: accounts[1] }))
        })

        it("can only be deleted/modified by owner", async () => {
            await assertFails(market2.deleteProduct(id1, { from: accounts[1] }))
            await assertFails(market2.updateProduct(id1, "lol", accounts[3], 2, Currency.USD, 2, { from: accounts[1] }))
            await assertFails(market2.offerProductOwnership(id1, accounts[1], { from: accounts[1] }))
            await assertFails(market2.deleteProduct(id2, { from: accounts[1] }))
            await assertFails(market2.updateProduct(id2, "lol", accounts[3], 2, Currency.USD, 2, { from: accounts[1] }))
            await assertFails(market2.offerProductOwnership(id2, accounts[1], { from: accounts[1] }))
        })

        it("deletes the previously created product", async () => {
            assertEvent(await market2.deleteProduct(id1, { from: accounts[0] }), "ProductDeleted")
            assertEqual(await market2.getProduct(id1), [id1, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.NotDeployed, false])
            assertEvent(await market2.deleteProduct(id2, { from: accounts[0] }), "ProductDeleted")
            assertEqual(await market2.getProduct(id2), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.NotDeployed, false])
        })

        it("can only be redeployed by owner", async () => {
            await assertFails(market2.redeployProduct(id1, { from: accounts[1] }))
            await assertFails(market2.redeployProduct(id2, { from: accounts[1] }))
        })

        it("redeploys the previously deleted product", async () => {
            const res = await market2.redeployProduct(id1, { from: accounts[0] })
            assertEvent(res, "ProductRedeployed")
            assertEqual(await market2.getProduct(id1), [id1, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])
            const res2 = await market2.redeployProduct(id2, { from: accounts[0] })
            assertEvent(res2, "ProductRedeployed")
            assertEqual(await market2.getProduct(id2), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])
        })

        it("allows product be updated", async () => {
            const res = await market2.updateProduct(id1, "lol", accounts[3], 2, Currency.USD, 2, { from: accounts[0] })
            assertEvent(res, "ProductUpdated", {
                owner: accounts[0],
                id: id1,
                name: "lol",
                beneficiary: accounts[3],
                pricePerSecond: 2,
                minimumSubscriptionSeconds: 2,
            })
            assertEqual(await market2.getProduct(id1), ["lol", accounts[0], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
            const res2 = await market2.updateProduct(id2, "lol", accounts[3], 2, Currency.USD, 2, { from: accounts[0] })
            assertEvent(res2, "ProductUpdated", {
                owner: accounts[0],
                id: id2,
                name: "lol",
                beneficiary: accounts[3],
                pricePerSecond: 2,
                minimumSubscriptionSeconds: 2,
            })
            assertEqual(await market2.getProduct(id2), ["lol", accounts[0], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
        })

        it("allows ownership be transferred", async () => {
            assertEvent(await market2.offerProductOwnership(id1, accounts[1], { from: accounts[0] }), "ProductOwnershipOffered", {
                owner: accounts[0],
                id: id1,
                to: accounts[1],
            })
            assertEvent(await market2.claimProductOwnership(id1, { from: accounts[1] }), "ProductOwnershipChanged", {
                newOwner: accounts[1],
                id: id1,
                oldOwner: accounts[0],
            })
            assertEqual(await market2.getProduct(id1), ["lol", accounts[1], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
            assertEvent(await market2.offerProductOwnership(id2, accounts[1], { from: accounts[0] }), "ProductOwnershipOffered", {
                owner: accounts[0],
                id: id2,
                to: accounts[1],
            })
            assertEvent(await market2.claimProductOwnership(id2, { from: accounts[1] }), "ProductOwnershipChanged", {
                newOwner: accounts[1],
                id: id2,
                oldOwner: accounts[0],
            })
            assertEqual(await market2.getProduct(id2), ["lol", accounts[1], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
        })

        it("claiming fails if not designated as newOwnerCandidate", async () => {
            await assertFails(market2.claimProductOwnership(id1, { from: accounts[1] }))
            await assertFails(market2.claimProductOwnership(id2, { from: accounts[1] }))
        })
    })

    describe("Whitelist", () => {
        //product created in 1, subcription bought in 1
        const productId = "test_wl"
        const productId2 = "test_wl2"
        
        before(async () => {
            await market2.createProductWithWhitelist(productId, "test", accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await market2.createProduct(productId2, "test", accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await token.approve(market2.address, 1000, { from: accounts[2] })
        })
        it("purchase rejected if not on whitelist", async () => {
            await assertFails(market2.buy(productId, 123, { from: accounts[2] }))
        })
        it("non-owner cant approve whitelist", async () => {
            await assertFails(market2.whitelistApprove(productId, accounts[2], { from: accounts[2] }))
        })
        it("owner can approve whitelist and buyer can buy", async () => {
            const buyer=accounts[2]
            const res1=await market2.whitelistApprove(productId, buyer, { from: accounts[0]})
            assertEvent(res1, "WhitelistApproved", {
                subscriber: buyer
            })
            const res2 = await market2.buy(productId, 100, { from: buyer })
            assertEvent(res2, "NewSubscription", {
                subscriber: buyer,
            })
            assert(await market2.hasValidSubscription(productId, buyer), { from: buyer })
        })

        it("onwer can reject whitelist and buyer cannot buy", async () => {
            const buyer=accounts[4];
            const res = await market2.whitelistReject(productId,buyer , { from: accounts[0]})
            assertEvent(res, "WhitelistRejected", {
                subscriber: buyer
            })
            await token.approve(market2.address, 1000, { from: buyer })
            await assertFails(market2.buy(productId, 100, { from: buyer }))
            await token.approve(market2.address, 0, { from: buyer })
        })
        it("whitelist request works", async () => {
            const buyer=accounts[5];
            const res = await market2.whitelistRequest(productId, { from: buyer})
            assertEvent(res, "WhitelistRequested", {
                subscriber: buyer
            })
            //should fail if already on whitelist
            await assertFails(market2.whitelistRequest(productId, { from: buyer}))
            await token.approve(market2.address, 1000, { from: buyer })
            await assertFails(market2.buy(productId, 100, { from: buyer }))
            await token.approve(market2.address, 0, { from: buyer })
        })

        it("can activate and deactivate whitelist feature", async () => {
            const buyer=accounts[2]
            await assertFails(market2.whitelistRequest(productId2, { from: buyer}))
            const res = await market2.setRequiresWhitelist(productId2, true, {from: accounts[0]} )
            assertEvent(res, "WhitelistEnabled", {
                productId: productId2
            })

            const res2= await market2.whitelistRequest(productId2, { from: buyer})
            assertEvent(res2, "WhitelistRequested", {
                subscriber: buyer
            })
            await assertFails(market2.buy(productId2, 100, { from: buyer }))
            const res3=await market2.whitelistApprove(productId2, buyer, { from: accounts[0]})
            assertEvent(res3, "WhitelistApproved", {
                subscriber: buyer
            })
            const res4= await market2.buy(productId2, 100, { from: buyer })
            assertEvent(res4, "NewSubscription", {
                subscriber: buyer,
            })

            const res5 = await market2.setRequiresWhitelist(productId2, false, {from: accounts[0]} )
            assertEvent(res5, "WhitelistDisabled", {
                productId: productId2
            })
            //now whitelist should be disabled
            await token.approve(market2.address, 1000, { from: accounts[4] })

            const res6= await market2.buy(productId2, 100, { from: accounts[4] })
            assertEvent(res6, "NewSubscription", {
                subscriber: accounts[4]
            })

        })


    })

    describe("Buying products", () => {
        let productId
        let testIndex = 0
        beforeEach(async () => {
            productId1 = `test_buy1_${testIndex}`
            productId2 = `test_buy2_${testIndex}`
            testIndex += 1
            await market.createProduct(productId1, productId1, accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await market2.createProduct(productId2, productId2, accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })

        })

        it("fails for bad arguments", async () => {
            await assertFails(market2.buy(productId1, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId1, 0, { from: accounts[1] }))
            await assertFails(market2.buy(productId2, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId2, 0, { from: accounts[1] }))
        })


        it("fails for bad arguments", async () => {
            await assertFails(market2.buy(productId1, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId1, 0, { from: accounts[1] }))
            await assertFails(market2.buy(productId2, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId2, 0, { from: accounts[1] }))
        })

        it("fails if allowance not given", async () => {
            await assertFails(market2.buy(productId1, 100, { from: accounts[0] }))
            await assertFails(market2.buy(productId1, 100, { from: accounts[1] }))
            await assertFails(market2.buy(productId2, 100, { from: accounts[0] }))
            await assertFails(market2.buy(productId2, 100, { from: accounts[1] }))
        })

        it("fails if too little allowance was given", async () => {
            await token.approve(market2.address, 10, { from: accounts[1] })
            await assertFails(market2.buy(productId1, 100, { from: accounts[1] }))
            await assertFails(market2.buy(productId2, 100, { from: accounts[1] }))

        })

        it("works if enough allowance was given", async () => {
            await token.approve(market2.address, 1000, { from: accounts[1] })
            const res = await market2.buy(productId1, 100, { from: accounts[1] })

            // test complains about productId not being undefined:
            assertEvent(res, "NewSubscription", {
                //               productId,
                subscriber: accounts[1],
            })
            assert(await market2.hasValidSubscription(productId1, accounts[1]), { from: accounts[0] })

            const res2 = await market2.buy(productId2, 100, { from: accounts[1] })
            assertEvent(res2, "NewSubscription", {
                //                productId,
                subscriber: accounts[1],
            })
            assert(await market2.hasValidSubscription(productId2, accounts[1]), { from: accounts[0] })

        })

        it("activates a PurchaseListener", async () => {
            const listener = await MockCommunity.new(market2.address, { from: admin })
            await market2.updateProduct(productId1, "test", listener.address, 1, Currency.DATA, 1, { from: accounts[0] })
            const res = await market2.buy(productId1, 100, { from: accounts[1] })
            assertEventBySignature(res, "PurchaseRegistered()")
            await market2.updateProduct(productId2, "test", listener.address, 1, Currency.DATA, 1, { from: accounts[0] })
            const res2 = await market2.buy(productId2, 100, { from: accounts[1] })
            assertEventBySignature(res2, "PurchaseRegistered()")

        })
    })

    describe("Subscription", () => {
        const testToleranceSeconds = 5
        //product created in 1, subcription bought in 1
        const productId1 = "test_sub"
        //product created in 2, subcription bought in 2
        const productId2 = "test_sub2"
        //product created in 1, subcription bought in 2
        const productId12 = "test_sub12"
        before(async () => {
            await market.createProduct(productId1, "test", accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await market.createProduct(productId12, "test", accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await market2.createProduct(productId2, "test", accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await token.approve(market.address, 1000, { from: accounts[1] })
            await token.approve(market2.address, 1000, { from: accounts[1] })
            await market.buy(productId1, 100, { from: accounts[1] })
            await market2.buy(productId2, 100, { from: accounts[1] })
            await market2.buy(productId12, 100, { from: accounts[1] })

        })


        it("grant fails for non-owner", async () => {
            await assertFails(market2.grantSubscription(productId1, 100, accounts[5], { from: accounts[5] }));
            await assertFails(market2.grantSubscription(productId2, 100, accounts[5], { from: accounts[5] }));
            await assertFails(market2.grantSubscription(productId12, 100, accounts[5], { from: accounts[5] }));
        })

        it("grant works for owner", async () => {
            async function testGrant(_productId) {
                const [validBefore, endtimeBefore] = await market2.getSubscriptionTo(_productId, { from: accounts[5] })
                market2.grantSubscription(_productId, 100, accounts[5], { from: accounts[0] })
                const [validAfter, endtimeAfter] = await market2.getSubscriptionTo(_productId, { from: accounts[5] })
                assert(validAfter)
                assert(endtimeAfter - endtimeBefore > 100 - testToleranceSeconds)
            }
            testGrant(productId1)
            testGrant(productId2)
            testGrant(productId12)
        })

        it("can be extended", async () => {
            async function testExtension(_productId) {
                const [validBefore, endtimeBefore] = await market2.getSubscriptionTo("test_sub", { from: accounts[1] })
                assert(validBefore)
                await market2.buy("test_sub", 100, { from: accounts[1] })
                const [validAfter, endtimeAfter] = await market2.getSubscriptionTo("test_sub", { from: accounts[1] })
                assert(validAfter)
                assert(endtimeAfter - endtimeBefore > 100 - testToleranceSeconds)
            }
            testExtension(productId1)
            testExtension(productId2)
            testExtension(productId12)
        })

    })

    describe("Currency exchange rates", () => {
        before(async () => {
            await market2.createProduct("test_currencies", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
        })

        it("can not be set by non-currencyUpdateAgent", async () => {
            await assertFails(market2.updateExchangeRates(now(), 100, { from: accounts[0] }))
        })

        it("getters report the correct rates", async () => {
            assertEqual(await market2.dataPerUsd(), 0.1e18)
            await market2.updateExchangeRates(now(), 3e18, { from: currencyUpdateAgent })
            assertEqual(await market2.dataPerUsd(), 3e18)
        })

        it("getPriceInData calculates prices correctly", async () => {
            await market2.updateExchangeRates(now(), 3e18, { from: currencyUpdateAgent })
            assertEqual(await market2.getPriceInData(13, 1e18, Currency.DATA), 13e18)
            assertEqual(await market2.getPriceInData(13, 1e18, Currency.USD), 39e18)
        })

        it("determine product price", async () => {
            await token.approve(market2.address, 1000, { from: accounts[1] })
            await market2.updateExchangeRates(now(), 10e18, { from: currencyUpdateAgent })
            await assertFails(market2.buy("test_currencies", 200, { from: accounts[1] }))
            await market2.updateExchangeRates(now(), 3e18, { from: currencyUpdateAgent })
            assertEvent(await market2.buy("test_currencies", 200, { from: accounts[1] }), "Subscribed")
            assertEqual(await token.allowance(accounts[1], market2.address), 1000 - (200 * 3))
        })
    })

    describe("Admin powers", () => {

        it("can't be invoked by non-admins", async () => {
            await assertFails(market2.halt({ from: accounts[0] }))
            await assertFails(market2.resume({ from: currencyUpdateAgent }))
            await assertFails(market2.reInitialize(token.address, accounts[3], { from: accounts[2] }))
        })

        it("can halt product creation and buying except for the owner", async () => {
            await market2.createProduct("test_admin_halt", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await token.approve(market2.address, 1000, { from: accounts[2] })
            await token.approve(market2.address, 1000, { from: admin })
            await market2.buy("test_admin_halt", 100, { from: accounts[2] })

            await market2.halt({ from: admin })
            await assertFails(market2.createProduct("test_admin_halt2", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] }))
            await assertFails(market2.buy("test_admin_halt", 100, { from: accounts[2] }))
            await market2.createProduct("test_admin_halt3", "test", accounts[3], 1, Currency.USD, 1, { from: admin })
            await market2.buy("test_admin_halt", 100, { from: admin })

            await market2.resume({ from: admin })
            await market2.createProduct("test_admin_halt4", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await market2.buy("test_admin_halt4", 100, { from: accounts[2] })
        })


        it("can halt subscription and product ownership transfers", async () => {
            async function testOwnerHalt(_productId) {

                await market2.offerProductOwnership(_productId, accounts[1], { from: accounts[0] })
                await market2.claimProductOwnership(_productId, { from: accounts[1] })
                await token.approve(market2.address, 1000, { from: accounts[2] })
                await token.approve(market2.address, 1000, { from: admin })
                await market2.buy(_productId, 100, { from: accounts[2] })

                await market2.halt({ from: admin })
                await market2.offerProductOwnership(_productId, accounts[0], { from: accounts[1] })
                await assertFails(market2.claimProductOwnership(_productId, { from: accounts[0] }))

                await market2.resume({ from: admin })
                await market2.claimProductOwnership(_productId, { from: accounts[0] })

            }
            let productId1 = "test_admin_halt_transfer1";
            let productId2 = "test_admin_halt_transfer2";

            await market.createProduct(productId1, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await market2.createProduct(productId2, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })

            await testOwnerHalt(productId1)
            await testOwnerHalt(productId2)

        })

        it("can re-initialize the contract", async () => {
            await market2.updateExchangeRates(now(), 3, { from: currencyUpdateAgent })
            await market2.reInitialize(token.address, accounts[5], market.address, { from: admin })
            await assertFails(market2.updateExchangeRates(now(), 5, { from: currencyUpdateAgent }))
            await market2.updateExchangeRates(now(), 5, { from: accounts[5] })
            await market2.reInitialize(token.address, currencyUpdateAgent, market.address, { from: admin })
            await market2.updateExchangeRates(now(), 7, { from: currencyUpdateAgent })
        })

        it("can control all products", async () => {
            async function testControl(_productId) {
                await assertFails(market2.deleteProduct(_productId, { from: currencyUpdateAgent }))
                await market2.deleteProduct(_productId, { from: admin })
                await assertFails(market2.redeployProduct(_productId, { from: accounts[5] }))
                await market2.redeployProduct(_productId, { from: admin })
                await assertFails(market2.updateProduct(_productId, "lol", accounts[3], 2, Currency.DATA, 2, { from: accounts[1] }))
                await market2.updateProduct(_productId, "lol", accounts[3], 2, Currency.DATA, 2, { from: admin })
                await assertFails(market2.offerProductOwnership(_productId, accounts[1], { from: accounts[1] }))
                await market2.offerProductOwnership(_productId, admin, { from: admin })
            }

            const productId1 = "test_admin_control1";
            const productId2 = "test_admin_control2";
            await market.createProduct(productId1, productId1, accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await market2.createProduct(productId2, productId2, accounts[3], 1, Currency.USD, 1, { from: accounts[0] })

            await testControl(productId1)
            await testControl(productId2)

        })

        it("can be transferred", async () => {
            await assertFails(market2.halt({ from: accounts[0] }))
            market2.transferOwnership(accounts[0], { from: admin })
            market2.claimOwnership({ from: accounts[0] })
            await market2.halt({ from: accounts[0] })
            await assertFails(market2.createProduct("test_admin_transfer", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[1] }))
            await assertFails(market2.createProduct("test_admin_transfer", "test", accounts[3], 1, Currency.USD, 1, { from: admin }))
            await market2.createProduct("test_admin_transfer", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            market2.transferOwnership(admin, { from: accounts[0] })
            market2.claimOwnership({ from: admin })
            await assertFails(market2.resume({ from: accounts[0] }))
            await market2.resume({ from: admin })
            await market2.createProduct("test_admin_transfer2", "test", accounts[3], 1, Currency.USD, 1, { from: accounts[1] })
        })
    })
})
