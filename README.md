# Can I Row Today - Alexa Skill

This is an Alexa-hosted skill that checks UK Environment Agency river flow data to determine rowing conditions.
Specifically, it checks the flow conditions at Reading, UK https://environment.data.gov.uk/flood-monitoring/id/measures/2200TH-flow--Mean-15_min-m3_s

## Note:
I am a novice developer. I used Claude (https://claude.ai/) to generate the code and deployment instructions for me and then worked it out.

## IMPORTANT NOTE ON WATER SAFETY
This skill is based on Reading Rowing Club's water safety rules (https://www.readingrc.com/members/2016/4/30/water-safety). Every rowing club has their own safety rules and polices. This Alexa skill is meant to help make it easier to check conditions without using a device with a screen. in all circumstances use your best judgement when it comes to water safety and if in doubt, use your club's official guidance. If you are in doubt, don't row. 

The Author of this skill cannot take responsiblity for the accuracy of the data or be held accountable for actions taken using this skill 

## Files Structure

Your Alexa-hosted skill will need these files:

### 1. Interaction Model (en-US.json)
Place this in the `interactionModels/custom/` folder:

```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "can i row today",
      "intents": [
        {
          "name": "RowingConditionsIntent",
          "slots": [],
          "samples": [
            "can i row today",
            "what are the rowing conditions",
            "is it safe to row",
            "check rowing conditions",
            "rowing status"
          ]
        },
        {
          "name": "AMAZON.HelpIntent",
          "samples": []
        },
        {
          "name": "AMAZON.StopIntent",
          "samples": []
        },
        {
          "name": "AMAZON.CancelIntent",
          "samples": []
        }
      ]
    }
  }
}
```

### 2. Skill Manifest (skill.json)
Place this in the root folder:

```json
{
  "manifest": {
    "apis": {
      "custom": {
        "endpoint": {
          "uri": "ask-custom-can-i-row-today-default"
        },
        "interfaces": []
      }
    },
    "manifestVersion": "1.0",
    "publishingInformation": {
      "locales": {
        "en-US": {
          "name": "Can I Row Today",
          "summary": "Check river flow conditions for rowing safety",
          "description": "This skill checks UK Environment Agency river flow data to determine if it's safe to row today. It provides flow rate information and safety restrictions based on current conditions.",
          "keywords": [
            "rowing",
            "river",
            "flow",
            "safety",
            "environment agency"
          ],
          "examplePhrases": [
            "Alexa, ask can i row today",
            "Alexa, open can i row today",
            "Alexa, ask can i row today what are the conditions"
          ]
        }
      },
      "isAvailableWorldwide": false,
      "testingInstructions": "Say 'Alexa, ask can i row today' to check current rowing conditions",
      "category": "SPORTS",
      "distributionCountries": ["GB"]
    },
    "permissions": [
      {
        "name": "alexa::devices::all::notifications:write"
      }
    ],
    "privacyAndCompliance": {
      "allowsPurchases": false,
      "usesPersonalInfo": false,
      "isChildDirected": false,
      "isExportCompliant": true,
      "containsAds": false,
      "locales": {
        "en-US": {
          "privacyPolicyUrl": "",
          "termsOfUseUrl": ""
        }
      }
    }
  }
}
```

### 3. Lambda Function Code (index.js)
Place this in the `lambda/` folder:

```javascript
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
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let reply;
    
    if (flowValue <= 50) {
        reply = `As of ${formattedDateTime}, the current flow rate is ${flowValue}, there are no restrictions today`;
    } else if (flowValue >= 51 && flowValue <= 75) {
        reply = `As of ${formattedDateTime}, the current flow rate is ${flowValue}, there are High Flow restrictions today. No novice coxes or steerpersons`;
    } else if (flowValue >= 76 && flowValue <= 100) {
        reply = `As of ${formattedDateTime}, the current flow rate is ${flowValue}, there are Very High Flow restrictions today. No singles, doubles, or pairs today`;
    } else {
        reply = `As of ${formattedDateTime}, the current flow rate is ${flowValue}, there is no rowing today, it's too dangerous.`;
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
        const speakOutput = 'I can tell you if it\'s safe to row today based on river flow conditions. Just ask "can I row today?" and I\'ll check the latest flow data from the UK Environment Agency.';

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
```

### 4. Package Dependencies (package.json)
Place this in the `lambda/` folder:

```json
{
  "name": "can-i-row-today",
  "version": "1.0.0",
  "description": "Alexa skill to check rowing conditions based on river flow data",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "ask-sdk-core": "^2.12.0",
    "ask-sdk-model": "^1.34.1"
  },
  "keywords": [
    "alexa",
    "skill",
    "rowing",
    "river-flow"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

## Deployment Instructions

### Step 1: Create the Skill in Alexa Developer Console

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Click "Create Skill"
3. Enter skill name: "Can I Row Today"
4. Choose "Custom" skill type
5. Choose "Alexa-hosted (Node.js)" hosting method
6. Click "Create skill"

### Step 2: Configure the Interaction Model

1. In the left sidebar, click "Interaction Model" → "JSON Editor"
2. Copy and paste the `en-US.json` content from above
3. Click "Save Model"
4. Click "Build Model" and wait for completion

### Step 3: Configure the Skill Manifest

1. In the left sidebar, scroll down and click "Skill Manifest"
2. Replace the existing JSON with the `skill.json` content from above
3. Click "Save"

### Step 4: Deploy the Lambda Function

1. Click on the "Code" tab at the top of the console
2. In the file explorer on the left:
   - Replace the contents of `index.js` with the Lambda function code above
   - Replace the contents of `package.json` with the package dependencies above
3. Click "Save" then click "Deploy"

### Step 5: Test the Skill

1. Go to the "Test" tab
2. Enable testing by selecting "Development" from the dropdown
3. Type or say: "ask can i row today"
4. The skill should respond with current rowing conditions

### Step 6: Monitor and Debug

1. Use the "Code" tab to view CloudWatch logs
2. All console.log statements will appear in the logs for debugging
3. Error logging is built into the skill with comprehensive error handling

## Features Implemented

✅ **Error Logging**: Comprehensive console.log statements throughout the code for debugging in Alexa Developer Console  
✅ **API Integration**: Connects to UK Environment Agency Real Time Flood-monitoring API  
✅ **Caching**: 15-minute cache implementation with automatic expiry  
✅ **Flow Rate Logic**: All specified flow rate thresholds and responses  
✅ **Error Handling**: Graceful error handling with user-friendly messages  
✅ **Alexa Integration**: Proper intent handling and speech responses  

## API Response Structure

The skill expects this structure from the Environment Agency API:
```json
{
  "items": {
    "label": "Flow rate description",
    "latestReading": {
      "dateTime": "2025-06-25T10:30:00Z",
      "value": 45.2
    }
  }
}
```

## Flow Rate Thresholds

- **≤ 50**: No restrictions
- **51-75**: High Flow restrictions (No novice coxes or steerpersons)
- **76-100**: Very High Flow restrictions (No singles, doubles, or pairs)
- **> 100**: No rowing (too dangerous)

## Permissions

The skill requires no special permissions to access the public Environment Agency API. The basic Alexa permissions are configured in the skill manifest.

## Testing Commands

- "Alexa, ask can i row today"
- "Alexa, open can i row today"
- "Alexa, ask can i row today what are the conditions"

The skill will automatically check the cache first, then fetch fresh data if needed, and provide appropriate rowing restrictions based on the current flow rate.
