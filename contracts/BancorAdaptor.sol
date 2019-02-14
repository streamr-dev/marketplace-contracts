pragma solidity ^0.4.22;

import "./Marketplace.sol";




contract IERC20Token {
	// these functions aren't abstract since the compiler emits automatically generated getter functions as external
	function name() public view returns (string) {}
	function symbol() public view returns (string) {}
	function decimals() public view returns (uint8) {}
	function totalSupply() public view returns (uint256) {}
	function balanceOf(address _owner) public view returns (uint256) { _owner; }
	function allowance(address _owner, address _spender) public view returns (uint256) { _owner; _spender; }

	function transfer(address _to, uint256 _value) public returns (bool success);
	function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
	function approve(address _spender, uint256 _value) public returns (bool success);
}

contract IBancorConverter {
	function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {}
}



contract BancorAdaptor {
    using SafeMath for uint256;

	address public marketplace_address;
	address public bancor_converter_address;
	address public datacoin_address;
	constructor(address _marketplace_address, address _bancor_converter_address, address _datacoin_address) public {
		marketplace_address = _marketplace_address;
		bancor_converter_address = _bancor_converter_address;
		datacoin_address = _datacoin_address;
	}
/*
return price per second of product in DATA, or reverts() if none found
*/
	function getProductPrice(Marketplace mkt, bytes32 productId) internal returns (uint) {
		(string memory name, address owner, address beneficiary, uint pricePerSecond, Marketplace.Currency priceCurrency, uint minimumSubscriptionSeconds, Marketplace.ProductState state) = mkt.getProduct(productId);
		require(owner != 0x0, "not found");
		require(priceCurrency == Marketplace.Currency.DATA, "price not in DATA");
		return pricePerSecond;
	}
	
	function buyUsingBancor(bytes32 productId,IERC20Token[] bancor_conversion_path,uint minSubscriptionSeconds, uint amount, uint pricePerSecond, bool isEth) internal {
		require(bancor_conversion_path[bancor_conversion_path.length - 1] == datacoin_address, "must convert to DATAcoin");
		require(pricePerSecond > 0, "buyUsingBancor requires pricePerSecond > 0");
		
		uint min_datacoin = pricePerSecond.mul(minSubscriptionSeconds);

		IBancorConverter conv = IBancorConverter(bancor_converter_address);
		//pass the ETH to Bancor, this contract receives datacoin
		uint256 received_datacoin = conv.quickConvert.value(isEth?amount:0)(bancor_conversion_path,amount,min_datacoin);

		require(received_datacoin != 0x0, "no datacoin returned");

		IERC20Token datacoin = IERC20Token(datacoin_address);
		require(datacoin.approve(marketplace_address,0),"approval failed");
		require(datacoin.approve(marketplace_address,received_datacoin),"approval failed");

		Marketplace mkt = Marketplace(marketplace_address);

		mkt.buyFor(productId,received_datacoin.div(pricePerSecond),msg.sender);
	}
	
	function buyWithETH(bytes32 productId,IERC20Token[] bancor_conversion_path,uint minSubscriptionSeconds) public payable{
		Marketplace mkt = Marketplace(marketplace_address);
		uint pricePerSecond = getProductPrice(mkt, productId);

		if(pricePerSecond == 0x0){
		//subscription is free. return payment and subscribe
			if(msg.value > 0x0){
				msg.sender.transfer(msg.value);
			}	
			mkt.buyFor(productId,minSubscriptionSeconds,msg.sender);
			return;
		}		
		buyUsingBancor(productId, bancor_conversion_path, minSubscriptionSeconds, msg.value, pricePerSecond, true);
	}
	
	function buyWithERC20(bytes32 productId,IERC20Token[] bancor_conversion_path,uint minSubscriptionSeconds, uint amount) public{
		Marketplace mkt = Marketplace(marketplace_address);
		uint pricePerSecond = getProductPrice(mkt, productId);
		if(pricePerSecond == 0x0){
			//subscription is free. return payment and subscribe
			mkt.buyFor(productId,minSubscriptionSeconds,msg.sender);
			return;
		}
		IERC20Token fromToken = bancor_conversion_path[0];
		require(fromToken.transferFrom(msg.sender,address(this),amount), "must pre approve token transfer");
		require(fromToken.approve(bancor_converter_address, 0), "approval failed");
		require(fromToken.approve(bancor_converter_address, amount), "approval failed");
		buyUsingBancor(productId, bancor_conversion_path, minSubscriptionSeconds, amount, pricePerSecond, false);
	}

}
