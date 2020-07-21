const Test = require('../config/testConfig.js');
const truffleAssert = require('truffle-assertions');

contract('Oracles', async(accounts) => {
  var config;
  const TEST_ORACLES_COUNT = 20;

  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;

  before('setup contract', async() => {
    config = await Test.Config(accounts);
  });

  it('can register oracles', async() => {
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // Register Oracles starting with accounts[2]
    for(let a=1; a<=TEST_ORACLES_COUNT+1; a++) {      
      await config.flightSuretyApp.registerOracle({ from: accounts[a+1], value: fee });
      let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a+1] });

      // Verify Oracle is registered
      let oracleIsRegistered = await config.flightSuretyApp.isRegisteredOracle(accounts[a+1]);
      assert.equal(oracleIsRegistered, true, `Oracle ${a} didn't register properly`);
    }
  });

  it('firstAirline can request flight status', async() => {
    let firstAirline = config.firstAirline;
    let flightID = 1234;
    let timestamp = 1234567890;

    // Submit a request for oracles to get status information for a flight
    let flightStatusEvent = await config.flightSuretyApp.fetchFlightStatus(firstAirline, flightID, timestamp);

    // Verify OracleRequest event was emitted
    truffleAssert.eventEmitted(flightStatusEvent, 'OracleRequest', (ev) => {
      return  ev.airline == firstAirline && 
              ev.flightID == flightID && 
              ev.timestamp == timestamp;
    });
  });

  it('Oracles can submit response after index match and report after three index matches', async() => {
    let firstAirline = config.firstAirline;
    let flightID = 1234;
    let timestamp = 1234567890;
    let MIN_RESPONSES = 3;
    let indexMatches = 0;

    // Loop through Oracles
    for(let a=1; a<=TEST_ORACLES_COUNT; a++) {    

      // Get oracle indexes
      oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a+1]});
      console.log(`\nOracle: ${a} | ${oracleIndexes} ${accounts[a+1]}`);

      // Each Oracle submits 3 responses, 1 for each index
      for(let idx=0;idx<3;idx++) {
        try {

          // Only executed if there is an index match
          var oracleResponseEvent = await config.flightSuretyApp
            .submitOracleResponse(oracleIndexes[idx], firstAirline, flightID, 
                                  timestamp, STATUS_CODE_ON_TIME, 
                                  { from: accounts[a+1] });
          indexMatches++;

          // Verify OracleReport event was emitted after an index match
          truffleAssert.eventEmitted(oracleResponseEvent, 'OracleReport', (ev) => {
            return  ev.airline == firstAirline &&
                    ev.flightID == flightID &&
                    ev.timestamp == timestamp &&
                    ev.status == STATUS_CODE_ON_TIME;
          });

          // Verify FlightStatusInfo event was emitted after 3 index matches
          if(indexMatches >= MIN_RESPONSES){
            truffleAssert.eventEmitted(oracleResponseEvent, 'FlightStatusInfo', (ev) => {
              return  ev.airline == firstAirline &&
                      ev.flightID == flightID &&
                      ev.timestamp == timestamp &&
                      ev.status == STATUS_CODE_ON_TIME;
            });            
          }
        }
        catch(e) {
          // Enable this when debugging
          // console.log('Error', idx, oracleIndexes[idx].toNumber(), flightID, timestamp);
        }
      }
    }
  });
});