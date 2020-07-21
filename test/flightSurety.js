const Test = require('../config/testConfig.js');
const truffleAssert = require('truffle-assertions');
const chai = require("chai");
const BigNumber = require('bignumber.js');
const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

contract('Flight Surety Tests', async(accounts) => {
  var config;

  beforeEach('Deploy fresh instance of contracts and accounts', async() => {
    config = await Test.Config(accounts);
  });

  afterEach('Remove contracts', () => {
    config.flightSuretyData.contractKiller({ from: config.owner });
    config.flightSuretyApp.contractKiller({ from: config.owner });
  });

  /****************************************************************************************/
  /* Utility Functions                                                              */
  /****************************************************************************************/
  
  describe("Operational status is effective and secure", async() => {
    
    it('Initial operational value is true', async() => {
      
      // Ensure initial operational status is true
      let appStatus = await config.flightSuretyApp.operational();
      let dataStatus = await config.flightSuretyData.operational();

      assert.equal(appStatus, true, "Incorrect initial operating status value for App Contract");
      assert.equal(dataStatus, true, "Incorrect initial operating status value for Data Contract");
    });

    it('App and Data Contract Owners can access setOperatingStatus()', async() => {
      let dataOwner = config.owner;
      let appOwner;
      let newStatus = false;
      let accessDenied = false;

      // Get App Contract Owner
      appOwner = await config.flightSuretyApp.contractOwner();

      // Ensure both Contract Owners can change operating status
      try {
        let appStatusEvent = await config.flightSuretyApp.setOperatingStatus(newStatus, {from: appOwner});
        let dataStatusEvent = await config.flightSuretyData.setOperatingStatus(newStatus, {from: dataOwner});
        
        // Verify App OperatingStatusUpdated event
        truffleAssert.eventEmitted(appStatusEvent, 'OperatingStatusUpdated', (ev) => {
          return  ev.newStatus == newStatus;
        });

        // Verify Data OperatingStatusUpdated event
        truffleAssert.eventEmitted(dataStatusEvent, 'OperatingStatusUpdated', (ev) => {
          return  ev.newStatus == newStatus;
        });

      } catch(e) {
        // Will trigger if either Owner fails to update status
        accessDenied = true;
      }

      // Check operational status      
      appStatus = await config.flightSuretyApp.operational();
      dataStatus = await config.flightSuretyData.operational();

      assert.equal(accessDenied, false, "Access denied to either Contract Owner");
      assert.equal(appStatus, false, "App Contract Owner cannot change operating status");
      assert.equal(dataStatus, false, "Data Contract Owner cannot change operating status");
    });

    it('(newAirline) cannot access setOperatingStatus()', async() => {
      let newAirline = accounts[2];
      let accessDenied = false;

      // Attempt to set operational status to false from Account1
      try {
        await config.flightSuretyData.setOperatingStatus(false, {from: newAirline});
      } catch(e) {
        accessDenied = true;
      }

      // Check operational status
      status = await config.flightSuretyData.operational();

      assert.equal(accessDenied, true, "Access not restricted to Data Contract Owner");
      assert.equal(status, true, "(newAirline) is able to change operating status");
    });

    it('Contract owner can block access to functions using requireIsOperational()', async() => {
      let owner = config.owner;
      let accessDenied = false;
      let accessGranted = false;
      
      // Check access to getContractBalance
      try {
        await config.flightSuretyData.getContractBalance();
        accessGranted = true;
      } catch(e) {
        accessDenied = true;
      }

      assert.equal(accessGranted, true, "Access not blocked for getContractBalance()");      
      assert.equal(accessDenied, false, "Access not blocked for getContractBalance()");      

      // Reset access variables to false
      accessDenied = false;
      accessGranted = false;

      // Set operational status to false
      await config.flightSuretyData.setOperatingStatus(false, {from: owner});

      // Check operational status
      let status = await config.flightSuretyData.operational();
      assert.equal(status, false, "Operational status should be false");

      // Check access to getContractBalance again      
      try {
        await config.flightSuretyData.getContractBalance();
        let accessGranted = true;
      } catch(e) {
        accessDenied = true;
      }
      assert.equal(accessGranted, false, "Access not blocked for getContractBalance()");      
      assert.equal(accessDenied, true, "Access not blocked for getContractBalance()");      
    });
  });

  describe("Test remaining Utility functions - setPayout, setAirlineRegistration, contractKiller", async() => {
    
    it('setPayout() updates successfully', async() => {
      let owner = config.owner;
      let multiplier = 25;
      let accessDenied = false;

      // Attempt to set Airline Registration
      try {
        let payoutSet = await config.flightSuretyData.setPayout(multiplier, { from: owner });

        // Verify ContractKilled event
        truffleAssert.eventEmitted(payoutSet, 'PayoutUpdated', (ev) => {
          return  ev.payoutMultiplier == multiplier;
        });

      } catch(e) {
        accessDenied = true;
      }
      // Ensure access was not denied
      assert.equal(accessDenied, false, "Access blocked to Contract Owner");    });  

    it('setAirlineRegistration() updates successfully', async() => {
      let owner = config.owner;
      let multiplier = 10;
      let fee = 5;
      let flightArrLimit = 200;
      let accessDenied = false;

      // Attempt to set Airline Registration
      try {
        let regSetEvent = await config.flightSuretyData.setAirlineRegistration(multiplier, fee, flightArrLimit, { from: owner });

        // Verify AirlineRegistrationUpdated event
        truffleAssert.eventEmitted(regSetEvent, 'AirlineRegistrationUpdated', (ev) => {

          return  ev.airlineConsensusMultiplier == multiplier &&
                  ev.airlineRegFee == fee &&
                  ev.flightArrLimit == flightArrLimit;
        });
      } catch(e) {
        accessDenied = true;
      }

      // Ensure access was not denied
      assert.equal(accessDenied, false, "Access blocked to Data Contract Owner");
    });

    it('contractKiller() allows access to Contract Owner', async() => {
      let appOwner;
      let dataOwner = config.owner;
      let accessDenied = false;

      // Get App Contract Owner
      appOwner = await config.flightSuretyApp.contractOwner();

      // Attempt to kill contract      
      try {
        await config.flightSuretyApp.contractKiller({ from: appOwner });
        await config.flightSuretyData.contractKiller({ from: dataOwner });
      } catch(e) {
        accessDenied = true;
      }
      // Ensure access was not denied
      assert.equal(accessDenied, false, "Access blocked to Contract Owner");
    });
  });

  /****************************************************************************************/
  /* Smart Contract Functions                                                              */
  /****************************************************************************************/

  describe("Airlines can be authorized, registered, and funded successfully", async() =>{

    it('(App Contract) is authorized on deployment', async() => {      
      let app = config.flightSuretyApp.address;

      // Verify App Contract is authorized
      let authApp = await config.flightSuretyApp.isAuthorizedCaller(app); 
      assert.equal(authApp, true, "(App Contract) should already be authorized");
    });

    it('(newAirline) cannot authorize itself', async() => {
      let newAirline = accounts[2];
      let accessDenied = false;

      // Check if newAirline is already authorized
      let authorized = await config.flightSuretyApp.isAuthorizedCaller(newAirline);
      assert.equal(authorized, false, "(newAirline) is already authorized");
      
      // Attempt to self-authorize newAirline    
      try {
        await config.flightSuretyData.authorizeCaller(newAirline, {from: newAirline});
   
      } catch(e) {
        accessDenied = true;        
      }

      // Ensure access to authorizeCaller was denied to Account1
      assert.equal(accessDenied, true, "authorizeCaller restricted to contract owner");
    });

    it('(newAirline) can be authorized by Data Contract Owner', async() => {
      let newAirline = accounts[2];
      let dataOwner = config.owner;
      let accessGranted = false;
      let isAuthorized = await config.flightSuretyApp.isAuthorizedCaller(newAirline);

      // Ensure Account1 is not authorized
      assert.equal(isAuthorized, false, "(newAirline) should not already be authorized");

      // Authorize Account1 from Data Contract Owner
      try {
        let newAuthCallerEvent = await config.flightSuretyData.authorizeCaller(newAirline, {from: dataOwner});
        
        // Verify newAuthorizedCaller event
        truffleAssert.eventEmitted(newAuthCallerEvent, 'newAuthorizedCaller', (ev) => {
          return  ev.newAuthCaller == newAirline;
        });
      } catch(e) {
        console.log(e);
      }

      // Ensure newAirline is  authorized
      accessGranted = await config.flightSuretyApp.isAuthorizedCaller(newAirline);
      assert.equal(accessGranted, true, "(newAirline) should be successfully authorized");
    });

    it('(firstAirline) is registered on deployment', async() => {      
      let firstAirline = config.firstAirline;

      // Verify App Contract is registered
      let regApp = await config.flightSuretyApp.getAirlineStatus(firstAirline); 
      assert.equal(regApp.isRegistered, true, "(firstAirline) should already be registered");
    });

    it('(newAirline1) is not registered and cannot register newAirline2', async() => {
      let newAirline1 = accounts[2];
      let newAirline2 = accounts[3];
      let regFailed = false;

      // Ensure newAirline2 is not initially registered
      let regFirst = await config.flightSuretyApp.getAirlineStatus(newAirline2);
      assert.equal(regFirst.isRegistered, false, "(newAirline2) should not already be registered");
      
      // Ensure newAirline1 is not initially registered
      let regNew = await config.flightSuretyApp.getAirlineStatus(newAirline1);
      assert.equal(regNew.isRegistered, false, "(newAirline1) should not already be registered");

      // Attempt to register newAirline from newAirline2
      try {
        await config.flightSuretyApp.registerAirline(newAirline1, {from: newAirline2});
      } catch(e) {
        regFailed = true
      }

      // Ensure newAirline1 is still not registered
      regNew = await config.flightSuretyApp.getAirlineStatus(newAirline1);
      assert.equal(regNew.isRegistered, false, "(newAirline1) should still not be registered");
      assert.equal(regFailed, true, "Registration should result in failure");
    });

    it('(newAirline) can be registered by a registered airline', async() => {      
      let newAirline = accounts[2];
      let firstAirline = config.firstAirline;
      let contractOwner = config.owner;

      // Ensure newAirline is not initially registered
      let regNew = await config.flightSuretyApp.getAirlineStatus(newAirline);
      assert.equal(regNew.isRegistered, false, "(newAirline) should not already be registered");      

      // Ensure firstAirline is an registered airline
      let regFirst = await config.flightSuretyApp.getAirlineStatus(firstAirline);
      assert.equal(regFirst.isRegistered, true, "(firstAirline) should already be registered");      

      // Attempt to register newAirline directly to Data Contract to test event
      try {
        let regEvent = await config.flightSuretyData.registerAirline(newAirline, firstAirline, { from: contractOwner });

        // Verify NewAirlineRegistered event
        truffleAssert.eventEmitted(regEvent, 'NewAirlineRegistered', (ev) => {
          return  ev.success == true &&
                  ev.voteCount == 1 &&
                  ev.isRegistered == true &&
                  ev.isFunded == false &&
                  ev.candidate == newAirline &&
                  ev.airline == firstAirline;
        });
      } catch(e) {
          console.log(e);
      }

      // Ensure newAirline is now registered
      regNew = await config.flightSuretyApp.getAirlineStatus(newAirline); 
      assert.equal(regNew.isRegistered, true, "(newAirline) failed to register");
    });

    it('(newAirline) can be registered after three votes', async() => {
      let newAirline = accounts[6];
      let firstAirline = config.firstAirline;
      let contractOwner = config.owner;

      // Get voting requirement
      let voteReq = await config.flightSuretyData.votingRequirement();

      for(var i = 1; i <= voteReq; i++){
        // Register airlines to reach voting requirement
        await config.flightSuretyApp.registerAirline(accounts[i+1], {from: firstAirline});
        
        // Confirm airlines are registered
        let isReg = await config.flightSuretyApp.getAirlineStatus(accounts[i+1]);
        assert.equal(isReg.isRegistered, true, `airline ${i} was not successfully registered`);
      }

      // Confirm newAirline is not already registered
      let regPRE = await config.flightSuretyApp.getAirlineStatus(newAirline);
      assert.equal(regPRE.isRegistered, false, "newAirline is already registered");

      // FIRST VOTE: register newAirline directly to Data Contract to test event
      try {
        let voteEvent1 = await config.flightSuretyData.registerAirline(newAirline, accounts[2], { from: contractOwner });

        // Verify NewAirlineVote event
        truffleAssert.eventEmitted(voteEvent1, 'NewAirlineVote', async(ev) => {
          let airlineConsensus = await config.flightSuretyData.airlineConsensus();
          return  ev._address == newAirline;
                  ev.isRegistered == false &&
                  ev.voteCount == 1 &&
                  ev.votesNeeded == airlineConsensus;
        });
      } catch(e) {
        console.log(e);        
      }
      // Get voteCount, voter, and registration data from vote 1
      let regInfo1 = await config.flightSuretyApp.getAirlineStatus(newAirline);
      let voteAirline1 = await config.flightSuretyApp.getVoter(newAirline, accounts[2]);

      // SECOND VOTE: register newAirline to App Contract to test contract links
      try {
        let voteEvent2 = await config.flightSuretyApp.registerAirline(newAirline, {from: accounts[3]});
      } catch(e) {
        console.log(e);        
      }

      // Get voteCount, voter, and registration data from vote 2
      let regInfo2 = await config.flightSuretyApp.getAirlineStatus(newAirline);
      let voteAirline2 = await config.flightSuretyApp.getVoter(newAirline, accounts[3]);

      // THIRD VOTE: register newAirline directly to Data Contract to test event
      try {
        let voteEvent3 = await config.flightSuretyData.registerAirline(newAirline, accounts[4], { from: contractOwner });

        // Verify NewAirlineVote event
        truffleAssert.eventEmitted(voteEvent3, 'NewAirlineRegistered', (ev) => {
          return  ev.success == true;
                  ev.voteCount == 1 &&
                  ev.isRegistered == true &&
                  ev.isFunded == false &&
                  ev.regAddress == newAirline &&
                  ev.fromAddress == firstAirline;
        });
      } catch(e) {
        console.log(e);        
      }
      // Get voteCount, voter, and registration data from vote 3
      let regInfo3 = await config.flightSuretyApp.getAirlineStatus(newAirline);
      let voteAirline3 = await config.flightSuretyApp.getVoter(newAirline, accounts[4]);

      // Confirm vote count, voter, and no registration after first vote      
      assert.equal(regInfo1.voteCount, 1, "newAirline first vote didn't count");
      assert.equal(voteAirline1, true, "accounts[2] should be recorded as the voter");
      assert.equal(regInfo1.isRegistered, false, "newAirline registered after only 1 vote");

      // Confirm vote count, voter, and no registration after second vote      
      assert.equal(regInfo2.voteCount, 2, "newAirline second vote didn't count");
      assert.equal(voteAirline2, true, "accounts[3] should be recorded as the voter");
      assert.equal(regInfo2.isRegistered, false, "newAirline registered after only 2 votes");
      
      // Confirm vote count, voter, and registration after third vote      
      assert.equal(regInfo3.voteCount, 3, "newAirline third vote didn't count");
      assert.equal(voteAirline3, true, "accounts[4] should be recorded as the voter");
      assert.equal(regInfo3.isRegistered, true, "newAirline should have successfully registered after 3 votes");
    });

    it('(firstAirline) can successfully fund itself', async() => {
      let firstAirline = config.firstAirline;
      let contractOwner = config.owner;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Ensure firstAirline is not initially registered
      let fundFirst = await config.flightSuretyApp.getAirlineStatus(firstAirline); 
      assert.equal(fundFirst.isFunded, false, "(firstAirline) should not already be funded");

      // Attempt to fund firstAirline directly to Data Contract to test event
      try {
        let fundEvent = await config.flightSuretyData.fundAirline(firstAirline, regFee, { from: contractOwner });
        
        // Verify NewAirlineRegistered event
        truffleAssert.eventEmitted(fundEvent, 'Funded', async(ev) => {
          let accountBalance = await config.flightSuretyData.getContractBalance();
          return  ev.success == true;
                  ev._addr == firstAirline &&
                  ev.isRegistered == true &&
                  ev.isFunded == true &&
                  ev.valueSent == regFee &&
                  ev.totalBalance == accountBalance;
        });
      } catch(e) {
        console.log(e);        
      }
      // Ensure firstAirline is now funded
      fundFirst = await config.flightSuretyApp.getAirlineStatus(firstAirline); 
      assert.equal(fundFirst.isFunded, true, "(firstAirline) should be able to fund itself");
    });
  });

  describe("Flights can be created, processed successfully", async() => {

    it('Unfunded airline cannot create flight', async() => {
      let firstAirline = config.firstAirline;
      let flightID = 1234;
      let timestamp = 1234567890;
      let createFailed = false;

      try {
        await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});
      } catch(e) {
        createFailed = true;        
      }

      assert.equal(createFailed, true, "Funding requirement for createFlight failed");
    });

    it('New flight created successfully by funded airline', async() => {
      let firstAirline = config.firstAirline;
      let flightID = 1234;
      let timestamp = 1234567890;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee });

      // Verify firstAirline is funded
      let isFunded = await config.flightSuretyApp.getAirlineStatus(firstAirline);
      assert.equal(isFunded.isFunded, true, "(firstAirline) did not successfully fund");

      // Attempt to create flight directly from Data Contract to test event
      try {
        let createFlightEvent = await config.flightSuretyData.createFlight(firstAirline, flightID, timestamp);
        
        // Verify FlightCreated event
        truffleAssert.eventEmitted(createFlightEvent, 'FlightCreated', async(ev) => {
          let flightKey = await config.flightSuretyData.getFlightKey(firstAirline, flightID, timestamp);
          return  ev.flightKey == flightKey;
                  ev.airline == firstAirline &&
                  ev.flightID == flightID &&
                  ev.timestamp == timestamp;
        });
      } catch(e) {
        console.log(e);        
      }

      let flightInfo = await config.flightSuretyApp.getFlightCreated(firstAirline, flightID, timestamp);

      // Ensure flight was created with correct values
      assert.equal(flightInfo.flightID.toNumber(), flightID, "flightID did not successfully update");
      assert.equal(flightInfo.airline, firstAirline, "airlineAddress did not successfully update");
      assert.equal(flightInfo.timestamp, timestamp, "timestamp did not successfully update");
    });

    it('Duplicate flights are prevented', async() => {
      let firstAirline = config.firstAirline;
      let flightID = 1234;
      let timestamp = 1234567890;
      let accessDenied = false;
      let accessGranted = false;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});

      // Create flight
        await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});

      // Attempt to create duplicate flight
      try {
        await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});
        accessGranted = true;
      } catch(e) {
        accessDenied = true;        
      }
      assert.equal(accessGranted, false, "Access not blocked for duplicate flight");      
      assert.equal(accessDenied, true, "Access not blocked for duplicate flight");      
    });

    it('Create 30 flights successfully', async() => {
      let firstAirline = config.firstAirline;
      let flightsCreated = 30;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});

      // Create flights      
      for(var i=1; i<=flightsCreated; i++){
        let flightID = 100 + i;
        let timestamp = 1000000000 + (i*1000);
        
        await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});
      }

      // Get number of flights
      let flightCount = await config.flightSuretyApp.getFlightCount();
       
      // Get all available flights
      for(var i=1; i<=flightCount; i++){
        let flightID = 100 + i;
        let timestamp = 1000000000 + (i*1000);

        let flightInfo = await config.flightSuretyApp.getFlightInfo(i-1);
        let flightKey = await config.flightSuretyApp.getFlightKey(firstAirline, flightID, timestamp);
        
        // Verify correct flight info
        assert.equal(flightInfo.flightID.toNumber(), flightID, "Incorrect flightID for flight" + i);
        assert.equal(flightInfo.flightKey, flightKey, "Incorrect flightKey for flight" + i);
        assert.equal(flightInfo.airline, firstAirline, "Incorrect airline for flight" + i);
        assert.equal(flightInfo.timestamp, timestamp, "Incorrect timestamp for flight" + i);
      }
    });

    it('Change flightArrLimit to 30 and verify FlightArrayLimit event is emitted', async() => {
      let firstAirline = config.firstAirline;
      let airlineConsensusMultiplier = 5;
      let airlineRegFee = 10;
      let flightArrLimit = 30;

      // Verify initial flight count of 0
      let flightCountPre = await config.flightSuretyData.getFlightCount();
      assert.equal(flightCountPre.toNumber(), 0, "Initial flight count is not 0");

      // Set flightArrLimit, keep other values contant
      await config.flightSuretyData.setAirlineRegistration(airlineConsensusMultiplier, airlineRegFee, flightArrLimit);

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});

      // Create flights
      for(var i=1; i<=flightArrLimit; i++){
        let flightID = 100 + i;
        let timestamp = 1000000000 + (i*1000);
        await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});
      }

      // Attempt to create additional flight from Data Contract to test event
      try {
        let flightLimitEvent = await config.flightSuretyData.createFlight(firstAirline, 747, 1234567890);

        // Verify FlightArrayLimit event emitted
        truffleAssert.eventEmitted(flightLimitEvent, 'FlightArrayLimit', async(ev) => {
          let flightCount = await config.flightSuretyData.getFlightCount();
          return  ev.flightCount == flightCount;
        });
      } catch(e) {
        console.log(e);        
      }

      // Verify flight count
      let flightCountPost = await config.flightSuretyData.getFlightCount();
      assert.equal(flightCountPost.toNumber(), flightArrLimit + 1,`Flight count did not reach ${flightArrLimit + 1}`);
    });

    it('Prune flight array to 200 when limit of 300 is exceeded', async() => {
      let owner = config.owner;
      let firstAirline = config.firstAirline;
      let airlineConsensusMultiplier = 5;
      let airlineRegFee = 10;
      let flightArrLimit = 300;
      let newFlightCount = 200;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Change flightArrLimit, keep other values contant
      await config.flightSuretyData.setAirlineRegistration(airlineConsensusMultiplier, airlineRegFee, flightArrLimit);

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});

      // Create flights, one over flightArrLimit
      for(var i=1; i<=flightArrLimit + 1; i++){
        let flightID = 100 + i;
        let timestamp = 1000000000 + (i*1000);
        await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});
      }
      
      // Verify flight count
      let flightCountPre = await config.flightSuretyData.getFlightCount();
      assert.equal(flightCountPre.toNumber(), flightArrLimit+1, `Flight count did not reach ${flightArrLimit+1}`);

      // Attempt to prune flight arrray down to 200 and test event
      try {
        let FlightArrayUpdatedEvent = await config.flightSuretyData.pruneFlightArray(newFlightCount, { from: owner, gas: 300000000 });

        // Verify FlightArrayUpdated event emitted
        truffleAssert.eventEmitted(FlightArrayUpdatedEvent, 'FlightArrayUpdated', async(ev) => {
          return  ev.newFlightCount == newFlightCount &&
                  ev.flightArrayLimit == flightArrLimit;
        });
      } catch(e) {
        console.log(e);        
      }

      // Verify flight count is now newFlightCount
      let flightCountPost = await config.flightSuretyData.getFlightCount();
      assert.equal(flightCountPost.toNumber(), newFlightCount, `Flight count did not reduce to ${newFlightCount}`);
    });    
  });

  describe("Insurance can be bought, paid out, and withdrawn successfully", async() => {

    it('Passenger can buy insurance for created flight', async() => {
      let firstAirline = config.firstAirline;
      let passenger = accounts[2];
      let flightID = 1234;
      let timestamp = 1234567890;
      let insCost = web3.utils.toWei('1', 'ether');
      let insCoverage = (insCost * 15) / 10;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});
      
      // Create flight
      await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});

      // Get flight info
      let flightInfo = await config.flightSuretyApp.getFlightCreated(firstAirline, flightID, timestamp);
      
      // Attempt to buy flight insurance directly from Data Contract to test event
      try {
        let buyInsEvent = await config.flightSuretyData.buyInsurance(flightInfo.flightKey, passenger, insCost);
        
        // Verify BuyCompleted event
        truffleAssert.eventEmitted(buyInsEvent, 'BuyCompleted', (ev) => {
          return  ev.passenger == passenger &&
                  ev.amountPaid == insCost &&
                  ev.amountInsured == insCoverage &&
                  ev.flightKey == flightInfo.flightKey;
        });
      } catch(e) {
        console.log(e);        
      }

      // Verify insurance cost and amount
      let insuranceInfo = await config.flightSuretyApp.getInsuranceInfo(flightInfo.flightKey, { from: passenger });
      
      assert.equal(insuranceInfo.paid.toString(), insCost, "Insurance paid was not recorded successfully");
      assert.equal(insuranceInfo.insAmount.toString(), insCoverage, "Insurance amount was not calculated correctly");
    });

    it('Airline can payout insurance claim of passenger and transfer to buyer balance', async() => {
      let firstAirline = config.firstAirline;
      let passenger = accounts[2];
      let flightID = 1234;
      let timestamp = 1234567890;
      let statusCode = 20;
      let insCost = web3.utils.toWei('1', 'ether');
      let insCoverage = (insCost * 15) / 10;
      let buyerBalance;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});
      
      // Create flight
      await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});

      // Get flight info
      let flightInfo = await config.flightSuretyApp.getFlightCreated(firstAirline, flightID, timestamp);

      // Verify initial buyer balance is zero
      buyerBalance = await config.flightSuretyData.getBuyerAccountBalance(passenger);

      // Buy flight insurance
      await config.flightSuretyApp.buyInsurance(flightInfo.flightKey, { from: passenger, value: insCost });

      // Attempt to payout insurance claim from Data Contract to test event
      try {
        let payoutEvent = await config.flightSuretyData.processFlightStatus(firstAirline, flightID, timestamp, statusCode);
        
        // Verify PayoutCompleted event
        buyerBalance = await config.flightSuretyData.getBuyerAccountBalance(passenger);
        let outstandingPayouts = await config.flightSuretyData.totalOutstandingPayouts();
        let contractBalance = await config.flightSuretyData.getContractBalance();
        expectEvent(payoutEvent, 'PayoutCompleted', {
          passenger: passenger,
          creditProcessed: insCoverage.toString(),
          passengerBalance: buyerBalance,
          totalOutstandingPayouts: outstandingPayouts,
          availableFunds: contractBalance
        });        
      } catch(e) {
        console.log(e);        
      }
 
      // Verify payout was transferred to buyer balance
      buyerBalance = await config.flightSuretyData.getBuyerAccountBalance(passenger);
      assert.equal(buyerBalance, insCoverage, "Payout was not transfered to buyer balance correctly");
    });

    it('Passenger can withdraw funds following insurance payout', async() => {
      let firstAirline = config.firstAirline;
      let passenger = accounts[2];
      let flightID = 1234;
      let timestamp = 1234567890;
      let statusCode = 20;
      let insCost = web3.utils.toWei('1', 'ether');
      let insCoverage = (insCost * 15) / 10;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({from: firstAirline, value: regFee});
      
      // Create flight
      await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});

      // Get flight info
      let flightInfo = await config.flightSuretyApp.getFlightCreated(firstAirline, flightID, timestamp);

      // Buy flight insurance
      await config.flightSuretyApp.buyInsurance(flightInfo.flightKey, { from: passenger, value: insCost });

      // Process flight and payout insurance claim
      await config.flightSuretyData.processFlightStatus(firstAirline, flightID, timestamp, statusCode);

      // Verify initial buyer balance equals insCoverage
      let buyerBalPre = await config.flightSuretyData.getBuyerAccountBalance(passenger);
      assert.equal(buyerBalPre, insCoverage, "Incorrect buyerBalance");

      // Check initial passenger account balance
      let accountBalPre = await config.flightSuretyData.getAccountBalance(passenger);

      // Attempt to withdraw funds from Data Contract to test event
      try {
        let withdrawalEvent = await config.flightSuretyData.withdraw(passenger);  

        // Verify WithdrawalCompleted event
        truffleAssert.eventEmitted(withdrawalEvent, 'WithdrawalCompleted', (ev) => {
          return  ev.passenger == passenger &&
                  ev.payoutAmount == insCoverage;
        });
      } catch(e) {
        console.log(e);        
      }

      // Verify correct buyer balance
      let buyerBalPost = await config.flightSuretyData.getBuyerAccountBalance(passenger);
      assert.equal(buyerBalPost, 0, "Buyer Balance failed to update correctly following withdrawal");

      // Check passenger account balance after withdrawal
      let accountBalPost = await config.flightSuretyData.getAccountBalance(passenger);

      // Verify withdrawal matches insurance coverage
      let withdrawal = BN(accountBalPost.sub(accountBalPre));
      assert.equal(withdrawal.toString(), insCoverage.toString(), "Passenger account failed to withdraw correct amount");
    });

    it("PayoutsExceedFunds event emitted and when payouts exceed available funds", async() => {
      let firstAirline = config.firstAirline;
      let passengerCount = 21;
      let flightID = 1234;
      let timestamp = 1234567890;
      let statusCode = 20;
      let insCost = web3.utils.toWei('1', 'ether');
      let insCoverage = (insCost * 15) / 10;

      // Get registration fee
      let regFee = await config.flightSuretyApp.getAirlineRegFee();

      // Fund firstAirline
      await config.flightSuretyApp.fundAirline({ from: firstAirline, value: regFee });
      
      // Create flight
      await config.flightSuretyApp.createFlight(flightID, timestamp, {from: firstAirline});

      // Get flight info
      let flightInfo = await config.flightSuretyApp.getFlightCreated(firstAirline, flightID, timestamp);
      
      // Buy flight insurance for 21 passengers
      for(var i=1; i<=passengerCount; i++){
        let passenger = accounts[i+2];
        await config.flightSuretyApp.buyInsurance(flightInfo.flightKey, { from: passenger, value: insCost });
      }      

      // Attempt to payout insurance claim from Data Contract to test PayoutsExceedFunds Exevent
      try {
        let exceedFundsEvent = await config.flightSuretyData.processFlightStatus(firstAirline, flightID, timestamp, statusCode);
        
        // Verify PayoutCompleted event
        truffleAssert.eventEmitted(exceedFundsEvent, 'PayoutsExceedFunds', async(ev, i) => {
        let outstandingPayouts = await config.flightSuretyData.totalOutstandingPayouts();
        let contractBal = await config.flightSuretyData.getContractBalance();
          return  ev.totalOutstandingPayouts == outstandingPayouts &&
                  ev.availableFunds == contractBal;
        });
      } catch(e) {
        console.log(e);        
      }

      // Verify outstanding payouts exceeds contract balance
      let outstandingPayouts = await config.flightSuretyData.totalOutstandingPayouts();
      let contractBalance = await config.flightSuretyData.getContractBalance();
      let isGreaterThan = outstandingPayouts > contractBalance;
      // assert.isAbove wasn't working
      assert.equal(isGreaterThan, true, "Outstanding payouts does not exceed contract balance");
    });
  });
});