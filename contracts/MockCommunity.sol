pragma solidity 0.4.25;

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

    function onPurchase(bytes32, address, uint, uint) external returns (bool) {
        emit PurchaseRegistered();
        return true;
    }
}
