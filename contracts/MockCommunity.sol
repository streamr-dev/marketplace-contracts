pragma solidity ^0.6.6;

import "./PurchaseListener.sol";

/**
 * Part of Marketplace unit tests; tests that subscription notifies beneficiary contract
 *
 * Also minimal Community implementation
 */
contract MockCommunity is PurchaseListener {
    event PurchaseRegistered();

    bool public onPurchaseReturn = true;

    function onPurchase(bytes32, address, uint, uint, uint) external override returns (bool) {
        emit PurchaseRegistered();
        return onPurchaseReturn;
    }
    function setReturnVal(bool val) public{
        onPurchaseReturn = val;
    }
}
