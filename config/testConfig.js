var FlightSuretyApp = artifacts.require("FlightSuretyApp");
var FlightSuretyData = artifacts.require("FlightSuretyData");
var BigNumber = require('bignumber.js');

var Config = async (accounts) => {

    let owner = accounts[0];
    let firstAirline = accounts[1];

    let flightSuretyData = await FlightSuretyData.new();
    let flightSuretyApp = await FlightSuretyApp.new(flightSuretyData.address);

    // Authorize app contract and owner
    await flightSuretyData.authorizeCaller(flightSuretyApp.address);
    await flightSuretyData.authorizeCaller(owner);
    
    // Register firstAirline
    await flightSuretyData.registerAirline(firstAirline, owner);
    
    return {
        owner: owner,
        firstAirline: firstAirline,
        flightSuretyData: flightSuretyData,
        flightSuretyApp: flightSuretyApp
    }
}

module.exports = {
    Config: Config
};