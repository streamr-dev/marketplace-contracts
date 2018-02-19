pragma solidity ^0.4.0;

import "../node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

// TODO: is Ownable
contract Marketplace {

    event ProductCreated(bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds);
    event ProductUpdated(bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds);
    event ProductDeleted(bytes32 indexed id);
    event Subscribed(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event NewSubscription(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionExtended(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionTransferred(bytes32 indexed productId, address indexed from, address indexed to, uint secondsTransferred, uint datacoinTransferred);

    // "plain" struct can be returned from functions
    // alternatives: ProductData, mapping outside Product, manual struct decomposition + repetition
    struct ProductData {
        string name;
        address beneficiary;
        uint pricePerSecond;
        uint minimumSubscriptionSeconds;
    }

    struct Product {
        //string parentProductId;   // later, products could be arranged in trees containing sub-products
        bytes32 id;
        ProductData data;
        mapping(address => TimeBasedSubscription) subscriptions;
    }

    struct TimeBasedSubscription {        
        //string productId;         // from mapping key
        //address buyer;            // from mapping key
        uint endTimestamp;
    }

    mapping (bytes32 => Product) products;
    function getProduct(bytes32 id) public view returns (ProductData product) {
        return products[id].data;
    }

    //mapping (string => mapping(address => TimeBasedSubscription)) subscriptions;
    function getSubscription(bytes32 productId, address subscriber) public view returns (TimeBasedSubscription subsciption) {
        var (, , sub) = _getSubscription(productId, subscriber);
        return sub;
    }

    function getSubscription(bytes32 productId) public view returns (TimeBasedSubscription subsciption) {
        return getSubscription(productId, msg.sender);
    }

    ERC20 datacoin;

    function Marketplace(address datacoinAddress) public {
        datacoin = ERC20(datacoinAddress);
    }

    ////////////////// Product management /////////////////

    // also checks that p exists at the same
    modifier onlyBeneficiary(bytes32 productId) {
        Product storage p = products[productId];        
        require(p.data.beneficiary == msg.sender); //, "Only product beneficiary may call this function");
        _;
    }

    // TODO: priceCurrency
    function createProduct(bytes32 id, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds) public {        
        require(pricePerSecond > 0); //, "Free streams go through different channel");
        Product storage p = products[id];
        require(p.id == 0); //, "Product with this ID already exists");        
        products[id] = Product(id, ProductData(name, beneficiary, pricePerSecond, minimumSubscriptionSeconds));
        ProductCreated(id, name, beneficiary, pricePerSecond, minimumSubscriptionSeconds);
    }

    /**
    * Stop offering the product
    */
    function deleteProduct(bytes32 productId) public onlyBeneficiary(productId) {
        // onlyBeneficiary check that the productId exists
        // TODO: check there are no active subscriptions?
        delete products[productId];
    }

    function updatePricing(bytes32 productId, uint pricePerSecond, uint minimumSubscriptionSeconds) public onlyBeneficiary(productId) {
        require(pricePerSecond > 0); //, "Free streams go through different channel");
        Product storage p = products[productId]; 
        require(p.id != 0); //, "Product doesn't exist");
        p.data.pricePerSecond = pricePerSecond;
        p.data.minimumSubscriptionSeconds = minimumSubscriptionSeconds;        
        ProductUpdated(productId, p.data.name, p.data.beneficiary, pricePerSecond, minimumSubscriptionSeconds);
    }

    /**
    * Transfers ownership of the product to a new beneficiary
    */
    function setBeneficiary(bytes32 productId, address newBeneficiary) public onlyBeneficiary(productId) {
        // that productId exists is already checked in onlyBeneficiary
        products[productId].data.beneficiary = newBeneficiary;        
    }

    /////////////// Subscription management ///////////////

    /**
     * Purchases access to this stream for msg.sender.
     * If the address already has a valid subscription, extends the subscription by the given period.
     */
     // TODO: use DATAcoin
    function buy(bytes32 productId, uint subscriptionSeconds) public {
        var (, product, sub) = _getSubscription(productId, msg.sender);
        require(subscriptionSeconds >= 1); //, "Must send ether for at least one second, see pricePerSecond of the product");
        _subscribe(product, sub, subscriptionSeconds);

        uint price = product.data.pricePerSecond * subscriptionSeconds;
        require(datacoin.transferFrom(msg.sender, product.data.beneficiary, price));  //, "Not enough DATAcoin allowance");
    }

    /**
    * Checks if the given address currently has a valid subscription
    */
    function hasValidSubscription(bytes32 productId, address subscriber) public constant returns (bool) {
        var (isValid, , ) = _getSubscription(productId, subscriber);
        return isValid;
    }

    /**
    * Transfer a valid subscription from msg.sender to a new address.
    * If the address already has a valid subscription, extends the subscription by the msg.sender's remaining period.
    */
    function transferSubscription(bytes32 productId, address newSubscriber) public {
        var (isValid, product, sub) = _getSubscription(productId, msg.sender);
        require(isValid);   //, "Only valid subscriptions can be transferred");
        uint secondsLeft = sub.endTimestamp - block.timestamp; // TODO: SafeMath
        uint datacoinLeft = secondsLeft * product.data.pricePerSecond;
        TimeBasedSubscription storage newSub = product.subscriptions[newSubscriber];
        _subscribe(product, newSub, secondsLeft);
        delete product.subscriptions[msg.sender];
        SubscriptionTransferred(productId, msg.sender, newSubscriber, secondsLeft, datacoinLeft);
    }

    function _getSubscription(bytes32 productId, address subscriber) internal constant returns (bool subIsValid, Product storage, TimeBasedSubscription storage) {
        Product storage p = products[productId];
        require(p.id != 0); //, "Product doesn't exist");
        TimeBasedSubscription storage s = p.subscriptions[subscriber];
        return (s.endTimestamp >= block.timestamp, p, s);
    }
    
    function _subscribe(Product storage p, TimeBasedSubscription storage oldSub, uint addSeconds) internal {
        uint endTimestamp;
        if (oldSub.endTimestamp > block.timestamp) {
            endTimestamp = oldSub.endTimestamp + addSeconds;    // TODO: SafeMath
            oldSub.endTimestamp = endTimestamp;  
            SubscriptionExtended(p.id, msg.sender, endTimestamp);
        } else {
            require(addSeconds >= p.data.minimumSubscriptionSeconds); //, "More ether required to meet the minimum subscription period");
            endTimestamp = block.timestamp + addSeconds;
            TimeBasedSubscription memory newSub = TimeBasedSubscription(endTimestamp);
            p.subscriptions[msg.sender] = newSub;
            NewSubscription(p.id, msg.sender, endTimestamp);
        }
        Subscribed(p.id, msg.sender, endTimestamp);
    }

    // TODO: transfer allowance to another Marketplace
}