pragma solidity ^0.6.6;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol"; 
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract IMarketplace {
    enum ProductState {
        NotDeployed,                // non-existent or deleted
        Deployed                    // created or redeployed
    }

    enum Currency {
        DATA,                       // "token wei" (10^-18 DATA)
        USD                         // attodollars (10^-18 USD)
    }

    function getProduct(bytes32 id) public view returns (string memory name, address owner, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, ProductState state) {}
    function getSubscription(bytes32 productId, address subscriber) public view returns (bool isValid, uint endTimestamp) {}
    function getPriceInData(uint subscriptionSeconds, uint price, Currency unit) public view returns (uint datacoinAmount) {}
    function buyFor(bytes32 productId, uint subscriptionSeconds, address recipient) public {}
}

contract Uniswap2Adapter {
//    using SafeMath for uint256;

    IMarketplace public marketplace;
    IUniswapV2Router01 public uniswapRouter;
    IERC20 public datacoin;
    address public liquidityToken;

    constructor(address _marketplace, address _uniswapRouter, address _datacoin) public {
        marketplace = IMarketplace(_marketplace);
        uniswapRouter = IUniswapV2Router01(_uniswapRouter);
        datacoin = IERC20(_datacoin);
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
    /*
        token address 0x0 means ETH
    */
    /*
    //returns the amount to_tokens that would be received from an input_amount of from_tokens
    function getConversionRateInput(address from_token, address to_token, uint input_amount) public view returns (uint){
        require(from_token != to_token, "must specify different tokens ");
        uint eth_amount;
        if(from_token == address(0)){
            eth_amount = input_amount;
        }
        else{
            address from_token_exchange = uniswap_router.getExchange(from_token);
            require(from_token_exchange != address(0), "couldnt find exchange for from_token");
            IUniswapExchange exfrom = IUniswapExchange(from_token_exchange);
            eth_amount = exfrom.getTokenToEthInputPrice(input_amount);
        }
        if(to_token == address(0)){
            return eth_amount;
        }
        else{
            address to_token_exchange = uniswap_router.getExchange(to_token);
            require(to_token_exchange != address(0), "couldnt find exchange for to_token");
            IUniswapExchange exto = IUniswapExchange(to_token_exchange);
            return exto.getEthToTokenInputPrice(eth_amount);
        }
    }

    // returns the amount from_tokens needed to buy output_amount of to_tokens
    function getConversionRateOutput(address from_token, address to_token, uint output_amount) public view returns (uint){
        require(from_token != to_token, "must specify different tokens ");
        uint eth_amount;
        if(to_token == address(0)){
            eth_amount = output_amount;
        }
        else{
            address to_token_exchange = uniswap_router.getExchange(to_token);
            require(to_token_exchange != address(0), "couldnt find exchange for to_token");
            IUniswapExchange exto = IUniswapExchange(to_token_exchange);
            eth_amount = exto.getEthToTokenOutputPrice(output_amount);
        }
        if(from_token == address(0)){
            return eth_amount;
        }
        else{
            address from_token_exchange = uniswap_router.getExchange(from_token);
            require(from_token_exchange != address(0), "couldnt find exchange for from_token");
            IUniswapExchange exfrom = IUniswapExchange(from_token_exchange);
            return exfrom.getTokenToEthOutputPrice(eth_amount);
        }
    }
    */
    

    function _getPricePerSecondData(bytes32 productId) internal view returns (uint) {
        (, address owner,, uint pricePerSecond, IMarketplace.Currency priceCurrency,,) = marketplace.getProduct(productId);
        require(owner != address(0), "not found");
        return marketplace.getPriceInData(1, pricePerSecond, priceCurrency);
    }
    function buyWithERC20(bytes32 productId, uint minSubscriptionSeconds,uint timeWindow, address erc20_address, uint amount) public {
        require(erc20_address != address(0), "use buyWithETH instead");
        uint pricePerSecondData = _getPricePerSecondData(productId);
        if(pricePerSecondData == 0x0){
            //subscription is free. return payment and subscribe
            marketplace.buyFor(productId,minSubscriptionSeconds,msg.sender);
            return;
        }
        IERC20 fromToken = IERC20(erc20_address);
        require(fromToken.transferFrom(msg.sender, address(this), amount), "must pre approve token transfer");
        // use the exchange of the received token. this exchange will query its factory to find
        // the DATAcoin exchange in tokenToTokenTransferInput() in _buyWithUniswap()
        require(fromToken.approve(address(uniswapRouter), 0), "approval failed");
        require(fromToken.approve(address(uniswapRouter), amount), "approval failed");
        _buyWithUniswap(productId, minSubscriptionSeconds, timeWindow, pricePerSecondData, amount, erc20_address);
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
        _buyWithUniswap(productId, minSubscriptionSeconds, timeWindow, pricePerSecondData, msg.value, uniswapRouter.WETH());
    }
    /**
        from_token = uniswapRouter.WETH() means ETH
     */
    function _buyWithUniswap(bytes32 productId, uint minSubscriptionSeconds, uint timeWindow, uint pricePerSecondData, uint amount, address from_token) internal{
        uint price = mul(pricePerSecondData,minSubscriptionSeconds);
        uint256 datacoin_before_transfer = datacoin.balanceOf(address(this));
        // TransferInput should revert if it cant get at least 'price' amount of DATAcoin 
        uint256 received_datacoin;
        address[] memory path = _uniswapPath(from_token);
        if(from_token == address(uniswapRouter.WETH())){
            received_datacoin = uniswapRouter.swapExactETHForTokens.value(amount)(1, path, address(this), now + timeWindow)[path.length - 1];
        }
        else{
            received_datacoin = uniswapRouter.swapExactTokensForTokens(amount, 1, path, address(this), now + timeWindow)[path.length - 1];
        }
        require(datacoin.balanceOf(address(this)) - datacoin_before_transfer >= received_datacoin && received_datacoin >= price, "not enough datacoin received");
        require(datacoin.approve(address(marketplace),0), "approval failed");
        require(datacoin.approve(address(marketplace), received_datacoin), "approval failed");
        marketplace.buyFor(productId, received_datacoin / pricePerSecondData, msg.sender);
    }

    function _uniswapPath(address fromCoin) internal view returns (address[] memory) {
        if(liquidityToken == address(0)){
            //no intermediate
            address[] memory path = new address[](2);
            path[0] = fromCoin;
            path[1] = address(datacoin);
            return path;
        }
        //use intermediate liquidity token
        address[] memory path = new address[](3);
        path[0] = fromCoin;
        path[1] = liquidityToken;
        path[2] = address(datacoin);
        return path;
    }
}
