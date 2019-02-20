// adapted from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/v1.12.0/test/ownership/Claimable.test.js

const { assertFails } = require("./testHelpers")

const Ownable = artifacts.require("Ownable")

contract("Ownable", (accounts) => {
    let ownable

    beforeEach(async () => {
        ownable = await Ownable.new()
    })

    it("should have an owner", async () => {
        const owner = await ownable.owner()
        assert.isTrue(owner !== 0)
    })

    it("changes pendingOwner after transfer", async () => {
        const newOwner = accounts[1]
        await ownable.transferOwnership(newOwner)
        const pendingOwner = await ownable.pendingOwner()

        assert.isTrue(pendingOwner === newOwner)
    })

    it("should prevent to claimOwnership from not-pendingOwner", async () => {
        assertFails(ownable.claimOwnership({ from: accounts[2] }), "onlyPendingOwner")
    })

    it("should prevent non-owners from transfering", async () => {
        const other = accounts[2]
        const owner = await ownable.owner.call()

        assert.isTrue(owner !== other)
        assertFails(ownable.transferOwnership(other, { from: other }), "onlyOwner")
    })

    describe("after initiating a transfer", () => {
        let newOwner

        beforeEach(async () => {
            newOwner = accounts[1]
            await ownable.transferOwnership(newOwner)
        })

        it("changes allow pending owner to claim ownership", async () => {
            await ownable.claimOwnership({ from: newOwner })
            const owner = await ownable.owner()

            assert.isTrue(owner === newOwner)
        })
    })
})
