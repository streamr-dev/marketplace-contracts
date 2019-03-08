pragma solidity ^0.4.22;

contract IMarketplace {
    enum ProductState {
        NotDeployed,                // non-existent or deleted
        Deployed                    // created or redeployed
    }

    enum Currency {
        DATA,                       // "token wei" (10^-18 DATA)
        USD                         // attodollars (10^-18 USD)
    }

    function getProduct(bytes32 id) public view returns (string name, address owner, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, ProductState state) {}
    function getSubscription(bytes32 productId, address subscriber) public view returns (bool isValid, uint endTimestamp) {}
    function getPriceInData(uint subscriptionSeconds, uint price, Currency unit) public view returns (uint datacoinAmount) {}
    function buyFor(bytes32 productId, uint subscriptionSeconds, address recipient) public {}
}

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

contract IUniswapFactory {
    function getExchange(address token) public returns (address){}
}

contract IUniswapExchange{
    function getEthToTokenOutputPrice(uint256 tokens_bought) public view returns (uint256) {}
    function ethToTokenTransferInput(uint256 min_tokens,uint deadline,address recipient) public payable returns (uint256) {}
    function tokenToTokenTransferInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address recipient, address token_addr) external returns (uint256  tokens_bought);
}

contract UniswapAdaptor {
//    using SafeMath for uint256;

    IMarketplace marketplace;
    IUniswapFactory uniswap_factory;
    IERC20Token datacoin;
    constructor(address _marketplace_address, address _uniswap_factory_address, address _datacoin_address) public {
        marketplace = IMarketplace(_marketplace_address);
        uniswap_factory = IUniswapFactory(_uniswap_factory_address);
        datacoin = IERC20Token(_datacoin_address);
    }
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b);

        return c;
    }

    function _getPricePerSecondData(bytes32 productId) internal view returns (uint) {
        (, address owner,, uint pricePerSecond, IMarketplace.Currency priceCurrency,,) = marketplace.getProduct(productId);
        require(owner != 0x0, "not found");
        return marketplace.getPriceInData(1, pricePerSecond, priceCurrency);
    }
    function buyWithERC20(bytes32 productId, uint minSubscriptionSeconds,uint timeWindow, address erc20_address, uint amount) public {
        require(erc20_address != 0x0, "use buyWithETH instead");
        uint pricePerSecondData = _getPricePerSecondData(productId);
        if(pricePerSecondData == 0x0){
            //subscription is free. return payment and subscribe
            marketplace.buyFor(productId,minSubscriptionSeconds,msg.sender);
            return;
        }
        IERC20Token fromToken = IERC20Token(erc20_address);
        require(fromToken.transferFrom(msg.sender,address(this),amount), "must pre approve token transfer");
        // use the exchange of the received token. this exchange will query its factory to find
        // the DATAcoin exchange in tokenToTokenTransferInput() in _buyWithUniswap()
        address exadd = uniswap_factory.getExchange(erc20_address);
        require(exadd != 0x0, "couldnt find exchange for exchanged token");
        require(fromToken.approve(exadd, 0), "approval failed");
        require(fromToken.approve(exadd, amount), "approval failed");
        _buyWithUniswap(exadd, productId, minSubscriptionSeconds, timeWindow, pricePerSecondData, amount, erc20_address);
    }

    function buyWithETH(bytes32 productId, uint minSubscriptionSeconds,uint timeWindow) public payable{
        uint pricePerSecondData = _getPricePerSecondData(productId);
        if(pricePerSecondData == 0x0){
            //subscription is free. return payment and subscribe
            if(msg.value > 0x0){
                msg.sender.transfer(msg.value);
            }
            marketplace.buyFor(productId,minSubscriptionSeconds,msg.sender);
            return;
        }
        address exadd = uniswap_factory.getExchange(address(datacoin));
        require(exadd != 0x0, "couldnt find exchange for DATA coin");
        _buyWithUniswap(exadd, productId, minSubscriptionSeconds, timeWindow, pricePerSecondData, msg.value,0x0);
    }
    /**
        from_token = 0x0 means ETH
     */
    function _buyWithUniswap(address exadd, bytes32 productId, uint minSubscriptionSeconds,uint timeWindow, uint pricePerSecondData,uint amount,address from_token) internal{
        uint price = mul(pricePerSecondData,minSubscriptionSeconds);
        IUniswapExchange ex = IUniswapExchange(exadd);
        uint256 datacoin_before_transfer = datacoin.balanceOf(address(this));
        // TransferInput should revert if it cant get at least 'price' amount of DATAcoin 
        uint256 received_datacoin;
        if(from_token == 0x0){
            received_datacoin = ex.ethToTokenTransferInput.value(amount)(price,now + timeWindow, address(this));
        }
        else{
            received_datacoin = ex.tokenToTokenTransferInput(amount, price, 0, now + timeWindow, address(this), address(datacoin));
        }
        require(datacoin.balanceOf(address(this)) - datacoin_before_transfer >= received_datacoin, "not enough datacoin received");
        require(datacoin.approve(address(marketplace),0),"approval failed");
        require(datacoin.approve(address(marketplace),received_datacoin),"approval failed");
        marketplace.buyFor(productId,received_datacoin / pricePerSecondData,msg.sender);
    }
}
