import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

(async() => {

    let result = null;

    let contract = new Contract('localhost', async() => {
        // Global variables
        let flightCount;
        let recentFlightKey;
        let owner;

        // Airline Functions
        DOM.elid('airline-register').addEventListener('click', () => {
            let airline = DOM.elid('airline-address').value;
            contract.registerAirline(airline);
            display("Airline Registered", '',
                '...check airline status',
                [ { label: '', value:  ''} ]);
        })

        DOM.elid('airline-fund').addEventListener('click', () => {
            let airline = DOM.elid('airline-address').value;
            contract.fundAirline(airline);
            display("Fund Airline",
                '...check airline status',
                [ { label: '', value:  ''} ]);
        })

        DOM.elid('airline-status').addEventListener('click', () => {
            let airline = DOM.elid('airline-address').value;
            contract.getAirlineStatus(airline, (error, result) => {
                display("Airline Status",
                    "Airline: " + result.airline,
                    [{ label: "Registered:", value: result.isRegistered },
                     { label: "Funded:", value: result.isFunded },
                     { label: "Votes:", value: result.voteCount }]);
            });
        })

        // Flights
        DOM.elid('flight-create').addEventListener('click', () => {
            let airline = DOM.elid('flight-address').value;
            let flightID = DOM.elid('flight-id').value;
            let timestamp = new Date(DOM.elid("flight-timestamp").value).valueOf() / 1000;
            contract.createFlight(airline, flightID, timestamp);
            display('Flight Created',
                '...check flight status',
                [ { label: '', value:  ''} ]);
        })

        DOM.elid('flight-status').addEventListener('click', () => {
            let airline = DOM.elid('flight-address').value;
            let flightID = DOM.elid('flight-id').value;
            let timestamp = new Date(DOM.elid("flight-timestamp").value).valueOf() / 1000;
            contract.getFlightCreated(airline, flightID, timestamp, (error, result) => {
                recentFlightKey = result.flightKey;
                display("Flight Info",
                    "Airline: " + result.airline,
                    [{ label: "Flight ID:", value: result.flightID },
                     { label: "Departure:", value: result.timestamp },
                     { label: "Flight Key:", value: result.flightKey },
                     { label: "Processed:", value: result.processed }]);
            });
        })

        DOM.elid('flight-process').addEventListener('click', () => {
            let airlineAddress = DOM.elid('flight-address').value;
            let flightID = DOM.elid('flight-id').value;
            let timestamp = new Date(DOM.elid("flight-timestamp").value).valueOf() / 1000;
            contract.fetchFlightStatus(airlineAddress, flightID, timestamp);
            display('Flight processing requested',
                '...check flight status',
                [ { label: '', value:  ''} ]);
        })        

        // Insurance
        DOM.elid('insurance-buy').addEventListener('click', () => {
            let eth = DOM.elid('insurance-amount-ether').value;
            let passenger = DOM.elid('insurance-buyer-address').value;
            let formFlightKey = DOM.elid('insurance-flightKey').value;
            let flightKey = formFlightKey || recentFlightKey;
            contract.buyPolicy(flightKey, passenger);
            display('Policy Issued',
                '...check policy status',
                [ { label: '', value:  ''} ]);
        })

        DOM.elid('insurance-status').addEventListener('click', () => {
            let formFlightKey = DOM.elid('insurance-flightKey').value;
            let flightKey = formFlightKey || recentFlightKey;
            let passenger = DOM.elid('insurance-buyer-address').value;
            contract.getPolicyStatus(flightKey, passenger, (error, result) => {
                display("Policy Status",
                    "Passenger: " + passenger,
                    [{ label: "Paid:", value: result.paid },
                     { label: "Coverage:", value: result.insAmount },
                     { label: "Flight Key:", value: flightKey }]);
            });
        })

        DOM.elid('insurance-credit').addEventListener('click', () => {
            let passenger = DOM.elid('insurance-buyer-address').value;
            contract.getBuyerBalance(passenger, (error, result) => {
                display("Credit: " + result, '',
                    [{ label: "Passenger:", value: passenger }]);
            })
        })

        DOM.elid('insurance-withdraw').addEventListener('click', () => {
            let passenger = DOM.elid('insurance-buyer-address').value;
            contract.requestBalance(buyer);
            display('Withdrawal Issued',
                "...check buyer info" ,
                [ { label: '', value:  ''} ]);
        })

        DOM.elid('insurance-account-balance').addEventListener('click', () => {
            let passenger = DOM.elid('insurance-buyer-address').value;
            contract.getBalance(passenger, (error, result) => {
                display("Balance: " + result, '', 
                    [{ label: "Passenger:", value:passenger }]);
            });
        })        

        // Startup functions
        let contractInfo = contract.getContractAddresses();
        console.log("Data contract:",contractInfo.dataAddr);
        console.log("App contract:",contractInfo.appAddr);

        contract.isOperational((error, result) => {
            console.log("isOperational:",result);
        });

        let firstAirline = contract.getFirstAirlineAddress();
        console.log("firstAirline address:", firstAirline);

        let passengerAddress = contract.getPassengerAddress();
        console.log("firstPassenger address:", passengerAddress);

        owner = await contract.getOwnerAddress();
        console.log("Owner:", owner);

        contract.getAirlineCount((error, result) => {
            console.log("Airline Count:", result);
        });
        
        await contract.getFlightCount(async(error, result) => {
            flightCount = result;
            console.log("Flight Count:", flightCount);

            for(let i=0; i<flightCount; i++) {
                await contract.getFlightInfo(i, (error, result) => {
                    console.log(`Flight ${i+1}: ${result.flightID}`);
                    display(`Flight ${i+1}`,
                        `Flight ID: ${result.flightID}
                         | Departure: ${result.timestamp}
                         | Processed: ${result.processed}`,
                        [{ label: 'Airline:',value: result.airline },
                         { label: 'Flight Key:',value: result.flightKey }]);
                });
            }
        });
    });
})();

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-2 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-4 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}