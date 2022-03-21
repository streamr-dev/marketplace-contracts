const fs = require('fs')

const Web3 = require('web3')

const w3 = new Web3(web3.currentProvider)

const MarketplacePrev = artifacts.require('./Marketplace20180425.sol')
const Marketplace = artifacts.require('./Marketplace.sol')
const UniswapAdaptor = artifacts.require('./UniswapAdaptor.sol')
const ERC20Mintable = artifacts.require('./ERC20Mintable.sol')
// const MockUniswapFactory = artifacts.require("./MockUniswapFactory.sol")
// const MockUniswapExchange = artifacts.require("./MockUniswapExchange.sol")
const { Marketplace: { Currency } } = require('../src/contracts/enums')

const { assertEqual, assertFails } = require('./testHelpers')

// from https://github.com/Uniswap/contracts-vyper
const uniswapExchangeAbi = JSON.parse(fs.readFileSync('./contracts/abi/uniswap_exchange.json', 'utf-8'))
const uniswapFactoryAbi = JSON.parse(fs.readFileSync('./contracts/abi/uniswap_factory.json', 'utf-8'))
const uniswapExchangeBytecode = fs.readFileSync('./contracts/bytecode/uniswap_exchange.txt', 'utf-8')
const uniswapFactoryBytecode = fs.readFileSync('./contracts/bytecode/uniswap_factory.txt', 'utf-8')

const UniswapFactory = new w3.eth.Contract(uniswapFactoryAbi, null, {
    data: uniswapFactoryBytecode
})
const UniswapExchange = new w3.eth.Contract(uniswapExchangeAbi, null, {
    data: uniswapExchangeBytecode
})
const futureTime = 4449513600

