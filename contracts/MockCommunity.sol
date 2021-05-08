pragma solidity ^0.6.6;

import "./PurchaseListener.sol";

// Cause truffle compile to also build the ERC20Mintable for testing
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";

contract ERC20Mintable is ERC20Pausable {
    constructor(string memory name, string memory symbol) public ERC20(name, symbol) {

    }
}
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
