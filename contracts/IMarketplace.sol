pragma solidity ^0.6.0;

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
