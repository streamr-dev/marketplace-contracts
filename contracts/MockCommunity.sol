pragma solidity ^0.5.16;

import "./PurchaseListener.sol";

// Cause truffle compile to also build the ERC20Mintable for testing
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

/**
 * Part of Marketplace unit tests; tests that subscription notifies beneficiary contract
 *
 * Also minimal Community implementation
 */
contract MockCommunity is PurchaseListener {
    event PurchaseRegistered();

    bool public onPurchaseReturn = true;

    function onPurchase(bytes32, address, uint, uint, uint) external returns (bool) {
        emit PurchaseRegistered();
        return onPurchaseReturn;
    }
    function setReturnVal(bool val) public{
        onPurchaseReturn = val;
    }
}
