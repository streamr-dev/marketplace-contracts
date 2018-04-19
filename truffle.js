module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!

	networks: {
		"local": {
                        host: "localhost",
                        port: 8545,
                        network_id: "*"
                },
		"local-rinkeby": {
			host: "localhost",
			port: 8546,
			network_id: "4"
		},
		"local-mainnet": {
			host: "localhost",
			port: 8547,
			network_id: "1",
			gasPrice: "4000000000",
			gas: "50000"	// enough for migration setCompleted
		},
		rinkeby: {
			host: "94.130.239.166",
			port: 8546,
			network_id: "4"
		},
		mainnet: {
			host: "94.130.239.166",
			port: 8547,
			network_id: "1"
		}		
	}
};
