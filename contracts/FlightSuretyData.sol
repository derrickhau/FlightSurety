    pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    
    address public contractOwner;
    bool public operational;
    uint public totalOutstandingPayouts = 0;
    uint payoutMultiplier;
    uint flightArrLimit;
    
    //authorizedCallers[contract] => bool
    mapping(address => bool) authorizedCallers;

    // Insurance
    // Tracks total balance for each passenger
    //buyerAccounts[passenger].balance/.buyerPolicies[flightKey].paid/.coverage
    mapping(address => Buyer) public buyerAccounts;
    struct Buyer {
        uint balance;
        // buyerPolicies[flightKey].paid/.coverage
        mapping(bytes32 => InsPolicy) buyerPolicies;
    }

    // Allows insurance to payout entire flight
    //policiesByFlight[flightKey][i].addr/.paid/... 
    mapping(bytes32 => InsPolicy[]) policiesByFlight;
    struct InsPolicy {
        address addr;
        uint paid;
        uint coverage;
        bool processed;
    }

    // Airlines
    //airlines[address].isRegistered/voteNonces[uint]/.candidates[address]
    mapping(address => Airline) airlines;
    struct Airline {
        bool isRegistered;
        bool isFunded;
        uint voteCount;
        // .voteNonces[voteNonce] => bool
        mapping(uint => bool) voteNonces;
        // .candidates[address] => bool
        mapping(address => bool) candidates;
    }

    uint public statusVoteCount = 0;
    uint public voteNonce = 0;
    uint public votingTimestamp;

    uint public votingRequirement = 4;
    uint public airlineConsensus = 3;
    uint public airlineCount = 0;
    uint public airlineConsensusMultiplier;
    uint public airlineRegFee;

    // Flights
    mapping(bytes32 => Flight) flights;
    struct Flight {
        uint flightID;
        bytes32 flightKey;
        address airline;
        uint timestamp;
        bool processed;
    }
    Flight[] public flightsArr;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    
    // Utility Events
    event OperatingStatusUpdated(bool newStatus);
    event PayoutUpdated(uint payoutMultiplier);
    event AirlineRegistrationUpdated(uint airlineConsensusMultiplier, uint airlineRegFee, uint flightArrLimit);
    event FlightArrayLimit (uint flightCount);
    event FlightArrayUpdated (uint newFlightCount, uint flightArrayLimit);

    // Smart Contract Events
    event newAuthorizedCaller(address newAuthCaller);
    event NewAirlineRegistered(bool success, uint voteCount, bool isRegistered, bool isFunded, address candidate, address airline);
    event NewAirlineVote(address candidate, bool isRegistered, uint voteCount, uint votesNeeded);
    event Funded(bool success, address airline, bool isRegistered, bool isFunded, uint valueSent, uint totalBalance);
    event FlightCreated(bytes32 flightKey, address airline, uint flightID, uint timestamp);
    event BuyCompleted(address passenger, uint amountPaid, uint amountInsured, bytes32 flightKey);
    event PayoutCompleted(address passenger, uint creditProcessed, uint passengerBalance, uint totalOutstandingPayouts, uint availableFunds);
    event WithdrawalCompleted(address passenger, uint payoutAmount);
    event PayoutsExceedFunds(uint totalOutstandingPayouts, uint availableFunds);

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    constructor() public {
        contractOwner = msg.sender;
        operational = true;

        authorizedCallers[address(this)] = true;
        authorizedCallers[contractOwner] = true;

        airlineRegFee = 10 ether;
        payoutMultiplier = 15;
        airlineConsensusMultiplier = 5; // airlineConsensus = airlineCount/2
        flightArrLimit = 100;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAuthorizedCaller() {
        require(authorizedCallers[msg.sender], "Caller not authorized");
        _;
    }

    modifier requireRegisteredAirline(address airline) {
        require(airlines[airline].isRegistered, "Must be registered airline");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    // GETTERS 
    function getAirlineStatus(address _airline) 
    external view requireIsOperational()
    returns(bool isRegistered, bool isFunded, uint voteCount, address airline)
    {
        return (airlines[_airline].isRegistered, airlines[_airline].isFunded,
            airlines[_airline].voteCount, _airline);
    }

    function getVoter(address candidate, address airline)
    external view requireIsOperational()
    returns (bool)
    {
        return airlines[airline].candidates[candidate];
    }

    function getFlightCreated(address _airline, uint _flightID, uint _timestamp)
    external view requireIsOperational()
    returns(address airline, uint flightID, 
            bytes32 flightKey, uint timestamp, bool processed)
    {
        bytes32 key = getFlightKey(_airline, _flightID, _timestamp);
        return (flights[key].airline, flights[key].flightID, flights[key].flightKey, 
        flights[key].timestamp, flights[key].processed);
    }

    function getFlightCreatedFromKey(bytes32 key) external view requireIsOperational()
    returns(address airlineAddress, uint flightID, bytes32 flightKey, 
            uint timestamp, bool processed)
    {
        return (flights[key].airline, flights[key].flightID, flights[key].flightKey, 
                flights[key].timestamp, flights[key].processed);
    }

    function getFlightKey(address airline, uint flightID, uint256 timestamp)
    public pure returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flightID, timestamp));
    }

    function getFlightInfo(uint index) external view
    returns(uint flightID, bytes32 flightKey, address airline, 
            uint timestamp, bool processed)
    {
        return (flightsArr[index].flightID, flightsArr[index].flightKey, 
                flightsArr[index].airline, flightsArr[index].timestamp, 
                flightsArr[index].processed);
    }

    function getFlightCount() external view returns(uint numberOfFlights) {
        return flightsArr.length;
    }

    function getInsuranceInfo(address passenger, bytes32 flightKey) 
    external view returns(uint paid, uint insAmount) {
        return (buyerAccounts[passenger].buyerPolicies[flightKey].paid, 
                buyerAccounts[passenger].buyerPolicies[flightKey].coverage);
    }

    function getContractBalance() external view 
    requireIsOperational() returns(uint)
    {
        return address(this).balance;
    }
    
    function getAccountBalance(address account) external view 
    requireIsOperational() returns(uint)
    {
        return account.balance;
    }

    function getBuyerAccountBalance(address passenger) external view 
    requireIsOperational() returns(uint)
    {
        return buyerAccounts[passenger].balance;
    }

    function isAuthorizedCaller(address caller) public view 
    requireIsOperational() returns (bool) 
    {
        return authorizedCallers[caller];
    }

    // SETTERS
    function setOperatingStatus(bool newStatus) external requireContractOwner() {
        operational = newStatus;
        emit OperatingStatusUpdated(newStatus);
    }  

    function operatingStatusVote(bool newStatus, address airline) external {
        // Only registered airlines may vote
        require(airlines[airline].isRegistered, 
            "Must be registered to register another airline");

        // Only unique voters
        require(!airlines[airline].voteNonces[voteNonce], 
            "Airline has already participated in this vote");

        // If voting time has expired, start new vote
        if(now.sub(votingTimestamp) > 1 days) {
            statusVoteCount = 0;
            voteNonce++;
        }

        // Record vote, voter, and reset timestamp
        statusVoteCount++;
        airlines[airline].voteNonces[voteNonce]= true;
        votingTimestamp = now;

        // Check vote and update status
        if(statusVoteCount > airlineConsensus) {
            operational = newStatus;
            emit OperatingStatusUpdated(newStatus);
        }
    }

    function setPayout(uint newMultiplier) 
    external requireContractOwner() requireIsOperational() 
    {
        payoutMultiplier = newMultiplier;
        emit PayoutUpdated(newMultiplier);
    }

    function setAirlineRegistration(uint newMultiplier, uint newFeeInEther, uint newFlightArrLimit)
    external requireContractOwner() requireIsOperational() 
    {
        airlineConsensusMultiplier = newMultiplier;
        airlineRegFee = newFeeInEther.mul(1000000000000000000);// Convert wei to ether
        flightArrLimit = newFlightArrLimit;
        emit AirlineRegistrationUpdated(newMultiplier, newFeeInEther, newFlightArrLimit);
    }

    // Utility 
    function contractKiller() external requireContractOwner() {
        selfdestruct(contractOwner);
    }

    function pruneFlightArray(uint newFlightCount) public requireContractOwner() {

        // Identify firstFlight as starting point
        uint firstFlight = flightsArr.length.sub(newFlightCount);

        // Create new flight array starting with firstFlight and later
        for(uint i = 0; i < newFlightCount; i++){
            flightsArr[i] = flightsArr[i + firstFlight];
        }

        // Delete remaining elements of flightsArr 
        flightsArr.length = newFlightCount;

        emit FlightArrayUpdated(newFlightCount, flightArrLimit);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
    
    function authorizeCaller(address newCaller) 
    external requireContractOwner() requireIsOperational() returns(bool) {
        emit newAuthorizedCaller(newCaller);
        return authorizedCallers[newCaller] = true;
    }

    function registerAirline(address candidate, address airline)
    external requireIsOperational() requireAuthorizedCaller()
    {
        // Only registered airlines or Contract Owner may register another airline
        require(airlines[airline].isRegistered || msg.sender == contractOwner, 
            "Must be registered to vote for a candidate");

        // Only unregisted airlines may be registered
        require(!airlines[candidate].isRegistered, 
            "This address is already registered");

        // Only unique voters
        require(!airlines[airline].candidates[candidate], 
            "Airline has already voted for this candidate");
        airlines[airline].candidates[candidate] = true;

        // Increment vote count
        airlines[candidate].voteCount += 1;
                
        // Check if over vote threshold or under consensus
        if(airlineCount <= votingRequirement || 
        airlines[candidate].voteCount >= airlineConsensus){
            
            // Register Airline
            airlines[candidate].isRegistered = true;
            airlineCount += 1;
            
            // Increase consensus to half airlineCount
            if(airlineCount >= 8) {
                airlineConsensus = airlineCount.mul(airlineConsensusMultiplier).div(10);
            }
            emit NewAirlineRegistered(true, airlines[candidate].voteCount, 
                airlines[candidate].isRegistered, airlines[candidate].isFunded, candidate, airline);

        // Airline not registered; vote is counted
        } else {            
            emit NewAirlineVote(candidate, false, 
                airlines[candidate].voteCount, airlineConsensus);
        }
    }

    function fundAirline(address airline, uint valueSent) external 
    requireIsOperational() requireRegisteredAirline(airline)
    {
        // Only unfunded airlines
        require(!airlines[airline].isFunded, "This airline is already funded");
        
        // Fund airline
        airlines[airline].isFunded = true;
        
        emit Funded(true, airline, airlines[airline].isRegistered, 
            airlines[airline].isFunded, valueSent, address(this).balance);
    }

    function createFlight (address airline, uint flightID, uint timestamp)
    external requireIsOperational()
    {
        // Only funded airlines or Contract Owner may create flights
        require(airlines[airline].isFunded 
            || airline == contractOwner, 
                "Must be funded airline");

        // Generate flight key
        bytes32 key = getFlightKey(airline, flightID, timestamp);
        
        // Check for duplicate flight
        require(flights[key].flightKey != key, "Duplicate flight");

        // Update values of flight
        flights[key] = Flight({
            flightID: flightID,
            flightKey: key,
            airline: airline,
            timestamp: timestamp,
            processed: false
        });

        // Add flight to array of flights
        flightsArr.push(flights[key]);

        // Check number of flights in array; default is 100
        if(flightsArr.length > flightArrLimit){
            emit FlightArrayLimit (flightsArr.length);
        }

        emit FlightCreated(key, airline, flightID, timestamp);
    }

    function processFlightStatus(address airline, uint flightID, uint timestamp, uint statusCode)
     external requireIsOperational()
    {
        // Get flightKey
        bytes32 flightKey = getFlightKey(airline, flightID, timestamp);

        // Only unprocessed flight
        require(!flights[flightKey].processed, "Flight has already been processed");
        flights[flightKey].processed = true;

        // If late, payout insurance
        if(statusCode == 20) payoutInsurance(flightKey);
    }

    function buyInsurance(bytes32 flightKey, address passenger, uint amount)
    external payable requireIsOperational() requireAuthorizedCaller()
    {
        // Update values of policy
        InsPolicy memory ins;
        ins.addr = passenger;
        ins.paid = amount;
        ins.coverage = (amount.mul(payoutMultiplier)).div(10);// Initial coverage is 1.5x

        // Add policy to flight array
        policiesByFlight[flightKey].push(ins);

        // Add policy to Buyer's account
        buyerAccounts[passenger].buyerPolicies[flightKey].addr = ins.addr;
        buyerAccounts[passenger].buyerPolicies[flightKey].paid = ins.paid;
        buyerAccounts[passenger].buyerPolicies[flightKey].coverage = ins.coverage;
        
        emit BuyCompleted(passenger, amount, ins.coverage, flightKey);
    }

    function payoutInsurance(bytes32 flightKey) internal requireIsOperational() {
        // Loop through each policy on the flight
        for(uint i=0; i<policiesByFlight[flightKey].length; i++) {
            InsPolicy memory policy =  policiesByFlight[flightKey][i];

            // Verify policy has not been processed
            require(!policy.processed == true, "This policy has already been processed");
            policiesByFlight[flightKey][i].processed = true;

            // Verify policy has coverage
            require(policy.coverage > 0, "This policy has no coverage");

            // Store coverage in new variable and set storage variable to zero
            uint amount = policy.coverage;
            policiesByFlight[flightKey][i].coverage = 0;

            // Get address of passenger
            address passenger = policy.addr;

            // Add amount to buyer's balance
            buyerAccounts[passenger].balance = buyerAccounts[passenger].balance.add(amount);
            
            // Add amount to total payments owed
            totalOutstandingPayouts = totalOutstandingPayouts.add(amount);
            emit PayoutCompleted(passenger, amount, buyerAccounts[passenger].balance, totalOutstandingPayouts, address(this).balance);
        }

        // Check if total payments owed exceeds current balance
        if(totalOutstandingPayouts > address(this).balance){
            emit PayoutsExceedFunds(totalOutstandingPayouts, address(this).balance);
        }
    }

    function withdraw(address passenger) external requireIsOperational() {
        
        // Verify available funds in passenger account
        uint passengerBalance = buyerAccounts[passenger].balance;
        require(passengerBalance > 0, "No credit available");
        
        // Verify available funds in Contract account
        require(address(this).balance >= passengerBalance, "Funds not available at this time");

        // Set balance to zero
        buyerAccounts[passenger].balance = 0;

        // Update outstanding payouts
        totalOutstandingPayouts = totalOutstandingPayouts.sub(passengerBalance);
        
        // Withdraw balance
        passenger.transfer(passengerBalance);
        emit WithdrawalCompleted(passenger, passengerBalance);
    }

    function() external payable {}
}