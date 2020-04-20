const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
const Marketplace = artifacts.require("./Marketplace20180425.sol")
const Marketplace2 = artifacts.require("./Marketplace.sol")
const MockCommunity = artifacts.require("./MockCommunity.sol")
const ERC20Mintable = artifacts.require("zeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol")

const { Marketplace: { ProductState, Currency } } = require("../src/contracts/enums")

const { assertReturnValueEqual, assertEvent, assertEqual, assertFails, assertEventBySignature, now } = require("./testHelpers")
contract("Marketplace2", accounts => {
    let market
    let market2
    let market2using1api
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
        let id1 = "test1"
        let id1bytes = web3.utils.padLeft(web3.utils.asciiToHex(id1), 64)
        //product created in market2
        let id2 = "test2"
        let id2bytes = web3.utils.padLeft(web3.utils.asciiToHex(id2), 64)
        it("creates a product with correct params", async () => {
            const res = await market.createProduct(id1bytes, id1, accounts[0], 1, Currency.DATA, 1, { from: accounts[0] })
            assertEvent(res, "ProductCreated", {
                owner: accounts[0],
                id: id1,
                name: id1,
                beneficiary: accounts[0],
                pricePerSecond: 1,
                currency: Currency.DATA,
                minimumSubscriptionSeconds: 1,
            })
            assertReturnValueEqual(await market2.getProduct(id1bytes), [id1, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])

            const res2 = await market2.createProduct(id2bytes, id2, accounts[0], 1, Currency.DATA, 1, { from: accounts[0] })
            assertEvent(res2, "ProductCreated", {
                owner: accounts[0],
                id: id2,
                name: id2,
                beneficiary: accounts[0],
                pricePerSecond: 1,
                currency: Currency.DATA,
                minimumSubscriptionSeconds: 1,
            })
            assertReturnValueEqual(await market2.getProduct(id2bytes), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])
        })

        it("Marketplace2.getProduct() works using Marketplace1 ABI", async () => {
            assertReturnValueEqual(await market2using1api.getProduct(id2bytes), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed])
        })

        it("will not accept empty product ID", async () => {
            await assertFails(market2.createProduct(web3.utils.asciiToHex(""), "test", accounts[0], 1, Currency.DATA, 1, { from: accounts[1] }))
        })

        it("can only be deleted/modified by owner", async () => {
            await assertFails(market2.deleteProduct(id1bytes, { from: accounts[1] }))
            await assertFails(market2.updateProduct(id1bytes, "lol", accounts[3], 2, Currency.USD, 2, false, { from: accounts[1] }))
            await assertFails(market2.offerProductOwnership(id1bytes, accounts[1], { from: accounts[1] }))
            await assertFails(market2.deleteProduct(id2bytes, { from: accounts[1] }))
            await assertFails(market2.updateProduct(id2bytes, "lol", accounts[3], 2, Currency.USD, 2, false, { from: accounts[1] }))
            await assertFails(market2.offerProductOwnership(id2bytes, accounts[1], { from: accounts[1] }))
        })

        it("deletes the previously created product", async () => {
            assertEvent(await market2.deleteProduct(id1bytes, { from: accounts[0] }), "ProductDeleted")
            assertReturnValueEqual(await market2.getProduct(id1bytes), [id1, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.NotDeployed, false])
            assertEvent(await market2.deleteProduct(id2bytes, { from: accounts[0] }), "ProductDeleted")
            assertReturnValueEqual(await market2.getProduct(id2bytes), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.NotDeployed, false])
        })

        it("can only be redeployed by owner", async () => {
            await assertFails(market2.redeployProduct(id1bytes, { from: accounts[1] }))
            await assertFails(market2.redeployProduct(id2bytes, { from: accounts[1] }))
        })

        it("redeploys the previously deleted product", async () => {
            const res = await market2.redeployProduct(id1bytes, { from: accounts[0] })
            assertEvent(res, "ProductRedeployed")
            assertReturnValueEqual(await market2.getProduct(id1bytes), [id1, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])
            const res2 = await market2.redeployProduct(id2bytes, { from: accounts[0] })
            assertEvent(res2, "ProductRedeployed")
            assertReturnValueEqual(await market2.getProduct(id2bytes), [id2, accounts[0], accounts[0], 1, Currency.DATA, 1, ProductState.Deployed, false])
        })

        it("allows product be updated", async () => {
            const res = await market2.updateProduct(id1bytes, "lol", accounts[3], 2, Currency.USD, 2, false, { from: accounts[0] })
            assertEvent(res, "ProductUpdated", {
                owner: accounts[0],
                id: id1,
                name: "lol",
                beneficiary: accounts[3],
                pricePerSecond: 2,
                minimumSubscriptionSeconds: 2,
            })
            assertReturnValueEqual(await market2.getProduct(id1bytes), ["lol", accounts[0], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
            const res2 = await market2.updateProduct(id2bytes, "lol", accounts[3], 2, Currency.USD, 2, false, { from: accounts[0] })
            assertEvent(res2, "ProductUpdated", {
                owner: accounts[0],
                id: id2,
                name: "lol",
                beneficiary: accounts[3],
                pricePerSecond: 2,
                minimumSubscriptionSeconds: 2,
            })
            assertReturnValueEqual(await market2.getProduct(id2bytes), ["lol", accounts[0], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
        })

        it("allows ownership be transferred", async () => {
            assertEvent(await market2.offerProductOwnership(id1bytes, accounts[1], { from: accounts[0] }), "ProductOwnershipOffered", {
                owner: accounts[0],
                id: id1,
                to: accounts[1],
            })
            assertEvent(await market2.claimProductOwnership(id1bytes, { from: accounts[1] }), "ProductOwnershipChanged", {
                newOwner: accounts[1],
                id: id1,
                oldOwner: accounts[0],
            })
            assertReturnValueEqual(await market2.getProduct(id1bytes), ["lol", accounts[1], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
            assertEvent(await market2.offerProductOwnership(id2bytes, accounts[1], { from: accounts[0] }), "ProductOwnershipOffered", {
                owner: accounts[0],
                id: id2,
                to: accounts[1],
            })
            assertEvent(await market2.claimProductOwnership(id2bytes, { from: accounts[1] }), "ProductOwnershipChanged", {
                newOwner: accounts[1],
                id: id2,
                oldOwner: accounts[0],
            })
            assertReturnValueEqual(await market2.getProduct(id2bytes), ["lol", accounts[1], accounts[3], 2, Currency.USD, 2, ProductState.Deployed, false])
        })

        it("claiming fails if not designated as newOwnerCandidate", async () => {
            await assertFails(market2.claimProductOwnership(id1bytes, { from: accounts[1] }))
            await assertFails(market2.claimProductOwnership(id2bytes, { from: accounts[1] }))
        })
    })

    describe("Whitelist", () => {
        //product created in 1, subcription bought in 1

        const productId = web3.utils.padLeft(web3.utils.asciiToHex("test_wl"), 64)
        const productId2 = web3.utils.padLeft(web3.utils.asciiToHex("test_wl2"), 64)



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
            const buyer = accounts[2]
            const res1 = await market2.whitelistApprove(productId, buyer, { from: accounts[0]})
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
            const buyer = accounts[4]
            const res = await market2.whitelistReject(productId,buyer , { from: accounts[0]})
            assertEvent(res, "WhitelistRejected", {
                subscriber: buyer
            })
            await token.approve(market2.address, 1000, { from: buyer })
            await assertFails(market2.buy(productId, 100, { from: buyer }))
            await token.approve(market2.address, 0, { from: buyer })
        })
        it("whitelist request works", async () => {
            const buyer = accounts[5]
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
            const buyer = accounts[2]
            await assertFails(market2.whitelistRequest(productId2, { from: buyer}))
            const res = await market2.setRequiresWhitelist(productId2, true, {from: accounts[0]} )
            assertEvent(res, "WhitelistEnabled", {
                productId: productId2
            })

            const res2 = await market2.whitelistRequest(productId2, { from: buyer})
            assertEvent(res2, "WhitelistRequested", {
                subscriber: buyer
            })

            await assertFails(market2.buy(productId2, 100, { from: buyer }))
            const res3 = await market2.whitelistApprove(productId2, buyer, { from: accounts[0]})
            assertEvent(res3, "WhitelistApproved", {
                subscriber: buyer
            })
            const res4 = await market2.buy(productId2, 100, { from: buyer })
            assertEvent(res4, "NewSubscription", {
                subscriber: buyer,
            })

            const res5 = await market2.setRequiresWhitelist(productId2, false, {from: accounts[0]} )
            assertEvent(res5, "WhitelistDisabled", {
                productId: productId2
            })
            //now whitelist should be disabled
            await token.approve(market2.address, 1000, { from: accounts[4] })

            const res6 = await market2.buy(productId2, 100, { from: accounts[4] })
            assertEvent(res6, "NewSubscription", {
                subscriber: accounts[4]
            })

        })


    })

    describe("Buying products", () => {
        let productId1
        let productId2
        let productId1bytes
        let productId2bytes
        let testIndex = 0
        beforeEach(async () => {
            productId1 = `test_buy1_${testIndex}`
            productId2 = `test_buy2_${testIndex}`
            productId1bytes = web3.utils.padLeft(web3.utils.asciiToHex(productId1), 64)
            productId2bytes = web3.utils.padLeft(web3.utils.asciiToHex(productId2), 64)

            testIndex += 1
            await market.createProduct(productId1bytes, productId1, accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })
            await market2.createProduct(productId2bytes, productId2, accounts[3], 1, Currency.DATA, 1, { from: accounts[0] })

        })

        it("setTxFee access control works", async () => {
            await assertFails(market2.setTxFee(1, { from: accounts[0] }))
            const badFee = w3.utils.toWei("1.1", "ether")
            await assertFails(market2.setTxFee(badFee, { from: admin }))
        })

        it("txFee works", async () => {
            const fee = w3.utils.toWei("0.25", "ether")
            const res = await market2.setTxFee(fee, { from: admin })
            assertEvent(res, "TxFeeChanged", {
                newTxFee: fee,
            })

            //enough approved with added fee
            await token.approve(market2.address, 0, { from: accounts[1] })
            await token.approve(market2.address, 1000, { from: accounts[1] })
            const ownerBefore = await token.balanceOf(admin)
            const sellerBefore = await token.balanceOf(accounts[3])
            await market2.buy(productId1bytes, 1000, { from: accounts[1] })

            /*
            NOTE assertEvent only tests for events in the executed contract, not ancillary contracts.
            So this doesn't work:
            assertEvent(buyres, "Transfer", {
                _from: accounts[1],
                _to: admin,
                _value: 500
            })

            TODO: try to patch assertEvent to check ancillary contract events. See how truffle decodes.
            */

            // fee is correct
            const ownerAfter = await token.balanceOf(admin)
            const sellerAfter = await token.balanceOf(accounts[3])
            assert(ownerAfter - ownerBefore == 250)
            assert(sellerAfter - sellerBefore == 750)

            const res2 = await market2.setTxFee(0, { from: admin })
            assertEvent(res2, "TxFeeChanged", {
                newTxFee: 0,
            })

        })

        it("fails for bad arguments", async () => {
            await assertFails(market2.buy(productId1, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId1, 0, { from: accounts[1] }))
            await assertFails(market2.buy(productId2, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId2, 0, { from: accounts[1] }))
        })

        it("txFee works", async () => {
            const fee = w3.utils.toWei("0.25", "ether")
            const res = await market2.setTxFee(fee, { from: admin })
            assertEvent(res, "TxFeeChanged", {
                newTxFee: fee,
            })

            //enough approved with added fee
            await token.approve(market2.address, 0, { from: accounts[1] })
            await token.approve(market2.address, 1000, { from: accounts[1] })
            const ownerBefore = await token.balanceOf(admin)
            const sellerBefore = await token.balanceOf(accounts[3])
            await market2.buy(productId1bytes, 1000, { from: accounts[1] })

            /*
            NOTE assertEvent only tests for events in the executed contract, not ancillary contracts.
            So this doesn't work:
            assertEvent(buyres, "Transfer", {
                _from: accounts[1],
                _to: admin,
                _value: 500
            })

            TODO: try to patch assertEvent to check ancillary contract events. See how truffle decodes.
            */

            // fee is correct
            const ownerAfter = await token.balanceOf(admin)
            const sellerAfter = await token.balanceOf(accounts[3])
            assert(ownerAfter - ownerBefore == 250)
            assert(sellerAfter - sellerBefore == 750)

            const res2 = await market2.setTxFee(0, { from: admin })
            assertEvent(res2, "TxFeeChanged", {
                newTxFee: 0,
            })

        })

        it("fails for bad arguments", async () => {
            await assertFails(market2.buy(productId1bytes, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId1bytes, 0, { from: accounts[1] }))
            await assertFails(market2.buy(productId2bytes, 0, { from: accounts[0] }))
            await assertFails(market2.buy(productId2bytes, 0, { from: accounts[1] }))
        })

        it("fails if allowance not given", async () => {
            await assertFails(market2.buy(productId1bytes, 100, { from: accounts[0] }))
            await assertFails(market2.buy(productId1bytes, 100, { from: accounts[1] }))
            await assertFails(market2.buy(productId2bytes, 100, { from: accounts[0] }))
            await assertFails(market2.buy(productId2bytes, 100, { from: accounts[1] }))
        })

        it("fails if too little allowance was given", async () => {
            await token.approve(market2.address, 10, { from: accounts[1] })
            await assertFails(market2.buy(productId1bytes, 100, { from: accounts[1] }))
            await assertFails(market2.buy(productId2bytes, 100, { from: accounts[1] }))

        })

        it("works if enough allowance was given", async () => {
            await token.approve(market2.address, 1000, { from: accounts[1] })
            const res = await market2.buy(productId1bytes, 100, { from: accounts[1] })

            // test complains about productId not being undefined:
            assertEvent(res, "NewSubscription", {
                //               productId,
                subscriber: accounts[1],
            })
            assert(await market2.hasValidSubscription(productId1bytes, accounts[1]), { from: accounts[0] })

            const res2 = await market2.buy(productId2bytes, 100, { from: accounts[1] })
            assertEvent(res2, "NewSubscription", {
                //                productId,
                subscriber: accounts[1],
            })
            assert(await market2.hasValidSubscription(productId2bytes, accounts[1]), { from: accounts[0] })

        })

        it("activates a PurchaseListener", async () => {
            const listener = await MockCommunity.new(market2.address, { from: admin })
            await market2.updateProduct(productId1bytes, "test", listener.address, 1, Currency.DATA, 1, false, { from: accounts[0] })
            const res = await market2.buy(productId1bytes, 100, { from: accounts[1] })
            assertEventBySignature(res, "PurchaseRegistered()")
            await market2.updateProduct(productId2bytes, "test", listener.address, 1, Currency.DATA, 1, false, { from: accounts[0] })
            const res2 = await market2.buy(productId2bytes, 100, { from: accounts[1] })
            assertEventBySignature(res2, "PurchaseRegistered()")

            //should check the return value of onPurchase and revert if false
            await listener.setReturnVal(false, { from: accounts[0] })
            await assertFails(market2.buy(productId1bytes, 100, { from: accounts[1] }))
            await assertFails(market2.buy(productId2bytes, 100, { from: accounts[1] }))
        })

        it("can pay to non-PurchaseListener contracts", async () => {
            const seller = await Marketplace.new(token.address, currencyUpdateAgent, { from: admin })
            const balanceBefore = await token.balanceOf(seller.address, {from: accounts[0]})
            await market2.updateProduct(productId1bytes, "test", seller.address, 1, Currency.DATA, 1, false, { from: accounts[0] })
            await market2.buy(productId1bytes, 100, { from: accounts[1] })
            const balanceAfter = await token.balanceOf(seller.address, {from: accounts[0]})
            assert.strictEqual(+balanceBefore, 0)
            assert.strictEqual(+balanceAfter, 100)
        })

        it("can pay to non-contract addresses", async () => {
            const sellerAddress = "0x1234567890123456789012345678901234567890"
            const balanceBefore = await token.balanceOf(sellerAddress, {from: accounts[0]})
            await market2.updateProduct(productId1bytes, "test", sellerAddress, 1, Currency.DATA, 1, false, { from: accounts[0] })
            await market2.buy(productId1bytes, 100, { from: accounts[1] })
            const balanceAfter = await token.balanceOf(sellerAddress, {from: accounts[0]})
            assert.strictEqual(+balanceBefore, 0)
            assert.strictEqual(+balanceAfter, 100)
        })
    })

    describe("Subscription", () => {
        const testToleranceSeconds = 5
        //product created in 1, subcription bought in 1
        const productId1 = web3.utils.padLeft(web3.utils.asciiToHex("test_sub"), 64)
        //product created in 2, subcription bought in 2
        const productId2 = web3.utils.padLeft(web3.utils.asciiToHex("test_sub2"), 64)
        //product created in 1, subcription bought in 2
        const productId12 = web3.utils.padLeft(web3.utils.asciiToHex("test_sub12"), 64)
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
            await assertFails(market2.grantSubscription(productId1, 100, accounts[5], { from: accounts[5] }))
            await assertFails(market2.grantSubscription(productId2, 100, accounts[5], { from: accounts[5] }))
            await assertFails(market2.grantSubscription(productId12, 100, accounts[5], { from: accounts[5] }))
        })

        it("grant works for owner", async () => {
            async function testGrant(_productId) {
                const subBefore = await market2.getSubscriptionTo(_productId, { from: accounts[5] })
                market2.grantSubscription(_productId, 100, accounts[5], { from: accounts[0] })
                const subAfter = await market2.getSubscriptionTo(_productId, { from: accounts[5] })
                assert(subAfter.isValid)
                assert(subAfter.endTimestamp - subBefore.endTimestamp > 100 - testToleranceSeconds)
            }
            await testGrant(productId1)
            await testGrant(productId2)
            await testGrant(productId12)
        })

        it("can be extended", async () => {
            async function testExtension(pid) {
                const subBefore = await market2.getSubscriptionTo(pid, { from: accounts[1] })
                assert(subBefore.isValid)
                await market2.buy(pid, 100, { from: accounts[1] })
                const subAfter = await market2.getSubscriptionTo(pid, { from: accounts[1] })
                assert(subAfter.isValid)
                assert(subAfter.endTimestamp - subBefore.endTimestamp > 100 - testToleranceSeconds)
            }
            await testExtension(productId1)
            await testExtension(productId2)
            await testExtension(productId12)
        })

    })

    describe("Currency exchange rates", () => {
        before(async () => {
            const id = web3.utils.padLeft(web3.utils.asciiToHex("test_currencies"), 64)
            await market2.createProduct(id, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
        })

        it("can not be set by non-currencyUpdateAgent", async () => {
            await assertFails(market2.updateExchangeRates(now(), 100, { from: accounts[0] }))
        })

        it("getters report the correct rates", async () => {
            assertEqual(await market2.dataPerUsd(), 0.1e18)
            await market2.updateExchangeRates(now(), web3.utils.toBN(3e18), { from: currencyUpdateAgent })
            assertEqual(await market2.dataPerUsd(), 3e18)
        })

        it("getPriceInData calculates prices correctly", async () => {
            await market2.updateExchangeRates(now(), web3.utils.toBN(3e18), { from: currencyUpdateAgent })
            assertEqual(await market2.getPriceInData(web3.utils.toBN(13), web3.utils.toBN(1e18), Currency.DATA), 13e18)
            assertEqual(await market2.getPriceInData(web3.utils.toBN(13), web3.utils.toBN(1e18), Currency.USD), 39e18)
        })

        it("determine product price", async () => {
            const id = web3.utils.padLeft(web3.utils.asciiToHex("test_currencies"), 64)
            await token.approve(market2.address, 1000, { from: accounts[1] })
            await market2.updateExchangeRates(now(), web3.utils.toBN(10e18), { from: currencyUpdateAgent })
            await assertFails(market2.buy(id, 200, { from: accounts[1] }))
            await market2.updateExchangeRates(now(), web3.utils.toBN(3e18), { from: currencyUpdateAgent })
            assertEvent(await market2.buy(id, 200, { from: accounts[1] }), "Subscribed")
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
            const id = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_halt"), 64)
            const id2 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_halt2"), 64)
            const id3 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_halt3"), 64)
            const id4 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_halt4"), 64)

            await market2.createProduct(id, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await token.approve(market2.address, 1000, { from: accounts[2] })
            await token.approve(market2.address, 1000, { from: admin })
            await market2.buy(id, 100, { from: accounts[2] })

            await market2.halt({ from: admin })
            await assertFails(market2.createProduct(id2, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] }))
            await assertFails(market2.buy(id, 100, { from: accounts[2] }))
            await market2.createProduct(id3, "test", accounts[3], 1, Currency.USD, 1, { from: admin })
            await market2.buy(id, 100, { from: admin })

            await market2.resume({ from: admin })
            await market2.createProduct(id4, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await market2.buy(id4, 100, { from: accounts[2] })
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
            let productId1 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_halt_transfer1"), 64)
            let productId2 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_halt_transfer2"), 64)

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
                await assertFails(market2.updateProduct(_productId, "lol", accounts[3], 2, Currency.DATA, 2, false, { from: accounts[1] }))
                await market2.updateProduct(_productId, "lol", accounts[3], 2, Currency.DATA, 2, false, { from: admin })
                await assertFails(market2.offerProductOwnership(_productId, accounts[1], { from: accounts[1] }))
                await market2.offerProductOwnership(_productId, admin, { from: admin })
            }

            let productId1 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_control1"), 64)
            let productId2 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_control2"), 64)

            await market.createProduct(productId1, productId1, accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            await market2.createProduct(productId2, productId2, accounts[3], 1, Currency.USD, 1, { from: accounts[0] })

            await testControl(productId1)
            await testControl(productId2)
        })

        it("can be transferred", async () => {
            let productId = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_transfer"), 64)
            let productId2 = web3.utils.padLeft(web3.utils.asciiToHex("test_admin_transfer2"), 64)


            await assertFails(market2.halt({ from: accounts[0] }))
            market2.transferOwnership(accounts[0], { from: admin })
            market2.claimOwnership({ from: accounts[0] })
            await market2.halt({ from: accounts[0] })
            await assertFails(market2.createProduct(productId, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[1] }))
            await assertFails(market2.createProduct(productId, "test", accounts[3], 1, Currency.USD, 1, { from: admin }))
            await market2.createProduct(productId, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[0] })
            market2.transferOwnership(admin, { from: accounts[0] })
            market2.claimOwnership({ from: admin })
            await assertFails(market2.resume({ from: accounts[0] }))
            await market2.resume({ from: admin })
            await market2.createProduct(productId2, "test", accounts[3], 1, Currency.USD, 1, { from: accounts[1] })
        })
    })
})
