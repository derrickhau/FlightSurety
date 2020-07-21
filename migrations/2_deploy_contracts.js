const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = async (deployer) => {
    
    // Deploy data contract
    await deployer.deploy(FlightSuretyData);

    // Create instance of data contract
    let dataInstance = await FlightSuretyData.deployed();

    // Deploy App Contract
    await deployer.deploy(FlightSuretyApp, FlightSuretyData.address);
    // Authorize App Contract
    await dataInstance.authorizeCaller(FlightSuretyApp.address);

    // account[1] from Ganache-cli candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
    let firstAirline = "0x03e2eDCe4BB10110c3B75D14737100C0c34f7199";
    
    // Register firstAirline
    await dataInstance.registerAirline(firstAirline, FlightSuretyData.address);

    let config = {
        localhost: {
            url: 'http://localhost:8545',
            dataAddress: FlightSuretyData.address,
            appAddress: FlightSuretyApp.address
        }
    }
    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');

}