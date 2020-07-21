pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */

contract FlightSuretyApp {

    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    
    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    // Contract
    address public contractOwner;
    address public dataContractAddress;
    bool public operational;
    FlightSuretyData flightSuretyData;

    event OperatingStatusUpdated(bool newStatus);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/
    
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");  
        _;
    }

    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }
  
    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    constructor(address _dataContract) public {
        contractOwner = msg.sender;
        operational = true;
        flightSuretyData = FlightSuretyData(_dataContract);
        dataContractAddress = _dataContract;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function getAirlineCount() external view requireIsOperational() returns(uint) {
        return flightSuretyData.airlineCount();
    }

    function getAirlineRegFee() public view requireIsOperational()
    returns(uint)
    {
        return flightSuretyData.airlineRegFee();
    }

    function getAirlineStatus(address _airline) external view requireIsOperational()
    returns(bool isRegistered, bool isFunded, uint voteCount, address airline)
    {
        return flightSuretyData.getAirlineStatus(_airline);
    }

    function getFlightCreated(address _airline, uint _flightID, uint _timestamp)
    external view requireIsOperational()
    returns(address airline, uint flightID, bytes32 flightKey, 
            uint timestamp, bool processed)
    {
        return flightSuretyData.getFlightCreated(_airline, _flightID, _timestamp);
    }

    function getFlightCreatedFromKey(bytes32 _flightKey) external view requireIsOperational()
    returns(address airline, uint flightID, bytes32 flightKey, 
            uint timestamp, bool processed)
    {
        return flightSuretyData.getFlightCreatedFromKey(_flightKey);
    }    

    function getFlightInfo(uint index) external view requireIsOperational()
    returns(uint flightID, bytes32 flightKey, address airline, 
            uint timestamp, bool processed)
    {
        return flightSuretyData.getFlightInfo(index);
    }

    function getFlightKey(address _airline, uint _flightID, uint256 _timestamp)
    pure public returns(bytes32) 
    {
        return keccak256(abi.encodePacked(_airline, _flightID, _timestamp));
    }

    function getFlightCount() view external requireIsOperational() returns(uint numberOfFlights) {
        return flightSuretyData.getFlightCount();
    }

    function getVoter(address candidate, address airline)
    external view requireIsOperational() returns(bool)
    {
        return flightSuretyData.getVoter(candidate, airline);
    }

    function getInsuranceInfo(bytes32 flightKey) 
    external view returns(uint paid, uint insAmount) {

        return flightSuretyData.getInsuranceInfo(msg.sender, flightKey);
    }

    function getDataContractOwner() external view requireIsOperational() returns (address) {
        return flightSuretyData.contractOwner();
    }
    
    function isAuthorizedCaller(address caller) public view requireIsOperational() returns (bool) {
        return flightSuretyData.isAuthorizedCaller(caller);
    }

    function setOperatingStatus(bool newStatus) external requireContractOwner() {
        operational = newStatus;
        emit OperatingStatusUpdated(newStatus);
    }

    function contractKiller() external requireContractOwner() {
        selfdestruct(contractOwner);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/  
    
    function registerAirline(address candidate) external requireIsOperational()
    {
        flightSuretyData.registerAirline(candidate, msg.sender);
    }

    function fundAirline() external payable requireIsOperational()
    {
        // Get airline registration fee
        uint airlineRegFee = flightSuretyData.airlineRegFee();

        // Ensure sufficient funds sent
        require(msg.value >= airlineRegFee, "Insufficient funds sent from contract");

        // Transfer ether to Data contract
        dataContractAddress.transfer(msg.value);

        flightSuretyData.fundAirline(msg.sender, msg.value);
    }

    function createFlight(uint flightID, uint timestamp)
    external requireIsOperational()
    {
        flightSuretyData.createFlight(msg.sender, flightID, timestamp);
    }

    function buyInsurance(bytes32 flightKey) 
    external payable requireIsOperational()
    {
        // Ensure funds were sent and don't exceed 1 ether max
        require(msg.value > 0 && msg.value <= 1 ether, "Must send payment, 1 ether max");

        // Transfer ether to Data contract
        dataContractAddress.transfer(msg.value);

        flightSuretyData.buyInsurance(flightKey, msg.sender, msg.value);
    }

    function getBuyerAccountBalance() external view 
    requireIsOperational() returns(uint)
    {
        return flightSuretyData.getBuyerAccountBalance(msg.sender);
    }

    function withdraw() external requireIsOperational() {
        flightSuretyData.withdraw(msg.sender);
    }

// region ORACLE MANAGEMENT
    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all oracle responses
    // Key = hash(index, airline, flight, timestamp)
    // oracleResponses[key].requester/.isOpen/.responses[STATUS_CODE] => array of oracle addresses
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                      // Account that requested status
        bool isOpen;                            // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;  // Mapping key is the status code reported
        // This lets us group responses and identify the response that majority of the oracles
    }

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, uint flightID, uint256 timestamp, uint8 status);
    event OracleReport(address airline, uint flightID, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, uint flightID, uint256 timestamp);

    // Oracle testing Functions
    function isRegisteredOracle(address _address) public view requireIsOperational() returns (bool) {
        return oracles[_address].isRegistered;
    }

    function getMyIndexes() view external returns(uint8[3]) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }
    
    // Oracle setup
    function registerOracle() external payable {
        // Verify registration fee was sent
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                isRegistered: true,
                                indexes: indexes
                            });
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }
        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;
        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);
        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }
        return random;
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, uint flightID, uint256 timestamp)
    external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flightID, timestamp));
        oracleResponses[key] = ResponseInfo
            ({
                requester: msg.sender,
                isOpen: true
            });

        emit OracleRequest(index, airline, flightID, timestamp);
    } 

    // Called in response to OracleRequest event
    function submitOracleResponse
    (uint8 index, address airline, uint flightID, uint256 timestamp, uint8 statusCode)
    external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");
        bytes32 key = keccak256(abi.encodePacked(index, airline, flightID, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flightID, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flightID, timestamp, statusCode);

            // Update flight status and payout insurance if late
            flightSuretyData.processFlightStatus(airline, flightID, timestamp, statusCode);
        }
    }
}

