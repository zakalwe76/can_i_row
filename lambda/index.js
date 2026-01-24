const Alexa = require('ask-sdk-core');
const https = require('https');

// Cache object to store API responses
let cache = {
    data: null,
    timestamp: null
};

// Cache duration in milliseconds (15 minutes)
const CACHE_DURATION = 15 * 60 * 1000;

// Environment Agency API URL
const API_URL = 'https://environment.data.gov.uk/flood-monitoring/id/measures/2200TH-flow--Mean-15_min-m3_s';

/**
 * Helper function to make HTTPS requests
 */
function makeHttpsRequest(url) {
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
                    console.error('Error parsing JSON:', error);
                    reject(new Error('Failed to parse API response'));
                }
            });
        });
        
        request.on('error', (error) => {
            console.error('HTTPS request error:', error);
            reject(error);
        });
        
        request.setTimeout(10000, () => {
            console.error('Request timeout');
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Check if cache is valid (not empty and less than 15 minutes old)
 */
function isCacheValid() {
    if (!cache.data || !cache.timestamp) {
        console.log('Cache is empty');
        return false;
    }
    
    const now = Date.now();
    const cacheAge = now - cache.timestamp;
    const isValid = cacheAge < CACHE_DURATION;
    
    console.log(`Cache age: ${cacheAge}ms, Valid: ${isValid}`);
    return isValid;
}

/**
 * Get flow data from cache or API
 */
async function getFlowData() {
    try {
        // Check if cache is valid
        if (isCacheValid()) {
            console.log('Using cached data');
            return cache.data;
        }
        
        console.log('Cache invalid, fetching fresh data from API');
        
        // Fetch fresh data from API
        const apiResponse = await makeHttpsRequest(API_URL);
        
        // Extract the required fields
        if (!apiResponse.items || !apiResponse.items.latestReading) {
            throw new Error('Invalid API response structure');
        }
        
        const latestReading = apiResponse.items.latestReading;
        const flowData = {
            label: apiResponse.items.label || 'River Flow',
            dateTime: latestReading.dateTime,
            value: latestReading.value
        };
        
        // Cache the data
        cache.data = flowData;
        cache.timestamp = Date.now();
        
        console.log('Data cached successfully:', flowData);
        return flowData;
        
    } catch (error) {
        console.error('Error getting flow data:', error);
        throw error;
    }
}

/**
 * Generate reply based on flow value
 */
function generateReply(flowData) {
    const { dateTime, value } = flowData;
    const flowValue = parseFloat(value);
    
    // Format the date time for speech
    const date = new Date(dateTime);
    const formattedDateTime = date.toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'long',
        month: 'long',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let reply;
    
    if (flowValue <= 50) {
        reply = `As of ${formattedDateTime}, the current flow rate at Reading UK is ${flowValue} cubic meters per second, there are no restrictions today based on flow rate. There are factors other than flow rate that affect water safety. Please use you're best judgement and consult with your coach and squad vice captain before going on the water`;
    } else if (flowValue >= 51 && flowValue <= 75) {
        reply = `As of ${formattedDateTime}, the current flow rate at Reading UK is ${flowValue}, there are High Flow restrictions today. No novice coxes or steerpersons. There are factors other than flow rate that affect water safety. Please use you're best judgement and consult with your coach and squad vice captain before going on the water `;
    } else if (flowValue >= 76 && flowValue <= 100) {
        reply = `As of ${formattedDateTime}, the current flow rate at Reading UK is ${flowValue} cubic meters per second, there are Very High Flow restrictions today. No singles, doubles, or pairs today. There are factors other than flow rate that affect water safety. Please use you're best judgement and consult with your coach and squad vice captain before going on the water`;
    } else {
        reply = `As of ${formattedDateTime}, the current flow rate at Reading UK is ${flowValue} cubic meters per second, there is no rowing today, it's too dangerous. There are factors other than flow rate that affect water safety. Please use you're best judgement and consult with your coach and squad vice captain before going on the water`;
    }
    
    console.log('Generated reply:', reply);
    return reply;
}

/**
 * Main intent handler for rowing conditions
 */
const RowingConditionsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RowingConditionsIntent';
    },
    async handle(handlerInput) {
        console.log('RowingConditionsIntent handler called');
        
        let reply;
        
        try {
            const flowData = await getFlowData();
            reply = generateReply(flowData);
        } catch (error) {
            console.error('Error in RowingConditionsIntent:', error);
            reply = `I'm having trouble getting data. Error: ${error.message}`;
        }
        
        return handlerInput.responseBuilder
            .speak(reply)
            .reprompt('Is there anything else you\'d like to know about rowing conditions?')
            .getResponse();
    }
};

/**
 * Launch request handler (when skill is opened without specific intent)
 */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log('LaunchRequest handler called');
        
        let reply;
        
        try {
            const flowData = await getFlowData();
            reply = generateReply(flowData);
        } catch (error) {
            console.error('Error in LaunchRequest:', error);
            reply = `I'm having trouble getting data. Error: ${error.message}`;
        }
        
        return handlerInput.responseBuilder
            .speak(reply)
            .reprompt('Is there anything else you\'d like to know about rowing conditions?')
            .getResponse();
    }
};

/**
 * Help intent handler
 */
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'I can tell you if it\'s safe to row today at Reading Rowing Club based on river flow conditions. Just ask "can I row today?" and I\'ll check the latest flow data for Reading UK from the UK Environment Agency.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * Cancel and Stop intent handler
 */
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

/**
 * Session ended request handler
 */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended: ${JSON.stringify(handlerInput.requestEnvelope.request.reason)}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

/**
 * Intent reflector for debugging
 */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

/**
 * Error handler
 */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.stack}`);
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * Request interceptor for logging
 */
const RequestInterceptor = {
    process(handlerInput) {
        console.log(`REQUEST: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    }
};

/**
 * Response interceptor for logging
 */
const ResponseInterceptor = {
    process(handlerInput, response) {
        console.log(`RESPONSE: ${JSON.stringify(response)}`);
    }
};

/**
 * Skill builder and exports
 */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        RowingConditionsIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(RequestInterceptor)
    .addResponseInterceptors(ResponseInterceptor)
    .lambda();
