// TODO: where should enums be so they'd stay synced automagically?
const ProductState = {
    NotDeployed: 0,                // non-existent or deleted
    Deployed: 1                    // created or redeployed
}
const Currency = {
    DATA: 0,                       // data atoms or "wei" (10^-18 DATA)
    USD: 1                         // nanodollars (10^-9 USD)
}

module.exports = {
    ProductState,
    Currency,

    // inverses
    currencySymbol: Object.getOwnPropertyNames(Currency),
    productStateName: Object.getOwnPropertyNames(ProductState)
}