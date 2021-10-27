const { increaseTime } = require("./testHelpers")

describe("increaseTime", () => {
    it("actually increases the time!", done => {
        increaseTime(1000).then(t1 => {
            web3.eth.getBlock("latest", (err1, block1) => {
                increaseTime(1000).then(t2 => {
                    web3.eth.getBlock("latest", (err2, block2) => {
                        const diff = block2.timestamp - block1.timestamp
                        assert(diff >= 1000)
                        assert((t2 - t1) - diff < 2)
                        assert((t2 - t1) - diff > -2)
                        done()
                    })
                })
            })
        })
    })
})
