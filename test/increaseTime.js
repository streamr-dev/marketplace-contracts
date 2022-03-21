const { increaseTime } = require('./testHelpers')

describe('increaseTime', () => {
    it('actually increases the time!', async () => {
        const t1 = await increaseTime(1000)
        const block1 = await web3.eth.getBlock('latest')
        const t2 = await increaseTime(1000)
        const block2 = await web3.eth.getBlock('latest')
        const diff = block2.timestamp - block1.timestamp
        assert(diff >= 1000)
        assert((t2 - t1) - diff < 2)
        assert((t2 - t1) - diff > -2)
    })
})
