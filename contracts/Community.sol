pragma solidity ^0.4.0;

import "../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Marketplace.sol";

contract Community is Ownable {
    event JoinRequested(Producer requester);
    event ProducerJoined(Producer newProducer);
    event JoinRequestRejected(Producer requester);

    struct Producer {
        address addr;
        string name;
        int reputation;
        //string[] streamListHashes;    // later feature: partial product purchase
    }

    Marketplace public market;

    function Community(Marketplace marketPlace) public {
        market = marketPlace;
    }

    // track earnings per product
    mapping (bytes32 => uint) earnings;
//    mapping (string => Producer[]) partialProducers;

    Producer[] public joinRequests;
    mapping (address => Producer) public producers;

    // TODO: invert: people must ask to join
    function join(string name) public {    
        Producer memory p = Producer(msg.sender, name, 0);
        joinRequests.push(p);
        JoinRequested(p);
    }

    function accept(uint index) public onlyOwner {
        Producer memory p = joinRequests[index];
        require(p.addr != 0); //, "Join request has already been processed");
        producers[p.addr] = p;
        delete joinRequests[index];
        ProducerJoined(p);
        // createProduct for this separate producer?
    }

    function reject(uint index) public onlyOwner {
        Producer memory p = joinRequests[index];
        require(p.addr != 0); //, "Join request has already been processed");        
        delete joinRequests[index];
        JoinRequestRejected(p);
    }

    function createProduct(bytes32 id, string name, uint pricePerSecond, Marketplace.Currency currency, uint minimumSubscriptionSeconds) internal {
        market.createProduct(id, name, this, pricePerSecond, currency, minimumSubscriptionSeconds);
    }

    // receive payment from Products
    // TODO: implement notification in Marketplace.sol
    // TODO: but with DATAcoin
    function receive(bytes32 productId, uint receivedTokens) public {
        earnings[productId] += receivedTokens;  // TODO: SafeMath
    }
}