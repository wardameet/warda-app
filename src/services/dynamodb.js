/**
 * DynamoDB Service
 * Handles session storage and conversation history
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_SESSIONS || 'warda-sessions';

// Save conversation turn
async function saveConversation(userId, turn) {
  const timestamp = new Date().toISOString();
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `CONV#${userId}`,
      sk: `TURN#${timestamp}`,
      userId,
      userMessage: turn.userMessage,
      wardaResponse: turn.wardaResponse,
      timestamp,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
    }
  });

  await docClient.send(command);
  return { pk: `CONV#${userId}`, sk: `TURN#${timestamp}` };
}

// Get conversation history
async function getConversationHistory(userId, limit = 20) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': `CONV#${userId}`,
      ':sk': 'TURN#'
    },
    ScanIndexForward: false, // Most recent first
    Limit: limit
  });

  const result = await docClient.send(command);
  return result.Items || [];
}

// Save user session
async function saveSession(sessionId, sessionData) {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `SESSION#${sessionId}`,
      sk: 'DATA',
      ...sessionData,
      updatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
    }
  });

  await docClient.send(command);
}

// Get user session
async function getSession(sessionId) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `SESSION#${sessionId}`,
      sk: 'DATA'
    }
  });

  const result = await docClient.send(command);
  return result.Item;
}

// Delete user session
async function deleteSession(sessionId) {
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `SESSION#${sessionId}`,
      sk: 'DATA'
    }
  });

  await docClient.send(command);
}

// Save WebSocket connection
async function saveConnection(connectionId, userId) {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `WS#${connectionId}`,
      sk: 'CONNECTION',
      userId,
      connectedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (12 * 60 * 60) // 12 hours TTL
    }
  });

  await docClient.send(command);
}

// Get user's mood history (for staff dashboard)
async function getMoodHistory(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND sk > :sk',
    ExpressionAttributeValues: {
      ':pk': `MOOD#${userId}`,
      ':sk': `DAY#${startDate.toISOString().split('T')[0]}`
    }
  });

  const result = await docClient.send(command);
  return result.Items || [];
}

module.exports = {
  saveConversation,
  getConversationHistory,
  saveSession,
  getSession,
  deleteSession,
  saveConnection,
  getMoodHistory
};
