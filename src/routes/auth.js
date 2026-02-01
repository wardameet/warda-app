/**
 * Authentication Routes
 * Handles Cognito authentication for all user types
 */

const express = require('express');
const router = express.Router();
const { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

// Sign up new user (family members, staff)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, userType } = req.body;

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'custom:userType', Value: userType || 'family' }
      ]
    });

    const response = await cognitoClient.send(command);
    
    res.json({
      success: true,
      message: 'User registered. Please check email for verification code.',
      userSub: response.UserSub
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Confirm signup with verification code
router.post('/confirm', async (req, res) => {
  try {
    const { email, code } = req.body;

    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    });

    await cognitoClient.send(command);
    
    res.json({
      success: true,
      message: 'Email verified successfully. You can now sign in.'
    });
  } catch (error) {
    console.error('Confirm error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Sign in
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });

    const response = await cognitoClient.send(command);
    
    res.json({
      success: true,
      tokens: {
        accessToken: response.AuthenticationResult.AccessToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        idToken: response.AuthenticationResult.IdToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// PIN login for elderly users (simplified auth)
router.post('/pin-login', async (req, res) => {
  try {
    const { visitorId, pin } = req.body;
    
    // TODO: Implement PIN-based auth for elderly users
    // This will lookup the resident by visitor ID and verify PIN
    
    res.json({
      success: true,
      message: 'PIN login - to be implemented',
      user: {
        id: visitorId,
        type: 'resident'
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid PIN'
    });
  }
});

module.exports = router;
