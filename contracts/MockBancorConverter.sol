
pragma solidity ^0.4.25;

contract IERC20Token {
	// these functions aren't abstract since the compiler emits automatically generated getter functions as external
    function name() public view returns (string) {}
    function symbol() public view returns (string) {}
    function decimals() public view returns (uint8) {}
    function totalSupply() public view returns (uint256) {}
    function balanceOf(address _owner) public view returns (uint256) { _owner; }
    function allowance(address _owner, address _spender) public view returns (uint256) { _owner; _spender; }
    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
    function approve(address _spender, uint256 _value) public returns (bool success);
}

contract IBancorConverter {
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {}
}

/**
tranfers amount of IERC20Token[0] to this contract, and transfers same amount of IERC20Token[path.length-1] token to caller
 */

contract MockBancorConverter is IBancorConverter {
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {
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
