pragma solidity ^0.4.22;

import "./PurchaseListener.sol";

/**
 * Part of Marketplace unit tests; tests that subscription notifies beneficiary contract
 *
 * Also minimal Community implementation
 */
contract MockCommunity is PurchaseListener {
    event PurchaseRegistered();

    function onPurchase(bytes32, address, uint, uint) external returns (bool) {
        emit PurchaseRegistered();
        return true;
    }
}