contract FlightSuretyData {
    // Getters
    function airlineCount() external view returns(uint);
    function airlineRegFee() external view returns(uint);
    function contractOwner() external view returns (address);
    function getFlightCount() view external returns(uint numberOfFlights);
    function isAuthorizedCaller(address caller) external view returns (bool);
    function getAirlineStatus(address _airline) external view
        returns(bool isRegistered, bool isFunded, uint voteCount, address airline);
    function getFlightCreatedFromKey(bytes32 _flightKey) external view
        returns(address airline, uint flightID, bytes32 flightKey,
                uint timestamp, bool processed);
    function getFlightCreated(address _airline, uint _flightID, uint _timestamp)
        external view
        returns(address airline, uint flightID, bytes32 flightKey, 
                uint timestamp, bool processed);
    function getVoter(address candidate, address airline) external view returns(bool);
    function getInsuranceInfo(address passenger, bytes32 flightKey) 
        external view returns(uint paid, uint insAmount);
    function getBuyerAccountBalance(address passenger) external view returns(uint);
    function getFlightInfo(uint index) external view
        returns(uint flightID, bytes32 flightKey, address airlineAddress, 
                uint timestamp, bool processed);

    // Smart Contract Functions
    function registerAirline(address candidate, address airline) external;
    function fundAirline(address airline, uint valueSent) external;
    function createFlight(address airline, uint flightID, uint timestamp) external;
    function processFlightStatus(address airline, uint flightID, uint timestamp, uint statusCode) external;
    function buyInsurance(bytes32 flightKey, address passenger, uint amount) external payable;
    function payoutInsurance(bytes32 flightKey) external;
    function withdraw(address passenger) external;
}