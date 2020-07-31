var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
var NonceTrackerSubprovider = require("web3-provider-engine/subproviders/nonce-tracker")

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      // accounts: 100, // Control in Ganache-cli
      gasLimit: 300000000,
      gasPrice: 20000000000
    }
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};
/* 100 accounts with 10,000eth 300,000,000 gas limit:
ganache-cli -a 100 -e 10000 -l 300000000 -m candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
*/