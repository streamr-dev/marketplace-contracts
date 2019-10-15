
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
contract IUniswapExchange{
    function getEthToTokenOutputPrice(uint256 tokens_bought) public view returns (uint256) {}
    function ethToTokenTransferInput(uint256 min_tokens,uint deadline,address recipient) public payable returns (uint256) {}
    function tokenToTokenTransferInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address recipient, address token_addr) external returns (uint256  tokens_bought) {}
}

contract MockUniswapExchange is IUniswapExchange {
    IERC20Token input_token;
    IERC20Token output_token;
    constructor(address input_token_address, address output_token_address){
        input_token = IERC20Token(input_token_address);
        output_token = IERC20Token(output_token_address);
    }
    function getEthToTokenOutputPrice(uint256 tokens_bought) public view returns (uint256) {
        return tokens_bought;
    }
    function ethToTokenTransferInput(uint256 min_tokens,uint deadline,address recipient) public payable returns (uint256) {
        uint256 purchased_tokens = msg.value;
        require(purchased_tokens >= min_tokens,"couldnt get min_tokens");
        require(output_token.transfer(msg.sender,purchased_tokens),"couldnt buy token");
        return purchased_tokens;
    }
    function tokenToTokenTransferInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address recipient, address token_addr) external returns (uint256  tokens_bought){
        require(address(output_token) == token_addr, "token not supported");
        require(min_tokens_bought <= tokens_sold, "not enough tokens supplied");
        require(input_token.transferFrom(msg.sender,address(this),tokens_sold),"couldnt transfer input token");

        uint256 purchased_tokens = tokens_sold;
        require(purchased_tokens >= min_tokens_bought,"couldnt get min_tokens_bought");
        require(output_token.transfer(msg.sender,purchased_tokens),"couldnt buy token");
        return purchased_tokens;
    }
}
