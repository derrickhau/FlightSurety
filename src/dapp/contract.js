import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {
        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.firstAirline = null;
        this.firstPassenger = null;
        this.dataAddr = config.dataAddress;
        this.appAddr = config.appAddress;
        this.airlines = [];
        this.passengers = [];
    }

    async initialize(callback) {
        // Metamask
        if (typeof web3 !== "undefined") {
            console.log("Using web3 detected from external source like Metamask")
            window.web3 = new Web3(web3.currentProvider)
            ethereum.autoRefreshOnNetworkChange = false
        } else {
            console.log("No web3 detected. Falling back to http://localhost:9545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for deployment. More info here: http://truffleframework.com/tutorials/truffle-and-metamask")
            window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:9545"))
        }

        // Set Accounts
        this.web3.eth.getAccounts((error, accts) => {
            // Set App Contract Owner and firstAirline accounts
            this.owner = accts[0];
            this.firstAirline = accts[1] // Pre-registered on deployment

            // Set airlines 2-6
            let counter = 2;
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            // Set firstPassenger to account[7]
            this.firstPassenger = accts[counter++]
            // Set passengers 8-12
            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    // Airlines
    registerAirline(airline) {
        let self = this;
        let sender = self.firstAirline;
        self.flightSuretyApp.methods
            .registerAirline(airline)
            .send({ from: sender, gas: 3000000 });
    }

    fundAirline(airline) {
        let self = this;
        let amount = self.web3.utils.toWei('10', 'ether');
        self.flightSuretyApp.methods
            .fundAirline()
            .send({ from: airline, value: amount });
    }

    getBalance(address, callback) {
        let self = this;
        let bal = self.web3.eth.getBalance(address, callback);
    }    

    getAirlineStatus(airline, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .getAirlineStatus(airline)
            .call(callback);
    }

    // Flights
    createFlight(airline, flightID, departure){
        let self = this;
        self.flightSuretyApp.methods
            .createFlight(flightID, departure)
            .send({ from: airline, gas: 3000000 });
    }

    getFlightCreated(airline, flightID, departure, callback){
        let self = this;
        self.flightSuretyApp.methods
            .getFlightCreated(airline, flightID, departure)
            .call(callback);
    }

    getFlightInfo(index, callback){
        let self = this;
        self.flightSuretyApp.methods
            .getFlightInfo(index)
            .call(callback);
    }

    // Insurance
    buyPolicy(flightKey, passenger) {
        let self = this;
        let amount = self.web3.utils.toWei('1', 'ether');
        self.flightSuretyApp.methods
            .buyInsurance(flightKey)
            .send({ from: passenger, value: amount, gas: 3000000 });
    }

    getPolicyStatus(flightKey, passenger, callback){
        let self = this;
        self.flightSuretyApp.methods
            .getInsuranceInfo(flightKey)
            .call({ from: passenger }, callback);
    }

    getBuyerBalance(passenger, callback){
        let self = this;
        self.flightSuretyApp.methods
            .getBuyerAccountBalance()
            .call({ from: passenger }, callback);
    }

    requestBalance(passenger) {
        let self = this;
        self.flightSuretyApp.methods
            .withdraw()
            .send({ from: passenger, gas: 3000000 });
    }

    fetchFlightStatus(airline, flightID, timestamp) {
        let self = this;
        self.flightSuretyApp.methods
            .fetchFlightStatus(airline, flightID, timestamp)
            .send({ from: airline });
        console.log("fetched");
    }

    // Startup Functions
    getFirstAirlineAddress() {
        let self = this;
        return self.firstAirline;
    }

    getPassengerAddress() {
        let self = this;
        return self.firstPassenger;
    }

    getContractAddresses() {
        let self = this;
        return {
            dataAddr: self.dataAddr,
            appAddr: self.appAddr
        }
    }
    
    getOwnerAddress() {
        let self = this;
        return self.owner;
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .operational()
            .call(callback);
    }

    getAirlineCount(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .getAirlineCount()
            .call(callback);        
    }

    async testFlights(owner, flightID, timestamp) {
      let self = this;
        // Create test flights
        await self.flightSuretyApp.methods
            .createFlight(flightID, timestamp)
            .send({ from: owner, gas: 3000000 }); 
        // Get flight info
        // self.flightSuretyApp.methods
        //     .getFlightInfo(i)
        //     .call(callback);                   
    }

    getFlightCount(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .getFlightCount()
            .call(callback);        
    }

    getAvailableFlights(i, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .getFlightInfo(i)
            .call(callback);
    }
}