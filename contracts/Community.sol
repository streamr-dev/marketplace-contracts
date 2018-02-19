pragma solidity ^0.4.0;

import "../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Marketplace.sol";

contract Community is Ownable {
    event JoinRequested(Producer requester);
    event ProducerJoined(Producer newProducer);

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

//    mapping (string => Producer[]) partialProducers;
    mapping (string => uint) earnings;

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
        producers[p.addr] = p;
        ProducerJoined(p);
        // createProduct for this separate producer?
    }

    function createProduct(string id, string name, uint pricePerSecond, uint minimumSubscriptionSeconds) internal {
        market.createProduct(id, name, this, pricePerSecond, minimumSubscriptionSeconds);
    }

    // receive payment from Products
    // TODO: but with DATAcoin
    function receive(string productId) public {
        
    }
}