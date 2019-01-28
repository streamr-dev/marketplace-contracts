/* eslint-disable */

const fetch = require("node-fetch")

const Web3 = require("web3")
const web3 = new Web3(new Web3.providers.HttpProvider("https://rinkeby.infura.io/c8JX2pbGlCN6dTr6jJW5"))

const datacoinAddress = "0x8e3877fe5551f9c14bc9b062bbae9d84bc2f5d4e"
const streamrUpdaterAddress = "0xb6aA9D2708475fB026a8052E20e63AeA23233613"

const productListURL = "http://localhost:8081/streamr-core/api/v1/products?publicAccess=true"

const Marketplace = require("./build/contracts/Marketplace.json")
const market = web3.eth.contract(Marketplace.abi).at(Marketplace.networks["4"].address);
(async () => {
    const products = await (await fetch(productListURL)).json()

    for (p of products) {
        await market.createProduct(`0x${p.id}`, p.name, streamrUpdaterAddress, p.pricePerSecond, p.priceCurrency == "DATA" ? 0 : 1, p.minimumSubscriptionInSeconds)// , {from: streamrUpdaterAddress})
        if (p.state == "NOT_DEPLOYED") {
            await market.deleteProduct(`0x${p.id}`)
        }
    }
})().then().catch(e => console.error(JSON.stringify(e)))
