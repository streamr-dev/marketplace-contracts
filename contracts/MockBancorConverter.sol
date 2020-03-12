
pragma solidity ^0.5.16;

interface IERC20Token {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address _owner) external view returns (uint256);
    function allowance(address _owner, address _spender) external view returns (uint256);
    function transfer(address _to, uint256 _value) external returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
    function approve(address _spender, uint256 _value) external returns (bool success);
}

contract IBancorConverter {
    function quickConvert(IERC20Token[] memory _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {}
}

/**
tranfers amount of IERC20Token[0] to this contract, and transfers same amount of IERC20Token[path.length-1] token to caller
 */

contract MockBancorConverter is IBancorConverter {
    function quickConvert(IERC20Token[] memory _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {
        IERC20Token toToken = _path[_path.length-1];
        require(_amount >= _minReturn, "error_minreturn");
        if(msg.value > 0){
            //eth purchase
            require(_amount == msg.value, "should pass amount = msg.value for ETH purchase");
        }

        else{
            // ERC20 purchase
            IERC20Token fromToken = _path[0];
            require(fromToken.transferFrom(msg.sender,address(this),_amount),"tranfer failed");
        }
        require(toToken.transfer(msg.sender,_amount),"send to buyer failed");
        return _amount;
    }

}
