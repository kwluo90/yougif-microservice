const AWS = require('aws-sdk');
const { promisify } = require('util');
AWS.config.update({ region: process.env.AWS_REGION });

var ddb;

exports.handler = async (event, context) => {
  console.log(event.queryStringParameters);

  let { url, startTime, duration, channelId } = event.queryStringParameters;
  if (!url) {
    return ({
      statusCode: 400,
      body: 'Missing url.'
    });
  }

  if (!ddb) ddb = new AWS.DynamoDB.DocumentClient();

  startTime = startTime ? startTime : '00:00:00';
  duration = duration ? duration : 10;

  console.log(`url: ${url} startTime: ${startTime} duration: ${duration} channelId: ${channelId}`);

  console.log(`stateMachine: ${process.env.STEPFUNCTION_ARN}`);

  let params = {
    stateMachineArn: process.env.STEPFUNCTION_ARN,
    input: JSON.stringify({
      url: url,
      startTime: startTime,
      duration: duration,
      channelId: channelId
    })
  };

  // First check if we've processed this video before
  const keyName = [url, startTime, duration].join(':');
  var params = {
    TableName: process.env.CACHE_TABLE,
    Key: {
      HashKey: keyName
    }
  };

  try {
    var cacheResult = await ddb.get(params).promise();
  } catch (err) {
    console.log(err);
    cacheResult = null;
  }

  if (cacheResult) {
    return({
      statusCode: 200,
      body: cacheResult.Item.gfyUrl
    });
  }

  let sf = new AWS.StepFunctions();
  try {
    return await promisify(sf.startExecution.bind(sf))(params)
      .then(() => {
        return ({
          statusCode: 200,
          body: "Success."
        });
      })
      .catch(err => {
        console.log('Error while executing step function: ' + err.message);
        return ({
          statusCode: 500,
          body: err.message
        });
      })
  } catch (err) {
    console.log('Error while executing step function: ' + err.message);
    return ({
      statusCode: 500,
      body: err.message
    });
  }


};