pragma solidity ^0.4.0;

import "../node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

// TODO: is Ownable
contract Marketplace {

    event ProductCreated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds);
    event ProductUpdated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds);
    event ProductDeleted(address indexed owner, bytes32 indexed id);
    event ProductRedeployed(address indexed owner, bytes32 indexed id);    
    event ProductOwnershipOffered(address indexed owner, bytes32 indexed id, address indexed to);
    event ProductOwnershipChanged(address indexed newOwner, bytes32 indexed id, address indexed oldOwner);
    event Subscribed(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event NewSubscription(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionExtended(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionTransferred(bytes32 indexed productId, address indexed from, address indexed to, uint secondsTransferred, uint datacoinTransferred);    

    enum ProductState {
        NotDeployed,                // non-existent or deleted
        Deployed                    // created or redeployed
    }

    struct Product {
        //bytes32 parentProductId;   // later, products could be arranged in trees containing sub-products
        bytes32 id;
        string name;
        address owner;
        address beneficiary;        // account where revenue is directed to
        uint pricePerSecond;
        uint minimumSubscriptionSeconds;
        ProductState state;
        mapping(address => TimeBasedSubscription) subscriptions;
        address newOwnerCandidate;  // Two phase hand-over to minimize the chance that the product ownership is lost to a non-existent address.
    }

    struct TimeBasedSubscription {        
        //string productId;         // from mapping key
        //address buyer;            // from mapping key
        uint endTimestamp;
    }

    mapping (bytes32 => Product) products;
    function getProduct(bytes32 id) public view returns (string name, address owner, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds, ProductState state) {
        return (
            products[id].name,
            products[id].owner,
            products[id].beneficiary,
            products[id].pricePerSecond,
            products[id].minimumSubscriptionSeconds,
            products[id].state
        );
    }

    function getSubscription(bytes32 productId, address subscriber) public view returns (bool isValid, uint endTimestamp, uint secondsLeft) {        
        var (v, , sub) = _getSubscription(productId, subscriber);
        isValid = v;
        endTimestamp = sub.endTimestamp;
        secondsLeft = isValid ? sub.endTimestamp - block.timestamp : 0;
    }

    function getSubscription(bytes32 productId) public view returns (bool isValid, uint endTimestamp, uint secondsLeft) {
        return getSubscription(productId, msg.sender);
    }

    ERC20 datacoin;

    function Marketplace(address datacoinAddress) public {
        datacoin = ERC20(datacoinAddress);
    }

    ////////////////// Product management /////////////////

    // also checks that p exists: p.owner == 0 for non-existent products
    modifier onlyProductOwner(bytes32 productId) {
        Product storage p = products[productId];        
        require(p.owner == msg.sender); //, "Only product owner may call this function");
        _;
    }

    // TODO: priceCurrency
    function createProduct(bytes32 id, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds) public {        
        require(pricePerSecond > 0); //, "Free streams go through different channel");
        Product storage p = products[id];
        require(p.id == 0); //, "Product with this ID already exists");        
        products[id] = Product(id, name, msg.sender, beneficiary, pricePerSecond, minimumSubscriptionSeconds, ProductState.Deployed, 0);
        ProductCreated(msg.sender, id, name, beneficiary, pricePerSecond, minimumSubscriptionSeconds);
    }

    /**
    * Stop offering the product
    */
    function deleteProduct(bytes32 productId) public onlyProductOwner(productId) {        
        require(products[productId].state == ProductState.Deployed);
        products[productId].state = ProductState.NotDeployed;
        ProductDeleted(products[productId].owner, productId);
    }

    /**
    * Return product to market
    */
    function redeployProduct(bytes32 productId) public onlyProductOwner(productId) {        
        require(products[productId].state == ProductState.NotDeployed);
        products[productId].state = ProductState.Deployed;
        ProductRedeployed(products[productId].owner, productId);
    }

    function updateProduct(bytes32 productId, string name, address beneficiary, uint pricePerSecond, uint minimumSubscriptionSeconds) public onlyProductOwner(productId) {
        require(pricePerSecond > 0); //, "Free streams go through different channel");
        Product storage p = products[productId]; 
        p.name = name;
        p.beneficiary = beneficiary;
        p.pricePerSecond = pricePerSecond;
        p.minimumSubscriptionSeconds = minimumSubscriptionSeconds;        
        ProductUpdated(p.owner, p.id, name, beneficiary, pricePerSecond, minimumSubscriptionSeconds);
    }

    /**
    * Changes ownership of the product. Two phase hand-over minimizes the chance that the product ownership is lost to a non-existent address.
    */
    function offerProductOwnership(bytes32 productId, address newOwnerCandidate) public onlyProductOwner(productId) {
        // that productId exists is already checked in onlyProductOwner
        products[productId].newOwnerCandidate = newOwnerCandidate;
        ProductOwnershipOffered(products[productId].owner, productId, newOwnerCandidate);
    }

    /**
    * Changes ownership of the product. Two phase hand-over minimizes the chance that the product ownership is lost to a non-existent address.
    */
    function claimProductOwnership(bytes32 productId) public {
        // also checks that productId exists
        Product storage p = products[productId]; 
        require(msg.sender == p.newOwnerCandidate);
        ProductOwnershipChanged(msg.sender, productId, p.owner);
        p.owner = msg.sender;
        p.newOwnerCandidate = 0;
    }

    /////////////// Subscription management ///////////////

    /**
     * Purchases access to this stream for msg.sender.
     * If the address already has a valid subscription, extends the subscription by the given period.
     */
    function buy(bytes32 productId, uint subscriptionSeconds) public {
        var (, product, sub) = _getSubscription(productId, msg.sender);
        require(product.state == ProductState.Deployed); //, "Product has been deleted");        
        _addSubscription(product, msg.sender, subscriptionSeconds, sub);

        uint price = product.pricePerSecond * subscriptionSeconds;
        require(datacoin.transferFrom(msg.sender, product.beneficiary, price));  //, "Not enough DATAcoin allowance");
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
        uint datacoinLeft = secondsLeft * product.pricePerSecond;
        TimeBasedSubscription storage newSub = product.subscriptions[newSubscriber];
        _addSubscription(product, newSubscriber, secondsLeft, newSub);
        delete product.subscriptions[msg.sender];
        SubscriptionTransferred(productId, msg.sender, newSubscriber, secondsLeft, datacoinLeft);
    }

    function _getSubscription(bytes32 productId, address subscriber) internal constant returns (bool subIsValid, Product storage, TimeBasedSubscription storage) {
        Product storage p = products[productId];
        require(p.id != 0); //, "Product doesn't exist");
        TimeBasedSubscription storage s = p.subscriptions[subscriber];
        return (s.endTimestamp >= block.timestamp, p, s);
    }
    
    function _addSubscription(Product storage p, address subscriber, uint addSeconds, TimeBasedSubscription storage oldSub) internal {
        uint endTimestamp;
        if (oldSub.endTimestamp > block.timestamp) {
            require(addSeconds > 0); //, "Must top up worth at least one second");
            endTimestamp = oldSub.endTimestamp + addSeconds;    // TODO: SafeMath
            oldSub.endTimestamp = endTimestamp;  
            SubscriptionExtended(p.id, subscriber, endTimestamp);
        } else {
            require(addSeconds >= p.minimumSubscriptionSeconds); //, "More ether required to meet the minimum subscription period");
            endTimestamp = block.timestamp + addSeconds;
            TimeBasedSubscription memory newSub = TimeBasedSubscription(endTimestamp);
            p.subscriptions[subscriber] = newSub;
            NewSubscription(p.id, subscriber, endTimestamp);
        }
        Subscribed(p.id, subscriber, endTimestamp);
    }

    // TODO: transfer allowance to another Marketplace
}