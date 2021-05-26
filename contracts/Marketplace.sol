// solhint-disable not-rely-on-time
pragma solidity ^0.6.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./PurchaseListener.sol";
import "./Ownable.sol";


interface IMarketplace {
    enum ProductState {
        NotDeployed,                // non-existent or deleted
        Deployed                    // created or redeployed
    }

    enum Currency {
        DATA,                       // "token wei" (10^-18 DATA)
        USD                         // attodollars (10^-18 USD)
    }

    enum WhitelistState{
        None,
        Pending,
        Approved,
        Rejected
    }
    function getSubscription(bytes32 productId, address subscriber) external view returns (bool isValid, uint endTimestamp);
    function getPriceInData(uint subscriptionSeconds, uint price, Currency unit) external view returns (uint datacoinAmount);
}
interface IMarketplace1 is IMarketplace{
    function getProduct(bytes32 id) external view returns (string memory name, address owner, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, ProductState state);
}
interface IMarketplace2 is IMarketplace{
    function getProduct(bytes32 id) external view returns (string memory name, address owner, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, ProductState state, bool requiresWhitelist);
    function buyFor(bytes32 productId, uint subscriptionSeconds, address recipient) external;
}
/**
 * @title Streamr Marketplace
 * @dev note about numbers:
 *   All prices and exchange rates are in "decimal fixed-point", that is, scaled by 10^18, like ETH vs wei.
 *  Seconds are integers as usual.
 *
 * Next version TODO:
 *  - EIP-165 inferface definition; PurchaseListener
 */
