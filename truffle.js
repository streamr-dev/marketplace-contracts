module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!

	networks: {
		"local-rinkeby": {
			host: "localhost",
			port: 8546,
			network_id: "4"
		},
		"local-mainnet": {
			host: "localhost",
			port: 8547,
			network_id: "1"
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
