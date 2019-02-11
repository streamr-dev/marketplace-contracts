// <script src="bower_components/abi-decoder/dist/abi-decoder.js"> // Javascript
const abiDecoder = require('abi-decoder');
const https = require('https');
const Web3 = require("web3");
const fs = require('fs');

/*
fetch this file from Bancor:
curl https://api.bancor.network/0.1/converters?limit=300 | jq .data.page | jq  'map( { (.code) : . } ) | add ' > currencydata.json
*/
const currencyinfo = JSON.parse(fs.readFileSync('./currencydata.json', 'utf-8'));

const bancor_gaslimit_address = '0x607a5C47978e2Eb6d59C6C6f51bc0bF411f4b85a';
const bancor_gaslimit_abi = [{"constant":true,"inputs":[{"name":"_gasPrice","type":"uint256"}],"name":"validateGasPrice","outputs":[],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_gasPrice","type":"uint256"}],"name":"setGasPrice","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"gasPrice","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_gasPrice","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_prevOwner","type":"address"},{"indexed":true,"name":"_newOwner","type":"address"}],"name":"OwnerUpdate","type":"event"}];

//new test, with buyFor()
//const marketplace_address = '0x3265Fe97f6AFb466128908d97d74CbC5744ffEF5';

const marketplace_address = '0xA10151D088f6f2705a05d6c83719e99E079A61C1';