function absFractionalDifference(ref, val) {
    const diff = Math.abs((ref - val) / ref)
    // console.log(`diff ${ref} ${val} = ${diff}`)
    return diff
}
// console.log(uniswap_exchange_abi);
contract('UniswapAdaptor', (accounts) => {
    let market
    let marketPrev
    let fromToken
    let dataToken
    let uniswapFactory
    // let uniswapExchange
    let uniswapAdaptor
    const creator = accounts[0]
    const currencyUpdateAgent = accounts[1]
    const buyer = accounts[2]
    const streamOwner = accounts[3]
    const productId = '0x123'
    // const testToleranceSeconds = 5
    const day = 86400

    before(async () => {
        // token for testing ERC20 purchase
        fromToken = await ERC20Mintable.new({
            from: creator
        })
        dataToken = await ERC20Mintable.new({
            from: creator
        })
        await dataToken.mint(creator, w3.utils.toWei('100000000'), {
            from: creator
        })
        await fromToken.mint(creator, w3.utils.toWei('100000000'), {
            from: creator
        })
        await fromToken.mint(buyer, w3.utils.toWei('100000000'), {
            from: creator
        })
        uniswapFactory = await UniswapFactory.deploy(({
            arguments: []
        })).send({
            gas: 6000000, from: creator
        })
        const templateExchange = await UniswapExchange.deploy(({
            arguments: []
        })).send({
            gas: 6000000, from: creator
        })
        await uniswapFactory.methods.initializeFactory(templateExchange.options.address).send({
            gas: 6000000, from: creator
        })
        await uniswapFactory.methods.createExchange(fromToken.address).send({
            gas: 6000000, from: creator
        })
        await uniswapFactory.methods.createExchange(dataToken.address).send({
            gas: 6000000, from: creator
        })
        const fromTokenExchange = await uniswapFactory.methods.getExchange(fromToken.address).call()
        const dataTokenExchange = await uniswapFactory.methods.getExchange(dataToken.address).call()
        const fromTokenUniswapExchange = new w3.eth.Contract(uniswapExchangeAbi, fromTokenExchange, {
            data: uniswapExchangeBytecode
        })
        const dataTokenUniswapExchange = new w3.eth.Contract(uniswapExchangeAbi, dataTokenExchange, {
            data: uniswapExchangeBytecode
        })
        marketPrev = await MarketplacePrev.new(dataToken.address, currencyUpdateAgent, {
            from: creator
        })
        market = await Marketplace.new(dataToken.address, currencyUpdateAgent, marketPrev.address, {
            from: creator
        })
        uniswapAdaptor = await UniswapAdaptor.new(market.address, uniswapFactory.options.address, dataToken.address, {
            from: creator
        })
        await market.createProduct(productId, 'testproduct', streamOwner, w3.utils.toWei('.001'), Currency.DATA, 1, {
            from: streamOwner
        })
        const dtAmount = w3.utils.toWei('10')
        const ftAmount = w3.utils.toWei('10')
        assert(await fromToken.approve(fromTokenExchange, ftAmount, {
            from: creator
        }))
        assert(await dataToken.approve(dataTokenExchange, dtAmount, {
            from: creator
        }))
        assert(await dataToken.approve(templateExchange.options.address, dtAmount, {
            from: creator
        }))
        // 10 fromToken ~= 1 ETH
        await fromTokenUniswapExchange.methods.addLiquidity(w3.utils.toWei('10'), w3.utils.toWei('10'), futureTime).send({
            from: creator, gas: 6000000, value: w3.utils.toWei('1')
        })
        // 1 dataToken ~= 1 ETH
        await dataTokenUniswapExchange.methods.addLiquidity(dtAmount, dtAmount, futureTime).send({
            from: creator, gas: 6000000, value: dtAmount
        })
    })

    describe('Check Adaptor', () => {
        const testToleranceSeconds = 5

        it('product is there', async () => {
            assertEqual((await market.getProduct(productId))[0], 'testproduct')
        })

        it('too many seconds fails', async () => {
            // will return ~10 data coin, which pays for 10s
            await assertFails(uniswapAdaptor.buyWithETH(productId, 20, day, {
                from: buyer, value: w3.utils.toWei('.01')
            }))
            await fromToken.approve(uniswapAdaptor.address, 0, {
                from: buyer
            })
            //= .001 eth which pays for about 1s
            const value = w3.utils.toWei('.01')
            await fromToken.approve(uniswapAdaptor.address, value, {
                from: buyer
            })
            await assertFails(uniswapAdaptor.buyWithERC20(productId, 9, day, fromToken.address, value, {
                from: buyer
            }))
        })

        it('can buy product with ETH', async () => {
            const subBefore = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            // .01 eth pays for about 10s
            await uniswapAdaptor.buyWithETH(productId, 9, day, {
                from: buyer, value: w3.utils.toWei('.01')
            })
            const subAfter = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            assert(subAfter.isValid)
            assert(subAfter.endTimestamp - subBefore.endTimestamp > 10 - testToleranceSeconds)
        })

        it('can buy product with ERC20', async () => {
            const subBefore = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            //= .01 eth or about 10s
            const value = w3.utils.toWei('0.1')
            await fromToken.approve(uniswapAdaptor.address, value, {
                from: buyer
            })
            await uniswapAdaptor.buyWithERC20(productId, 9, day, fromToken.address, value, {
                from: buyer
            })
            const subAfter = await market.getSubscription(productId, buyer, {
                from: buyer
            })
            assert(subAfter.isValid)
            assert(subAfter.endTimestamp - subBefore.endTimestamp > 10 - testToleranceSeconds)
        })

        it('test exchange rates', async () => {
            const amt = 1000.0
            const address0 = '0x0000000000000000000000000000000000000000'

            const ethToDataIn = (await uniswapAdaptor.getConversionRateInput(dataToken.address, address0, amt, {
                from: buyer
            })) / amt
            assert(absFractionalDifference(ethToDataIn, 1) < 0.1)
            const ethToFtIn = (await uniswapAdaptor.getConversionRateInput(address0, fromToken.address, amt, {
                from: buyer
            })) / amt
            assert(absFractionalDifference(ethToFtIn, 10) < 0.1)
            const ftToDataIn = (await uniswapAdaptor.getConversionRateInput(fromToken.address, dataToken.address, amt, {
                from: buyer
            })) / amt
            assert(absFractionalDifference(ftToDataIn, 0.1) < 0.1)

            const ethToDataOut = (await uniswapAdaptor.getConversionRateOutput(dataToken.address, address0, amt, {
                from: buyer
            })) / amt
            assert(absFractionalDifference(ethToDataOut, 1) < 0.1)
            const ethToFtOut = (await uniswapAdaptor.getConversionRateOutput(address0, fromToken.address, amt, {
                from: buyer
            })) / amt
            assert(absFractionalDifference(ethToFtOut, 0.1) < 0.1)
            const ftToDataOut = (await uniswapAdaptor.getConversionRateOutput(fromToken.address, dataToken.address, amt, {
                from: buyer
            })) / amt
            assert(absFractionalDifference(ftToDataOut, 10) < 0.1)
        })
    })
})
