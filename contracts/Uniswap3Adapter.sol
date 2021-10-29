pragma solidity ^0.8.4;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryImmutableState.sol";

interface WETH {
    function deposit() external payable;
}

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

contract IMarketplace {
    enum ProductState {
        NotDeployed, // non-existent or deleted
        Deployed // created or redeployed
    }

    enum Currency {
        DATA, // "token wei" (10^-18 DATA)
        USD // attodollars (10^-18 USD)
    }

    function getProduct(bytes32 id)
        public
        view
        returns (
            string memory name,
            address owner,
            address beneficiary,
            uint256 pricePerSecond,
            Currency currency,
            uint256 minimumSubscriptionSeconds,
            ProductState state
        )
    {}

    function getSubscription(bytes32 productId, address subscriber)
        public
        view
        returns (bool isValid, uint256 endTimestamp)
    {}

    function getPriceInData(
        uint256 subscriptionSeconds,
        uint256 price,
        Currency unit
    ) public view returns (uint256 datacoinAmount) {}

    function buyFor(
        bytes32 productId,
        uint256 subscriptionSeconds,
        address recipient
    ) public {}
}

contract Uniswap3Adapter {
    IMarketplace public marketplace;
    ISwapRouter public uniswapRouter;
    IERC20 public datacoin;
    address public liquidityToken;

    // most uniswap3 pools are 0.3%,
    // https://docs.uniswap.org/protocol/guides/swaps/multihop-swaps
    uint24 constant poolFee = 3000;

    constructor(
        address _marketplace,
        address _uniswapRouter,
        address _datacoin
    ) public {
        marketplace = IMarketplace(_marketplace);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        datacoin = IERC20(_datacoin);
    }

    function _getPricePerSecondData(bytes32 productId)
        internal
        view
        returns (uint256)
    {
        (
            ,
            address owner,
            ,
            uint256 pricePerSecond,
            IMarketplace.Currency priceCurrency,
            ,

        ) = marketplace.getProduct(productId);
        require(owner != address(0), "not found");
        return marketplace.getPriceInData(1, pricePerSecond, priceCurrency);
    }

    function buyWithERC20(
        bytes32 productId,
        uint256 minSubscriptionSeconds,
        uint256 timeWindow,
        address erc20_address,
        uint256 amount
    ) public {
        require(erc20_address != address(0), "use buyWithETH instead");
        uint256 pricePerSecondData = _getPricePerSecondData(productId);
        if (pricePerSecondData == 0x0) {
            //subscription is free. return payment and subscribe
            marketplace.buyFor(productId, minSubscriptionSeconds, msg.sender);
            return;
        }
        IERC20 fromToken = IERC20(erc20_address);
        require(
            fromToken.transferFrom(msg.sender, address(this), amount),
            "must pre approve token transfer"
        );
        //some tokens (eg old DATA) require approve(0) if amount approved is already non-zero
        require(
            fromToken.approve(address(uniswapRouter), 0),
            "approval failed"
        );
        require(
            fromToken.approve(address(uniswapRouter), amount),
            "approval failed"
        );
        _buyWithUniswap(
            productId,
            minSubscriptionSeconds,
            timeWindow,
            pricePerSecondData,
            amount,
            erc20_address
        );
    }

    function buyWithETH(
        bytes32 productId,
        uint256 minSubscriptionSeconds,
        uint256 timeWindow
    ) public payable {
        uint256 pricePerSecondData = _getPricePerSecondData(productId);
        if (pricePerSecondData == 0x0) {
            //subscription is free. return payment and subscribe
            if (msg.value > 0x0) {
                payable(msg.sender).transfer(msg.value);
            }
            marketplace.buyFor(productId, minSubscriptionSeconds, msg.sender);
            return;
        }
        address weth =  IPeripheryImmutableState(address(uniswapRouter)).WETH9();
        WETH(weth).deposit{value: msg.value}();
        require(IERC20(weth).approve(address(uniswapRouter), msg.value),"approval failed");
        _buyWithUniswap(
            productId,
            minSubscriptionSeconds,
            timeWindow,
            pricePerSecondData,
            msg.value,
            weth
        );
    }

    /**
        from_token = uniswapRouter.WETH() means ETH
     */
    function _buyWithUniswap(
        bytes32 productId,
        uint256 minSubscriptionSeconds,
        uint256 timeWindow,
        uint256 pricePerSecondData,
        uint256 amount,
        address from_token
    ) internal {
        if (from_token == address(datacoin)) {
            marketplace.buyFor(
                productId,
                amount/pricePerSecondData,
                msg.sender
            );
            return;
        }
        uint256 price = pricePerSecondData * minSubscriptionSeconds;
        uint256 datacoin_before_transfer = datacoin.balanceOf(address(this));
        // TransferInput should revert if it cant get at least 'price' amount of DATAcoin
        
        bytes memory path = _uniswapPath(from_token);
        uint256 received_datacoin = uniswapRouter.exactInput(
            ISwapRouter.ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp + timeWindow,
                amountIn: amount,
                amountOutMinimum: price
            })
        );
        require(
            datacoin.balanceOf(address(this)) - datacoin_before_transfer >=
                received_datacoin &&
                received_datacoin >= price,
            "not enough datacoin received"
        );
        require(datacoin.approve(address(marketplace), 0), "approval failed");
        require(
            datacoin.approve(address(marketplace), received_datacoin),
            "approval failed"
        );
        marketplace.buyFor(
            productId,
            received_datacoin / pricePerSecondData,
            msg.sender
        );
    }

    function _uniswapPath(address fromCoin)
        internal
        view
        returns (bytes memory)
    {
        if (liquidityToken == address(0)) {
            //no intermediary swap
            //return abi.encodePacked(address(datacoin), poolFee, fromCoin);
            return abi.encodePacked(fromCoin, poolFee, address(datacoin));
        }
        return
            abi.encodePacked(
                fromCoin,
                poolFee,
                liquidityToken,
                poolFee,
                address(datacoin)
            );
    }
}