const marketplace_abi = [{"constant":false,"inputs":[],"name":"claimOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"products","outputs":[{"name":"id","type":"bytes32"},{"name":"name","type":"string"},{"name":"owner","type":"address"},{"name":"beneficiary","type":"address"},{"name":"pricePerSecond","type":"uint256"},{"name":"priceCurrency","type":"uint8"},{"name":"minimumSubscriptionSeconds","type":"uint256"},{"name":"state","type":"uint8"},{"name":"newOwnerCandidate","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"datacoin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"currencyUpdateAgent","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"halted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"dataPerUsd","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"datacoinAddress","type":"address"},{"name":"currencyUpdateAgentAddress","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"id","type":"bytes32"},{"indexed":false,"name":"name","type":"string"},{"indexed":false,"name":"beneficiary","type":"address"},{"indexed":false,"name":"pricePerSecond","type":"uint256"},{"indexed":false,"name":"currency","type":"uint8"},{"indexed":false,"name":"minimumSubscriptionSeconds","type":"uint256"}],"name":"ProductCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"id","type":"bytes32"},{"indexed":false,"name":"name","type":"string"},{"indexed":false,"name":"beneficiary","type":"address"},{"indexed":false,"name":"pricePerSecond","type":"uint256"},{"indexed":false,"name":"currency","type":"uint8"},{"indexed":false,"name":"minimumSubscriptionSeconds","type":"uint256"}],"name":"ProductUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"id","type":"bytes32"},{"indexed":false,"name":"name","type":"string"},{"indexed":false,"name":"beneficiary","type":"address"},{"indexed":false,"name":"pricePerSecond","type":"uint256"},{"indexed":false,"name":"currency","type":"uint8"},{"indexed":false,"name":"minimumSubscriptionSeconds","type":"uint256"}],"name":"ProductDeleted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"id","type":"bytes32"},{"indexed":false,"name":"name","type":"string"},{"indexed":false,"name":"beneficiary","type":"address"},{"indexed":false,"name":"pricePerSecond","type":"uint256"},{"indexed":false,"name":"currency","type":"uint8"},{"indexed":false,"name":"minimumSubscriptionSeconds","type":"uint256"}],"name":"ProductRedeployed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"id","type":"bytes32"},{"indexed":true,"name":"to","type":"address"}],"name":"ProductOwnershipOffered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"newOwner","type":"address"},{"indexed":true,"name":"id","type":"bytes32"},{"indexed":true,"name":"oldOwner","type":"address"}],"name":"ProductOwnershipChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"productId","type":"bytes32"},{"indexed":true,"name":"subscriber","type":"address"},{"indexed":false,"name":"endTimestamp","type":"uint256"}],"name":"Subscribed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"productId","type":"bytes32"},{"indexed":true,"name":"subscriber","type":"address"},{"indexed":false,"name":"endTimestamp","type":"uint256"}],"name":"NewSubscription","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"productId","type":"bytes32"},{"indexed":true,"name":"subscriber","type":"address"},{"indexed":false,"name":"endTimestamp","type":"uint256"}],"name":"SubscriptionExtended","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"productId","type":"bytes32"},{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"secondsTransferred","type":"uint256"}],"name":"SubscriptionTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"timestamp","type":"uint256"},{"indexed":false,"name":"dataInUsd","type":"uint256"}],"name":"ExchangeRatesUpdated","type":"event"},{"anonymous":false,"inputs":[],"name":"Halted","type":"event"},{"anonymous":false,"inputs":[],"name":"Resumed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"constant":true,"inputs":[{"name":"id","type":"bytes32"}],"name":"getProduct","outputs":[{"name":"name","type":"string"},{"name":"owner","type":"address"},{"name":"beneficiary","type":"address"},{"name":"pricePerSecond","type":"uint256"},{"name":"currency","type":"uint8"},{"name":"minimumSubscriptionSeconds","type":"uint256"},{"name":"state","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"id","type":"bytes32"},{"name":"name","type":"string"},{"name":"beneficiary","type":"address"},{"name":"pricePerSecond","type":"uint256"},{"name":"currency","type":"uint8"},{"name":"minimumSubscriptionSeconds","type":"uint256"}],"name":"createProduct","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"}],"name":"deleteProduct","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"}],"name":"redeployProduct","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"name","type":"string"},{"name":"beneficiary","type":"address"},{"name":"pricePerSecond","type":"uint256"},{"name":"currency","type":"uint8"},{"name":"minimumSubscriptionSeconds","type":"uint256"}],"name":"updateProduct","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"newOwnerCandidate","type":"address"}],"name":"offerProductOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"}],"name":"claimProductOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"productId","type":"bytes32"},{"name":"subscriber","type":"address"}],"name":"getSubscription","outputs":[{"name":"isValid","type":"bool"},{"name":"endTimestamp","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"productId","type":"bytes32"}],"name":"getSubscriptionTo","outputs":[{"name":"isValid","type":"bool"},{"name":"endTimestamp","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"productId","type":"bytes32"},{"name":"subscriber","type":"address"}],"name":"hasValidSubscription","outputs":[{"name":"isValid","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"subscriptionSeconds","type":"uint256"},{"name":"recipient","type":"address"}],"name":"buyFor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"subscriptionSeconds","type":"uint256"}],"name":"buy","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"newSubscriber","type":"address"}],"name":"transferSubscription","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"timestamp","type":"uint256"},{"name":"dataUsd","type":"uint256"}],"name":"updateExchangeRates","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"subscriptionSeconds","type":"uint256"},{"name":"price","type":"uint256"},{"name":"unit","type":"uint8"}],"name":"getPriceInData","outputs":[{"name":"datacoinAmount","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"halt","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"resume","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"datacoinAddress","type":"address"},{"name":"currencyUpdateAgentAddress","type":"address"}],"name":"reInitialize","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}];

//BancorAdaptor
const ba_abi = [{"constant":true,"inputs":[],"name":"datacoin_address","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function","funcName":"datacoin_address()","signature":"0x6073b654"},{"constant":true,"inputs":[],"name":"marketplace_address","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function","funcName":"marketplace_address()","signature":"0x7a9648ac"},{"constant":true,"inputs":[],"name":"bancor_converter_address","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function","funcName":"bancor_converter_address()","signature":"0x8c39ed92"},{"inputs":[{"name":"_marketplace_address","type":"address"},{"name":"_bancor_converter_address","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor","signature":"constructor"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"bancor_conversion_path","type":"address[]"},{"name":"minSubscriptionSeconds","type":"uint256"}],"name":"buyWithETH","outputs":[],"payable":true,"stateMutability":"payable","type":"function","funcName":"buyWithETH(bytes32,address[],uint256)","signature":"0xe92c34c3"},{"constant":false,"inputs":[{"name":"productId","type":"bytes32"},{"name":"bancor_conversion_path","type":"address[]"},{"name":"minSubscriptionSeconds","type":"uint256"},{"name":"amount","type":"uint256"}],"name":"buyWithERC20","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function","funcName":"buyWithERC20(bytes32,address[],uint256,uint256)","signature":"0x84c3c0ea"}];
const ba_add = '0x1b013d14c4cefc042a200e09d83bd3463322131f';


