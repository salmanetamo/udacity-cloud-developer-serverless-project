import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register'

import { verify, decode } from 'jsonwebtoken'
import { createLogger } from '../../utils/logger'
import Axios from 'axios'
import { Jwt } from '../../auth/Jwt'
import { JwtHeader } from 'jsonwebtoken'
import { JwtPayload } from '../../auth/JwtPayload'
import { certToPEM } from '../utils'

const logger = createLogger('auth')

// to verify JWT token signature.
// To get this URL you need to go to an Auth0 page -> Show Advanced Settings -> Endpoints -> JSON Web Key Set
const jwksUrl = 'https://dev-lswwbacj.us.auth0.com/.well-known/jwks.json'

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', event.authorizationToken)
  try {
    const jwtToken = await verifyToken(event.authorizationToken)
    logger.info('User was authorized', jwtToken)

    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {
    logger.error('User not authorized', { error: e.message })

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}

async function verifyToken(authHeader: string): Promise<JwtPayload> {
  const token = getToken(authHeader)
  const jwt: Jwt = decode(token, { complete: true }) as Jwt

  if (!jwt.header || jwt.header.alg !== 'RS256') {
    throw new Error('JWT Header missing or wrong encryption algorithm');
  }
  const jwksSigningKeys = await getJwksSigningKeys();
  const signingKeyForHeader = getSigningKeyForHeader(jwksSigningKeys, jwt.header);

  if (!signingKeyForHeader) {
    throw new Error(`Unable to find a signing key that matches '${jwt.header.kid}'`);
  }

  return verify(token, signingKeyForHeader.publicKey, { algorithms: ['RS256'] }) as JwtPayload;
}

async function getJwksSigningKeys(): Promise<any[]> {
  const response = await Axios.get<{keys: any[]}>(jwksUrl, {
    headers: {
      'Content-Type': 'application/json'
    }})

  const jwks = response.data.keys;

  if (!jwks || !jwks.length) {
    logger.error('Error getting auth0 keys');
    throw new Error('The JWKS endpoint did not contain any keys');
  }

  const signingKeys = jwks
      .filter(key => key.use === 'sig'
                  && key.kty === 'RSA'
                  && key.kid 
                  && ((key.x5c && key.x5c.length) || (key.n && key.e)) // Has useful public keys
      ).map(key => {
        return { kid: key.kid, nbf: key.nbf, publicKey: certToPEM(key.x5c[0]) };
      });

    if (!signingKeys.length) {
      logger.error('Error getting auth0 keys');
      throw new Error('The JWKS endpoint did not contain any signature verification keys');
    }

  return signingKeys;
}

function getToken(authHeader: string): string {
  if (!authHeader) throw new Error('No authentication header')

  if (!authHeader.toLowerCase().startsWith('bearer '))
    throw new Error('Invalid authentication header')

  const split = authHeader.split(' ')
  const token = split[1]

  return token
}

function getSigningKeyForHeader(jwksSigningKeys: any[], header: JwtHeader) {
  return jwksSigningKeys.find(signingKey => signingKey.kid === header.kid);
}