contract Marketplace is Ownable, IMarketplace2 {
    using SafeMath for uint256;

    // product events
    event ProductCreated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductUpdated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductDeleted(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductImported(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductRedeployed(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductOwnershipOffered(address indexed owner, bytes32 indexed id, address indexed to);
    event ProductOwnershipChanged(address indexed newOwner, bytes32 indexed id, address indexed oldOwner);

    // subscription events
    event Subscribed(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event NewSubscription(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionExtended(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionImported(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionTransferred(bytes32 indexed productId, address indexed from, address indexed to, uint secondsTransferred);

    // currency events
    event ExchangeRatesUpdated(uint timestamp, uint dataInUsd);

    // whitelist events
    event WhitelistRequested(bytes32 indexed productId, address indexed subscriber);
    event WhitelistApproved(bytes32 indexed productId, address indexed subscriber);
    event WhitelistRejected(bytes32 indexed productId, address indexed subscriber);
    event WhitelistEnabled(bytes32 indexed productId);
    event WhitelistDisabled(bytes32 indexed productId);

    //txFee events
    event TxFeeChanged(uint256 indexed newTxFee);


    struct Product {
        bytes32 id;
        string name;
        address owner;
        address beneficiary;        // account where revenue is directed to
        uint pricePerSecond;
        Currency priceCurrency;
        uint minimumSubscriptionSeconds;
        ProductState state;
        address newOwnerCandidate;  // Two phase hand-over to minimize the chance that the product ownership is lost to a non-existent address.
        bool requiresWhitelist;
        mapping(address => TimeBasedSubscription) subscriptions;
        mapping(address => WhitelistState) whitelist;
    }

    struct TimeBasedSubscription {
        uint endTimestamp;
    }

    /////////////// Marketplace lifecycle /////////////////

    ERC20 public datacoin;

    address public currencyUpdateAgent;
    IMarketplace1 prev_marketplace;
    uint256 public txFee;

    constructor(address datacoinAddress, address currencyUpdateAgentAddress, address prev_marketplace_address) Ownable() public {
        _initialize(datacoinAddress, currencyUpdateAgentAddress, prev_marketplace_address);
    }

    function _initialize(address datacoinAddress, address currencyUpdateAgentAddress, address prev_marketplace_address) internal {
        currencyUpdateAgent = currencyUpdateAgentAddress;
        datacoin = ERC20(datacoinAddress);
        prev_marketplace = IMarketplace1(prev_marketplace_address);
    }

    ////////////////// Product management /////////////////

    mapping (bytes32 => Product) public products;
    /*
        checks this marketplace first, then the previous
    */
    function getProduct(bytes32 id) public override view returns (string memory name, address owner, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, ProductState state, bool requiresWhitelist) {
        (name, owner, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds, state, requiresWhitelist) = _getProductLocal(id);
        if (owner != address(0))
            return (name, owner, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds, state, requiresWhitelist);
        (name, owner, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds, state) = prev_marketplace.getProduct(id);
        return (name, owner, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds, state, false);
    }

    /**
    checks only this marketplace, not the previous marketplace
     */

    function _getProductLocal(bytes32 id) internal view returns (string memory name, address owner, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, ProductState state, bool requiresWhitelist) {
        Product memory p = products[id];
        return (
            p.name,
            p.owner,
            p.beneficiary,
            p.pricePerSecond,
            p.priceCurrency,
            p.minimumSubscriptionSeconds,
            p.state,
            p.requiresWhitelist
        );
    }

    // also checks that p exists: p.owner == 0 for non-existent products
    modifier onlyProductOwner(bytes32 productId) {
        (,address _owner,,,,,,) = getProduct(productId);
        require(_owner != address(0), "error_notFound");
        require(_owner == msg.sender || owner == msg.sender, "error_productOwnersOnly");
        _;
    }

    /**
     * Imports product details (but NOT subscription details) from previous marketplace
     */
    function _importProductIfNeeded(bytes32 productId) internal returns (bool imported){
        Product storage p = products[productId];
        if (p.id != 0x0) { return false; }
        (string memory _name, address _owner, address _beneficiary, uint _pricePerSecond, IMarketplace1.Currency _priceCurrency, uint _minimumSubscriptionSeconds, IMarketplace1.ProductState _state) = prev_marketplace.getProduct(productId);
        if (_owner == address(0)) { return false; }
        p.id = productId;
        p.name = _name;
        p.owner = _owner;
        p.beneficiary = _beneficiary;
        p.pricePerSecond = _pricePerSecond;
        p.priceCurrency = _priceCurrency;
        p.minimumSubscriptionSeconds = _minimumSubscriptionSeconds;
        p.state = _state;
        emit ProductImported(p.owner, p.id, p.name, p.beneficiary, p.pricePerSecond, p.priceCurrency, p.minimumSubscriptionSeconds);
        return true;
    }

    function _importSubscriptionIfNeeded(bytes32 productId, address subscriber) internal returns (bool imported) {
        bool _productImported = _importProductIfNeeded(productId);

        // check that subscription didn't already exist in current marketplace
        (Product storage product, TimeBasedSubscription storage sub) = _getSubscriptionLocal(productId, subscriber);
        if (sub.endTimestamp != 0x0) { return false; }

        // check that subscription exists in the previous marketplace(s)
        // only call prev_marketplace.getSubscription() if product exists there
        // consider e.g. product created in current marketplace but subscription still doesn't exist
        // if _productImported, it must have existed in previous marketplace so no need to perform check
        if (!_productImported) {
            (,address _owner_prev,,,,,) = prev_marketplace.getProduct(productId);
            if (_owner_prev == address(0)) { return false; }
        }
        (, uint _endTimestamp) = prev_marketplace.getSubscription(productId, subscriber);
        if (_endTimestamp == 0x0) { return false; }
        product.subscriptions[subscriber] = TimeBasedSubscription(_endTimestamp);
        emit SubscriptionImported(productId, subscriber, _endTimestamp);
        return true;
    }
    function createProduct(bytes32 id, string memory name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) public whenNotHalted {
        _createProduct(id, name, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds, false);
    }

    function createProductWithWhitelist(bytes32 id, string memory name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) public whenNotHalted {
        _createProduct(id, name, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds, true);
        emit WhitelistEnabled(id);
    }


    function _createProduct(bytes32 id, string memory name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, bool requiresWhitelist) internal {
        require(id != 0x0, "error_nullProductId");
        require(pricePerSecond > 0, "error_freeProductsNotSupported");
        (,address _owner,,,,,,) = getProduct(id);
        require(_owner == address(0), "error_alreadyExists");
        products[id] = Product({id: id, name: name, owner: msg.sender, beneficiary: beneficiary, pricePerSecond: pricePerSecond,
            priceCurrency: currency, minimumSubscriptionSeconds: minimumSubscriptionSeconds, state: ProductState.Deployed, newOwnerCandidate: address(0), requiresWhitelist: requiresWhitelist});
        emit ProductCreated(msg.sender, id, name, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds);
    }

    /**
    * Stop offering the product
    */
    function deleteProduct(bytes32 productId) public onlyProductOwner(productId) {
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        require(p.state == ProductState.Deployed, "error_notDeployed");
        p.state = ProductState.NotDeployed;
        emit ProductDeleted(p.owner, productId, p.name, p.beneficiary, p.pricePerSecond, p.priceCurrency, p.minimumSubscriptionSeconds);
    }

    /**
    * Return product to market
    */
    function redeployProduct(bytes32 productId) public onlyProductOwner(productId) {
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        require(p.state == ProductState.NotDeployed, "error_mustBeNotDeployed");
        p.state = ProductState.Deployed;
        emit ProductRedeployed(p.owner, productId, p.name, p.beneficiary, p.pricePerSecond, p.priceCurrency, p.minimumSubscriptionSeconds);
    }

    function updateProduct(bytes32 productId, string memory name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds, bool redeploy) public onlyProductOwner(productId) {
        require(pricePerSecond > 0, "error_freeProductsNotSupported");
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        p.name = name;
        p.beneficiary = beneficiary;
        p.pricePerSecond = pricePerSecond;
        p.priceCurrency = currency;
        p.minimumSubscriptionSeconds = minimumSubscriptionSeconds;
        emit ProductUpdated(p.owner, p.id, name, beneficiary, pricePerSecond, currency, minimumSubscriptionSeconds);
        if (redeploy) {
            redeployProduct(productId);
        }
    }

    /**
    * Changes ownership of the product. Two phase hand-over minimizes the chance that the product ownership is lost to a non-existent address.
    */
    function offerProductOwnership(bytes32 productId, address newOwnerCandidate) public onlyProductOwner(productId) {
        _importProductIfNeeded(productId);
        // that productId exists is already checked in onlyProductOwner
        products[productId].newOwnerCandidate = newOwnerCandidate;
        emit ProductOwnershipOffered(products[productId].owner, productId, newOwnerCandidate);
    }

    /**
    * Changes ownership of the product. Two phase hand-over minimizes the chance that the product ownership is lost to a non-existent address.
    */
    function claimProductOwnership(bytes32 productId) public whenNotHalted {
        _importProductIfNeeded(productId);
        // also checks that productId exists (newOwnerCandidate is zero for non-existent)
        Product storage p = products[productId];
        require(msg.sender == p.newOwnerCandidate, "error_notPermitted");
        emit ProductOwnershipChanged(msg.sender, productId, p.owner);
        p.owner = msg.sender;
        p.newOwnerCandidate = address(0);
    }

    /////////////// Whitelist management ///////////////

    function setRequiresWhitelist(bytes32 productId, bool _requiresWhitelist) public onlyProductOwner(productId) {
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        require(p.id != 0x0, "error_notFound");
        p.requiresWhitelist = _requiresWhitelist;
        if (_requiresWhitelist) {
            emit WhitelistEnabled(productId);
        } else {
            emit WhitelistDisabled(productId);
        }
    }

    function whitelistApprove(bytes32 productId, address subscriber) public onlyProductOwner(productId) {
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        require(p.id != 0x0, "error_notFound");
        require(p.requiresWhitelist, "error_whitelistNotEnabled");
        p.whitelist[subscriber] = WhitelistState.Approved;
        emit WhitelistApproved(productId, subscriber);
    }

    function whitelistReject(bytes32 productId, address subscriber) public onlyProductOwner(productId) {
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        require(p.id != 0x0, "error_notFound");
        require(p.requiresWhitelist, "error_whitelistNotEnabled");
        p.whitelist[subscriber] = WhitelistState.Rejected;
        emit WhitelistRejected(productId, subscriber);
    }

    function whitelistRequest(bytes32 productId) public {
        _importProductIfNeeded(productId);
        Product storage p = products[productId];
        require(p.id != 0x0, "error_notFound");
        require(p.requiresWhitelist, "error_whitelistNotEnabled");
        require(p.whitelist[msg.sender] == WhitelistState.None, "error_whitelistRequestAlreadySubmitted");
        p.whitelist[msg.sender] = WhitelistState.Pending;
        emit WhitelistRequested(productId, msg.sender);
    }

    function getWhitelistState(bytes32 productId, address subscriber) public view returns (WhitelistState wlstate) {
        (, address _owner,,,,,,) = getProduct(productId);
        require(_owner != address(0), "error_notFound");
        // if product is not local (maybe in old marketplace) this will return 0 (WhitelistState.None)
        Product storage p = products[productId];
        return p.whitelist[subscriber];
    }

    /////////////// Subscription management ///////////////

    function getSubscription(bytes32 productId, address subscriber) public override view returns (bool isValid, uint endTimestamp) {
        (,address _owner,,,,,,) = _getProductLocal(productId);
        if (_owner == address(0)) {
            return prev_marketplace.getSubscription(productId,subscriber);
        }

        (, TimeBasedSubscription storage sub) = _getSubscriptionLocal(productId, subscriber);
        if (sub.endTimestamp == 0x0) {
            // only call prev_marketplace.getSubscription() if product exists in previous marketplace too
            (,address _owner_prev,,,,,) = prev_marketplace.getProduct(productId);
            if (_owner_prev != address(0)) {
                return prev_marketplace.getSubscription(productId,subscriber);
            }
        }
        return (_isValid(sub), sub.endTimestamp);
    }

    function getSubscriptionTo(bytes32 productId) public view returns (bool isValid, uint endTimestamp) {
        return getSubscription(productId, msg.sender);
    }

    /**
     * Checks if the given address currently has a valid subscription
     * @param productId to check
     * @param subscriber to check
     */
    function hasValidSubscription(bytes32 productId, address subscriber) public view returns (bool isValid) {
        (isValid,) = getSubscription(productId, subscriber);
    }

    /**
     * Enforces payment rules, triggers PurchaseListener event
     */
    function _subscribe(bytes32 productId, uint addSeconds, address subscriber, bool requirePayment) internal {
        _importSubscriptionIfNeeded(productId, subscriber);
        (Product storage p, TimeBasedSubscription storage oldSub) = _getSubscriptionLocal(productId, subscriber);
        require(p.state == ProductState.Deployed, "error_notDeployed");
        require(!p.requiresWhitelist || p.whitelist[subscriber] == WhitelistState.Approved, "error_whitelistNotAllowed");
        uint endTimestamp;

        if (oldSub.endTimestamp > block.timestamp) {
            require(addSeconds > 0, "error_topUpTooSmall");
            endTimestamp = oldSub.endTimestamp.add(addSeconds);
            oldSub.endTimestamp = endTimestamp;
            emit SubscriptionExtended(p.id, subscriber, endTimestamp);
        } else {
            require(addSeconds >= p.minimumSubscriptionSeconds, "error_newSubscriptionTooSmall");
            endTimestamp = block.timestamp.add(addSeconds);
            TimeBasedSubscription memory newSub = TimeBasedSubscription(endTimestamp);
            p.subscriptions[subscriber] = newSub;
            emit NewSubscription(p.id, subscriber, endTimestamp);
        }
        emit Subscribed(p.id, subscriber, endTimestamp);

        uint256 price = 0;
        uint256 fee = 0;
        address recipient = p.beneficiary;
        if (requirePayment) {
            price = getPriceInData(addSeconds, p.pricePerSecond, p.priceCurrency);
            fee = txFee.mul(price).div(1 ether);
            require(datacoin.transferFrom(msg.sender, recipient, price.sub(fee)), "error_paymentFailed");
            if (fee > 0) {
                require(datacoin.transferFrom(msg.sender, owner, fee), "error_paymentFailed");
            }
        }

        uint256 codeSize;
        assembly { codeSize := extcodesize(recipient) }  // solhint-disable-line no-inline-assembly
        if (codeSize > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory returnData) = recipient.call(
                abi.encodeWithSignature("onPurchase(bytes32,address,uint256,uint256,uint256)",
                productId, subscriber, oldSub.endTimestamp, price, fee)
            );

            if (success) {
                (bool accepted) = abi.decode(returnData, (bool));
                require(accepted, "error_rejectedBySeller");
            }
        }
    }

    function grantSubscription(bytes32 productId, uint subscriptionSeconds, address recipient) public whenNotHalted onlyProductOwner(productId){
        return _subscribe(productId, subscriptionSeconds, recipient, false);
    }


    function buyFor(bytes32 productId, uint subscriptionSeconds, address recipient) public override whenNotHalted {
        return _subscribe(productId, subscriptionSeconds, recipient, true);
    }


    /**
     * Purchases access to this stream for msg.sender.
     * If the address already has a valid subscription, extends the subscription by the given period.
     * @dev since v4.0: Notify the seller if the seller implements PurchaseListener interface
     */
    function buy(bytes32 productId, uint subscriptionSeconds) public whenNotHalted {
        buyFor(productId,subscriptionSeconds, msg.sender);
    }


    /** Gets subscriptions info from the subscriptions stored in this contract */
    function _getSubscriptionLocal(bytes32 productId, address subscriber) internal view returns (Product storage p, TimeBasedSubscription storage s) {
        p = products[productId];
        require(p.id != 0x0, "error_notFound");
        s = p.subscriptions[subscriber];
    }

    function _isValid(TimeBasedSubscription storage s) internal view returns (bool) {
        return s.endTimestamp >= block.timestamp;  // solhint-disable-line not-rely-on-time
    }

    // TODO: transfer allowance to another Marketplace contract
    // Mechanism basically is that this Marketplace draws from the allowance and credits
    //   the account on another Marketplace; OR that there is a central credit pool (say, an ERC20 token)
    // Creating another ERC20 token for this could be a simple fix: it would need the ability to transfer allowances

    /////////////// Currency management ///////////////

    // Exchange rates are formatted as "decimal fixed-point", that is, scaled by 10^18, like ether.
    //        Exponent: 10^18 15 12  9  6  3  0
    //                      |  |  |  |  |  |  |
    uint public dataPerUsd = 100000000000000000;   // ~= 0.1 DATA/USD

    /**
    * Update currency exchange rates; all purchases are still billed in DATAcoin
    * @param timestamp in seconds when the exchange rates were last updated
    * @param dataUsd how many data atoms (10^-18 DATA) equal one USD dollar
    */
    function updateExchangeRates(uint timestamp, uint dataUsd) public {
        require(msg.sender == currencyUpdateAgent, "error_notPermitted");
        require(dataUsd > 0, "error_invalidRate");
        dataPerUsd = dataUsd;
        emit ExchangeRatesUpdated(timestamp, dataUsd);
    }

    /**
    * Helper function to calculate (hypothetical) subscription cost for given seconds and price, using current exchange rates.
    * @param subscriptionSeconds length of hypothetical subscription, as a non-scaled integer
    * @param price nominal price scaled by 10^18 ("token wei" or "attodollars")
    * @param unit unit of the number price
    */
    function getPriceInData(uint subscriptionSeconds, uint price, Currency unit) public override view returns (uint datacoinAmount) {
        if (unit == Currency.DATA) {
            return price.mul(subscriptionSeconds);
        }
        return price.mul(dataPerUsd).mul(subscriptionSeconds).div(10**18);
    }

    /////////////// Admin functionality ///////////////

    event Halted();
    event Resumed();
    bool public halted = false;

    modifier whenNotHalted() {
        require(!halted || owner == msg.sender, "error_halted");
        _;
    }
    function halt() public onlyOwner {
        halted = true;
        emit Halted();
    }
    function resume() public onlyOwner {
        halted = false;
        emit Resumed();
    }

    function reInitialize(address datacoinAddress, address currencyUpdateAgentAddress, address prev_marketplace_address) public onlyOwner {
        _initialize(datacoinAddress, currencyUpdateAgentAddress, prev_marketplace_address);
    }

    function setTxFee(uint256 newTxFee) public onlyOwner {
        require(newTxFee <= 1 ether, "error_invalidTxFee");
        txFee = newTxFee;
        emit TxFeeChanged(txFee);
    }
}
