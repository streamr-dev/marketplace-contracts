const fs = require('fs')

/** @typedef {string} address Ethereum address */
/** @typedef {string} tokenSymbol Token symbol */

// fetch this file from Bancor:
// eslint-disable-next-line max-len
// curl https://api.bancor.network/0.1/converters?limit=300 | jq '.data.page | map( { (.code) : . } ) | add ' > currencydata.json
const currencyinfo = JSON.parse(fs.readFileSync('./currencydata.json', 'utf-8'))

const bancorGaslimitAddress = '0x607a5C47978e2Eb6d59C6C6f51bc0bF411f4b85a'
const bancorGaslimitAbi = [{
    constant: true,
    inputs: [{
        name: '_gasPrice', type: 'uint256'
    }],
    name: 'validateGasPrice',
    outputs: [],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: false,
    inputs: [],
    name: 'acceptOwnership',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
}, {
    constant: true,
    inputs: [],
    name: 'owner',
    outputs: [{
        name: '', type: 'address'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: false,
    inputs: [{
        name: '_gasPrice', type: 'uint256'
    }],
    name: 'setGasPrice',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
}, {
    constant: true,
    inputs: [],
    name: 'newOwner',
    outputs: [{
        name: '', type: 'address'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: false,
    inputs: [{
        name: '_newOwner', type: 'address'
    }],
    name: 'transferOwnership',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
}, {
    constant: true,
    inputs: [],
    name: 'gasPrice',
    outputs: [{
        name: '', type: 'uint256'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    inputs: [{
        name: '_gasPrice', type: 'uint256'
    }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor'
}, {
    anonymous: false,
    inputs: [{
        indexed: true, name: '_prevOwner', type: 'address'
    }, {
        indexed: true, name: '_newOwner', type: 'address'
    }],
    name: 'OwnerUpdate',
    type: 'event'
}]

// BancorAdaptor
const baAbi = [{
    constant: true,
    inputs: [],
    name: 'datacoin_address',
    outputs: [{
        name: '', type: 'address'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
    funcName: 'datacoin_address()',
    signature: '0x6073b654'
}, {
    constant: true,
    inputs: [],
    name: 'marketplace_address',
    outputs: [{
        name: '', type: 'address'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
    funcName: 'marketplace_address()',
    signature: '0x7a9648ac'
}, {
    constant: true,
    inputs: [],
    name: 'bancor_converter_address',
    outputs: [{
        name: '', type: 'address'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
    funcName: 'bancor_converter_address()',
    signature: '0x8c39ed92'
}, {
    inputs: [{
        name: '_marketplace_address', type: 'address'
    }, {
        name: '_bancor_converter_address', type: 'address'
    }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor',
    signature: 'constructor'
}, {
    constant: false,
    inputs: [{
        name: 'productId', type: 'bytes32'
    }, {
        name: 'bancor_conversion_path', type: 'address[]'
    }, {
        name: 'minSubscriptionSeconds', type: 'uint256'
    }],
    name: 'buyWithETH',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
    funcName: 'buyWithETH(bytes32,address[],uint256)',
    signature: '0xe92c34c3'
}, {
    constant: false,
    inputs: [{
        name: 'productId', type: 'bytes32'
    }, {
        name: 'bancor_conversion_path', type: 'address[]'
    }, {
        name: 'minSubscriptionSeconds', type: 'uint256'
    }, {
        name: 'amount', type: 'uint256'
    }],
    name: 'buyWithERC20',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
    funcName: 'buyWithERC20(bytes32,address[],uint256,uint256)',
    signature: '0x84c3c0ea'
}]
const baAdd = '0x1b013d14c4cefc042a200e09d83bd3463322131f'

const ERC20Abi = [{
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{
        name: '', type: 'string'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: false,
    inputs: [{
        name: '_spender', type: 'address'
    }, {
        name: '_value', type: 'uint256'
    }],
    name: 'approve',
    outputs: [{
        name: '', type: 'bool'
    }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
}, {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{
        name: '', type: 'uint256'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: false,
    inputs: [{
        name: '_from', type: 'address'
    }, {
        name: '_to', type: 'address'
    }, {
        name: '_value', type: 'uint256'
    }],
    name: 'transferFrom',
    outputs: [{
        name: '', type: 'bool'
    }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
}, {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{
        name: '', type: 'uint8'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: true,
    inputs: [{
        name: '_owner', type: 'address'
    }],
    name: 'balanceOf',
    outputs: [{
        name: 'balance', type: 'uint256'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{
        name: '', type: 'string'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    constant: false,
    inputs: [{
        name: '_to', type: 'address'
    }, {
        name: '_value', type: 'uint256'
    }],
    name: 'transfer',
    outputs: [{
        name: '', type: 'bool'
    }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
}, {
    constant: true,
    inputs: [{
        name: '_owner', type: 'address'
    }, {
        name: '_spender', type: 'address'
    }],
    name: 'allowance',
    outputs: [{
        name: '', type: 'uint256'
    }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
}, {
    payable: true, stateMutability: 'payable', type: 'fallback'
}, {
    anonymous: false,
    inputs: [{
        indexed: true, name: 'owner', type: 'address'
    }, {
        indexed: true, name: 'spender', type: 'address'
    }, {
        indexed: false, name: 'value', type: 'uint256'
    }],
    name: 'Approval',
    type: 'event'
}, {
    anonymous: false,
    inputs: [{
        indexed: true, name: 'from', type: 'address'
    }, {
        indexed: true, name: 'to', type: 'address'
    }, {
        indexed: false, name: 'value', type: 'uint256'
    }],
    name: 'Transfer',
    type: 'event'
}]

function getBancorGasPrice(web3, callback) {
    const gaslimitContract = new web3.eth.Contract(bancorGaslimitAbi, bancorGaslimitAddress)
    // eslint-disable-next-line promise/no-callback-in-promise
    return gaslimitContract.methods.gasPrice().call().then((gasprice) => callback(gasprice))
}

/**
 *
 * @param {tokenSymbol} fromToken
 * @param {tokenSymbol} toToken
 */
function makeBancorPath(fromToken, toToken) {
    let pathSymbols
    if (fromToken === 'ETH') {
        pathSymbols = [fromToken, 'BNT', 'BNT', toToken + 'BNT', toToken]
    } else if (fromToken === 'BNT') {
        pathSymbols = [fromToken, toToken + 'BNT', toToken]
    } else {
        pathSymbols = [fromToken, fromToken + 'BNT', 'BNT', toToken + 'BNT', toToken]
    }
    const addresses = []
    for (let i = 0; i < pathSymbols.length; i++) {
        addresses.push(currencyinfo[pathSymbols[i]].details[0].blockchainId)
    }
    return addresses
}

/**
 * Set approval for token
 * @param {Web3} web3
 * @param {address} fromAddress
 * @param {address} tokenAddress
 * @param {address} spender
 * @param {number} amount
 */
function approve(web3, fromAddress, tokenAddress, spender, amount) {
    const tokenContract = new web3.eth.Contract(ERC20Abi, tokenAddress)
    const data = tokenContract.methods.approve(spender, amount).encodeABI()
    const rawTransaction = {
        from: fromAddress,
        to: tokenAddress,
        gas: 2000000,
        data
    }
    return rawTransaction
}

/**
 * Buy subscription from Marketplace using BancorAdaptor
 * @param {Web3} web3
 * @param {address} fromAddress
 * @param {string} productId
 * @param {tokenSymbol} fromCurrency
 * @param {number} amount
 * @param {number} minSeconds
 * @param {number} gasPrice
 * @param {Function} transactionExecutor this function will be passed raw transactions to be executed
 */
function buySubscriptionUsingBancor(
    web3,
    fromAddress,
    productId,
    fromCurrency,
    amount,
    minSeconds,
    gasPrice,
    transactionExecutor
) {
    const path = makeBancorPath(fromCurrency, 'DATA')
    const baContract = new web3.eth.Contract(baAbi, baAdd)
    let data
    let value = 0
    if (fromCurrency === 'ETH') {
        data = baContract.methods.buyWithETH(productId, path, minSeconds).encodeABI()
        value = amount
    } else {
        const approval = approve(web3, fromAddress, path[0], baAdd, amount)
        // console.log("Purchases with token require approval: ")
        transactionExecutor(approval)
        // var amount_hex = web3.utils.toHex(amount);
        data = baContract.methods.buyWithERC20(productId, path, minSeconds, amount).encodeABI()
    }
    const rawTransaction = {
        from: fromAddress,
        to: baAdd,
        gas: 2000000,
        data,
        gasPrice,
        value
    }
    transactionExecutor(rawTransaction)
}
/// //////////////////////////////

module.exports = {
    makeBancorPath, buySubscriptionUsingBancor, getBancorGasPrice
}