const ERC20_abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]

function getBancorGasPrice(web3, callback){
		var gaslimit_contract =  new web3.eth.Contract(bancor_gaslimit_abi,bancor_gaslimit_address);
		gaslimit_contract.methods.gasPrice().call().then((gasprice) => callback(gasprice));
}

function makeBancorPath(fromToken, toToken){
	var path_symbols;
	if(fromToken == "ETH"){
		path_symbols = [fromToken,"BNT","BNT", toToken+"BNT",toToken];
	}
	else if(fromToken == "BNT"){
		path_symbols = [fromToken, toToken+"BNT",toToken];
	}
	else{
		path_symbols = [fromToken, fromToken+"BNT","BNT",toToken+"BNT",toToken]; 
	}
	var addresses = [];
	for(var i=0;i<path_symbols.length;i++){
		addresses.push(currencyinfo[path_symbols[i]].details[0].blockchainId);
	}
	return addresses;
}
function approve(web3,fromAddress, tokenAddress, spender, amount){
	var token_contract =  new web3.eth.Contract(ERC20_abi,tokenAddress);
	var data= token_contract.methods.approve(spender,amount).encodeABI()
	var rawTransaction = {
				"from": fromAddress,
				"to": tokenAddress,
				"gas": 2000000,
				"data":data
			};
	return rawTransaction;	
}

function buySubscriptionUsingBancor(web3,fromAddress,productId, fromCurrency,amount,minSeconds,gasPrice,transactionExecutor){
	var path = makeBancorPath(fromCurrency,"DATA");
	var ba_contract =  new web3.eth.Contract(ba_abi,ba_add);
	var data;
	if(fromCurrency == "ETH")
		data = ba_contract.methods.buyWithETH(productId,path,minSeconds).encodeABI();
	else{
		var approval = approve(web3,fromAddress,path[0],ba_add,amount);
		console.log("Purchases with token require approval: ");
		transactionExecutor(approval);
		//var amount_hex = web3.utils.toHex(amount);
		data = ba_contract.methods.buyWithERC20(productId,path,minSeconds,amount).encodeABI();
	}
	var rawTransaction = {
		"from": fromAddress,
		"to": ba_add,
		"gas": 2000000,
		"data":data,
		"gasPrice":gasPrice
	};
	if(fromCurrency == "ETH"){
		rawTransaction["value"] = amount;
	}
	transactionExecutor(rawTransaction);
}
/////////////////////////////////

/*
////////////////////////////////////////////////
// Example Usage:
//var mykey = {...};
//var mykey_passwd = 'MYPASSWD';
//var web3_provider = new Web3.providers.HttpProvider("http://localhost:8545");


web3 = new Web3(web3_provider);
var pk = web3.eth.accounts.decrypt(mykey, mykey_passwd).privateKey;
var ethadd= '0x'+mykey.address;
var productId='0x3598682136924954b7fd197b64734b6fddb818a8acec401cadc02280c1fda4f6';

function processTx(rawTx){
	console.log("UnsignedTx:"+ JSON.stringify(rawTx));	
	//sign the tx
	web3.eth.accounts.signTransaction(rawTx, pk).then((signed) => {
			//this is the signed transaction, ready for posting to blockchain
			var signedTx = signed.rawTransaction;
			console.log("RAW SIGNED TX: "+ signedTx);
	});
}

getBancorGasPrice(web3, function(gasPrice){
		buySubscriptionUsingBancor(web3,ethadd,productId, "GNO",web3.utils.toWei('.01'),99,gasPrice,processTx)
});

//when transaction confirmed, check subscription:
var marketplace_contract =  new web3.eth.Contract(marketplace_abi,marketplace_address);
marketplace_contract.methods.getSubscription(productId,ba_add).call().then(console.log);
*/

module.exports = {
    makeBancorPath,
}
