pragma solidity ^0.4.22;


//import "./BancorConverter.sol";
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


address public marketplace_address;
address public bancor_converter_address;
address public datacoin_address = 0x0Cf0Ee63788A0849fE5297F3407f701E122cC023;
constructor(address _marketplace_address, address _bancor_converter_address) public {
        marketplace_address = _marketplace_address;
        bancor_converter_address = _bancor_converter_address;
}
// whenNotHalted
function buyWithETH(bytes32 productId,IERC20Token[] bancor_conversion_path,uint minSubscriptionSeconds
	) public payable  {
	
	require(bancor_conversion_path[bancor_conversion_path.length - 1] == datacoin_address, "must convert to DATAcoin");
 	Marketplace mkt = Marketplace(marketplace_address);
 	//Marketplace.Product storage p  = mkt.products(productId);
 	(string memory name, address owner, address beneficiary, uint pricePerSecond, Marketplace.Currency priceCurrency, uint minimumSubscriptionSeconds, Marketplace.ProductState state) = mkt.getProduct(productId);
 	require(owner == 0x0, "error_notFound");
 	
 	if(pricePerSecond == 0x0){
 		//subscription is free. return payment and subscribe
 		msg.sender.transfer(msg.value);
 		mkt.buyFor(productId,minSubscriptionSeconds,msg.sender);
 		return;
 	}
 	
 	IBancorConverter conv = IBancorConverter(bancor_converter_address);
 	uint price_data = mkt.getPriceInData(minSubscriptionSeconds, pricePerSecond, priceCurrency);
 	//pass the ETH to Bancor, this contract receives datacoin
 	uint256 received_datacoin = conv.quickConvert(bancor_conversion_path,msg.value,price_data);
 	
 	require(received_datacoin != 0x0, "no datacoin returned");
 	require(received_datacoin / pricePerSecond > minSubscriptionSeconds , "payment insufficient");
 	mkt.buyFor(productId,received_datacoin / pricePerSecond,msg.sender);
}

}