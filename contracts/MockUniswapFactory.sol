
pragma solidity ^0.4.25;

contract IUniswapFactory {
    function getExchange(address token) public returns (address){}
}
contract MockUniswapFactory is IUniswapFactory {
    address exchange;
    constructor(address _exchange){
        exchange = _exchange;
    }
    function getExchange(address token) public returns (address){
        return exchange;
    }
}
