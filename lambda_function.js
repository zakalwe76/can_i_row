const Alexa = require('ask-sdk-core');
const https = require('https');

// Helper function to make HTTP requests
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(5000, () => {
            request.abort();
            reject(new Error('Request timeout'));
        });
    });
}

// Helper function to format date/time
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Europe/London'
    };
    return date.toLocaleDateString('en-GB', options);
}

// Main intent handler for rowing conditions
const RowingConditionsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'RowingConditionsIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.LaunchIntent');
    },
    async handle(handlerInput) {
        const apiUrl = 'https://environment.data.gov.uk/flood-monitoring/id/measures/2200TH-flow--Mean-15_min-m3_s';
        
        try {
            const apiResponse = await httpGet(apiUrl);
            
            // Check if we have the required data
            if (!apiResponse.items || !apiResponse.items[0] || !apiResponse.items[0].latestReading) {
                return handlerInput.responseBuilder
                    .speak("I'm having trouble getting data")
                    .getResponse();
            }
            
            const latestReading = apiResponse.items[0].latestReading;
            const value = parseFloat(latestReading.value);
            const dateTime = formatDateTime(latestReading.dateTime);
            
            let reply;
            
            // Determine reply based on flow rate
            if (value <= 50) {
                reply = `As of ${dateTime}, the current flow rate is ${value} cubic meters per second, there are no restrictions today`;
            } else if (value >= 51 && value <= 75) {
                reply = `As of ${dateTime}, the current flow rate is ${value} cubic meters per second, there are High Flow restrictions today. No novice coxes or steerpersons`;
            } else if (value >= 76 && value <= 100) {
                reply = `As of ${dateTime}, the current flow rate is ${value} cubic meters per second, there are Very High Flow restrictions today. No singles, doubles, or pairs today`;
            } else {
                reply = `As of ${dateTime}, the current flow rate is ${value} cubic meters per second, there is no rowing today, it's too dangerous.`;
            }
            
            return handlerInput.responseBuilder
                .speak(reply)
                .getResponse();
                
        } catch (error) {
            console.error('Error fetching data:', error);
            return handlerInput.responseBuilder
                .speak("I'm having trouble getting data")
                .getResponse();
        }
    }
};

// Launch request handler
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        // Redirect to the main rowing conditions handler
        return RowingConditionsIntentHandler.handle(handlerInput);
    }
};

// Help intent handler
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can ask me "Can I row today?" or "What is the current flow rate?" to check rowing conditions based on the current water flow rate.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Cancel and Stop intent handler
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Stay safe on the water!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

// Session ended request handler
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

// Error handler
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = "I'm having trouble getting data";
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Lambda handler
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        RowingConditionsIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
