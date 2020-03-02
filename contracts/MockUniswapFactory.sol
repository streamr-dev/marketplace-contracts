
pragma solidity ^0.5.16;

contract IUniswapFactory {
    function getExchange(address token) public returns (address){}
}
contract MockUniswapFactory is IUniswapFactory {
    address exchange;
    constructor(address _exchange) public {
        exchange = _exchange;
    }
    function getExchange(address token) public returns (address){
        return exchange;
    }
}
