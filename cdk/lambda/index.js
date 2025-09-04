const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

exports.handler = async (event) => {
  const TABLE_NAME = process.env.TABLE_NAME;
  const DEFAULT_ID = 'default';
  const method = event?.httpMethod || event?.requestContext?.http?.method;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  try {
    if (method === 'GET') {
      const result = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: DEFAULT_ID },
      }));
      const item = result.Item || { id: DEFAULT_ID, people: [] };
      return { statusCode: 200, headers: cors, body: JSON.stringify({ people: item.people || [] }) };
    }

    if (method === 'POST') {
      let raw = event.body || '';
      if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
      const data = JSON.parse(raw || '{}');

      const item = { id: DEFAULT_ID, people: Array.isArray(data.people) ? data.people : [], updatedAt: new Date().toISOString() };
      await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return { statusCode: 200, headers: cors, body: JSON.stringify({ message: 'Saved successfully', savedData: item }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal server error', error: err.message }) };
  }
};
