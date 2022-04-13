// eslint-disable-next-line import/no-extraneous-dependencies
const config = require('@streamr/config')

const Marketplace = artifacts.require('./Marketplace.sol')
const Uniswap2Adapter = artifacts.require('./Uniswap2Adapter.sol')

module.exports = async (deployer, network) => {
    const streamrUpdaterAddress = '0xb6aA9D2708475fB026a8052E20e63AeA23233613'
    let datacoinAddress = ''
    let marketplaceAddress
    let uniswapV2RouterAddress
    switch (network) {
        case 'test': {
            datacoinAddress = '0x8e3877fe5551f9c14bc9b062bbae9d84bc2f5d4e'
            marketplaceAddress = '0x0000000000000000000000000000000000000000'
            uniswapV2RouterAddress = '0x0000000000000000000000000000000000000000'
            break
        }
        // TODO Ethereum mainnet
        case 'localsidechain': {
            const chains = config.Chains.load('development')
            datacoinAddress = chains.streamr.contracts.Token
            // ownerAddress = "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
            marketplaceAddress = '0x0000000000000000000000000000000000000000'
            uniswapV2RouterAddress = '0x0000000000000000000000000000000000000000'
            break
        }
        case 'polygonMainnet': {
            const chains = config.Chains.load('production')
            datacoinAddress = chains.polygon.contracts['DATA-token']
            marketplaceAddress = chains.polygon.contracts.Marketplace

            uniswapV2RouterAddress = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
            // ownerAddress = "0xC166609238736DDc36D6a4EFd50046ea9a2ad0AD"
            break
        }
        case 'gnosisMainnet': {
            const chains = config.Chains.load('production')
            datacoinAddress = chains.gnosis.contracts['DATA-token']
            // marketplaceAddress = chains.polygon.contracts.Marketplace

            uniswapV2RouterAddress = '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77'
            marketplaceAddress = '0x0000000000000000000000000000000000000000'
            // ownerAddress = "0xC166609238736DDc36D6a4EFd50046ea9a2ad0AD"
            break
        }

        case 'maticTest': {
            const chains = config.Chains.load('development')
            datacoinAddress = chains.streamr.contracts.Token
            // ownerAddress = "0x3F2dA479B77cB583C3462577DCD2e89B965fe987"
            marketplaceAddress = '0x0000000000000000000000000000000000000000'
            uniswapV2RouterAddress = '0x0000000000000000000000000000000000000000'
            break
        }
        default: {
            // throw new Error(`Unknown network: ${network}`)
        }
    }

    const gasPrice = await web3.eth.getGasPrice()
    await deployer.deploy(Marketplace, datacoinAddress, streamrUpdaterAddress, marketplaceAddress, {
        gasPrice: (new web3.utils.BN(gasPrice)).mul(new web3.utils.BN(1.5))
    })

    const tx2 = await Marketplace.deployed()

    marketplaceAddress = tx2.address

    if (network === 'test') {
        await tx2.transferOwnership('0x3F2dA479B77cB583C3462577DCD2e89B965fe987', {
            gas: 400000
        })
    }

    await deployer.deploy(Uniswap2Adapter, marketplaceAddress, uniswapV2RouterAddress, datacoinAddress, {
        gasPrice: (new web3.utils.BN(gasPrice)).mul(new web3.utils.BN(1.5))
    })

    await Uniswap2Adapter.deployed()
}
