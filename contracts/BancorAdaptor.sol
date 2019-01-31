pragma solidity ^0.4.22;


import "./Marketplace.sol";
import "./BancorConverter.sol";

address public marketplace_address;
address public bancor_converter_address;

constructor(address _marketplace_address, address _bancor_converter_address) public {
        marketplace_address = _marketplace_address;
        bancor_converter_address = _bancor_converter_address;
}

function buyWithETH(bytes32 productId,IERC20Token[] bancor_conversion_path,uint minSubscriptionSeconds
	) public payable whenNotHalted {
	
 	Marketplace mkt = new Marketplace(marketplace_address);
 	Product p = mkt.products[productId];
 	require(p.id != 0x0, "error_notFound");
 	//in DATA wei
 	uint min_datacoins = mkt.getPriceInData(minSubscriptionSeconds, p.pricePerSecond, p.priceCurrency);
 	
 	BancorConverter conv = new BancorConverter(bancor_converter_address);
 	//pass the ETH to Bancor, this contract receives datacoin
 	conv.quickConvert(bancor_conversion_path,msg.value,min_datacoins);
 	mkt.buyFor(productId,minSubscriptionSeconds,msg.sender);
}