import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import BigNumber from 'bignumber.js';
import regeneratorRuntime from "regenerator-runtime";

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
const accounts = web3.eth.getAccounts();

console.log("server is running");

init();
// Error: flightSuretyApp is undefined
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let oracleArr = [];
const oracleCount = 20;

// Oracles register after moving outside init()
registerOracles(oracleCount);

async function init() {
	console.log("init started");		


	flightSuretyApp.events.OracleRequest({ fromBlock: 0 }, 
		(error, event) => {
			if (error) console.log(error);
			console.log(event);

        oracleResponse(
            event.returnValues.index,
            event.returnValues.airline,
            event.returnValues.flightID,
            event.returnValues.timestamp
       	)
	});
};
// Not Working - Update: Oracles register after moving registerOracles() outside init()
async function registerOracles(oracleCount) {
	console.log("registerOracles from server.js");		
	console.log("1");

	const fee = await flightSuretyApp.methods
						.REGISTRATION_FEE()
						.call();

	const statusCodeArr = [0, 10, 20, 30, 40, 50];

    for(let i=1; i<=oracleCount; i++) {
    	let oracleAcct = accounts[i+20];
        let statusCode = statusCodeArr[Math.floor(Math.random() * statusCodeArr.length)];
		console.log("2");
    	flightSuretyApp.methods
    		.registerOracle()
    		.send({ from: oracleAcct, value: fee, gas: 300000000 });
    	console.log("3");

    	let indexes = await flightSuretyApp.methods
				      	.getMyIndexes
				      	.call({ from: oracleAcct });

	    oracleArr.push({ oracleAcct, indexes, statusCode });

        console.log(`Oracle ${i}: ${oracleArr.length}`);
	};
}

async function oracleResponse(index, airline, flightID, timestamp) {
	console.log("oracleResponse from server.js");

    oracleArr.forEach(async(oracle) => {
    	for(let i=0; i<3; i++){
	    	if(BigNumber(oracle.indexes[i]).isEqualTo(index)){
	    		console.log("match!");
	    		try{
	    		console.log("submitOracleResponse sent!");
	    		console.log("4");

	    		await flightSuretyApp.methods
		            .submitOracleResponse(index, airline, flightID, timestamp, oracle.statusCode)
		            .send({ from: oracle.address, gas: 300000000 })
		        } catch(e) {
			    	console.log(`Error: ${e}`);
			    }
			}
    	}
    });
};

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
});

export default app;