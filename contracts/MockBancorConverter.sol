
pragma solidity ^0.6.6;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

interface IBancorConverter {
    function quickConvert(IERC20[] calldata _path, uint256 _amount, uint256 _minReturn) external payable returns (uint256);
}

/**
tranfers amount of IERC20Token[0] to this contract, and transfers same amount of IERC20Token[path.length-1] token to caller
 */

contract MockBancorConverter is IBancorConverter {
    function quickConvert(IERC20[] memory _path, uint256 _amount, uint256 _minReturn) public override payable returns (uint256) {
        IERC20 toToken = _path[_path.length-1];
        require(_amount >= _minReturn, "error_minreturn");
        if(msg.value > 0){
            //eth purchase
            require(_amount == msg.value, "should pass amount = msg.value for ETH purchase");
        }

        else{
            // ERC20 purchase
            IERC20 fromToken = _path[0];
            require(fromToken.transferFrom(msg.sender,address(this),_amount),"tranfer failed");
        }
        require(toToken.transfer(msg.sender,_amount),"send to buyer failed");
        return _amount;
    }

}
