const MarketplacePrev = artifacts.require('./Marketplace20180425.sol')
const Marketplace = artifacts.require('./Marketplace.sol')
const BancorAdaptor = artifacts.require('./BancorAdaptor.sol')
const ERC20Mintable = artifacts.require('./ERC20Mintable.sol')
const MockBancorConverter = artifacts.require('./MockBancorConverter.sol')

const Web3 = require('web3')

const { Marketplace: { Currency } } = require('../src/contracts/enums')

const w3 = new Web3(web3.currentProvider)

const { assertEqual, assertFails } = require('./testHelpers')

contract('BancorAdaptor', (accounts) => {
    let market
    let marketPrev
    let fromToken
    let dataToken
    let bancorConverter
    let bancorAdaptor
    const creator = accounts[0]
    const currencyUpdateAgent = accounts[1]
    const buyer = accounts[2]
    const streamOwner = accounts[3]
    const productId = '0x123'
    // const testToleranceSeconds = 5
    before(async () => {
        bancorConverter = await MockBancorConverter.new({
            from: creator
        })
        fromToken = await ERC20Mintable.new({
            from: creator
        })
        dataToken = await ERC20Mintable.new({
            from: creator
        })
        marketPrev = await MarketplacePrev.new(dataToken.address, currencyUpdateAgent, {
            from: creator
        })
        market = await Marketplace.new(dataToken.address, currencyUpdateAgent, marketPrev.address, {
            from: creator
        })
        bancorAdaptor = await BancorAdaptor.new(market.address, bancorConverter.address, dataToken.address, {
            from: creator
        })
        await market.createProduct(productId, 'testproduct', streamOwner, w3.utils.toWei('1'), Currency.DATA, 1, {
            from: streamOwner
        })
        await dataToken.mint(bancorConverter.address, w3.utils.toWei('100000000'), {
            from: creator
        })
        await fromToken.mint(buyer, w3.utils.toWei('100000000'), {
            from: creator
        })
    })

    describe('Check Adaptor', () => {
        const testToleranceSeconds = 5

        it('product is there', async () => {
            assertEqual((await market.getProduct(productId))[0], 'testproduct')
        })

        it('too many seconds fails', async () => {
            const path = [fromToken.address, dataToken.address]
            // will return 10 data coin, which pays for 10s
            await assertFails(bancorAdaptor.buyWithETH(productId, path, 11, {
                from: buyer, value: w3.utils.toWei('10')
            }))
        })

        it('can buy product with ETH', async () => {
            // path[0] is ignored when converting from ETH with MockBancorConverter
            const path = [fromToken.address, dataToken.address]
            const subBefore = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            await bancorAdaptor.buyWithETH(productId, path, 9, {
                from: buyer, value: w3.utils.toWei('10')
            })
            const subAfter = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            assert(subAfter.isValid)
            assert(subAfter.endTimestamp - subBefore.endTimestamp > 10 - testToleranceSeconds)
        })

        it('can buy product with ERC20', async () => {
            const path = [fromToken.address, dataToken.address]
            const subBefore = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            const value = w3.utils.toWei('10')
            await fromToken.approve(bancorAdaptor.address, value, {
                from: buyer
            })
            await bancorAdaptor.buyWithERC20(productId, path, 9, value, {
                from: buyer
            })
            const subAfter = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            assert(subAfter.isValid)
            assert(subAfter.endTimestamp - subBefore.endTimestamp > 10 - testToleranceSeconds)
        })
    })
})
