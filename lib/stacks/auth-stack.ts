import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { InfrastructureConfig } from '../config';

/**
 * Stack for authentication resources (Cognito user pools, identity pools)
 */
export class AuthStack extends cdk.Stack {
  /**
   * The Cognito user pool created by this stack
   */
  public readonly userPool?: cognito.IUserPool;
  
  /**
   * The Cognito identity pool created by this stack
   */
  public readonly identityPool?: cognito.CfnIdentityPool;
  
  /**
   * The authenticated role for the identity pool
   */
  public readonly authenticatedRole?: iam.Role;
  
  /**
   * The unauthenticated role for the identity pool
   */
  public readonly unauthenticatedRole?: iam.Role;

  constructor(
    scope: Construct, 
    id: string, 
    config: InfrastructureConfig, 
    bucket?: s3.IBucket,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // Apply tags to all resources in this stack
    if (config.tags) {
      Object.entries(config.tags).forEach(([key, value]) => {
        cdk.Tags.of(this).add(key, value);
      });
    }
    
    // Add default tags
    cdk.Tags.of(this).add('Project', config.projectName);
    cdk.Tags.of(this).add('Environment', config.environment);

    // Create authentication resources if enabled
    if (config.auth?.createAuth) {
      // Create Cognito user pool
      this.userPool = new cognito.UserPool(this, 'UserPool', {
        userPoolName: config.auth.userPoolName || `${config.projectName}-${config.environment}-users`,
        selfSignUpEnabled: config.auth.selfSignUpEnabled || false,
        signInAliases: { email: true },
        autoVerify: { email: true },
        standardAttributes: { email: { required: true } },
        passwordPolicy: {
          minLength: config.auth.passwordPolicy?.minLength || 8,
          requireLowercase: config.auth.passwordPolicy?.requireLowercase !== false,
          requireUppercase: config.auth.passwordPolicy?.requireUppercase !== false,
          requireDigits: config.auth.passwordPolicy?.requireDigits !== false,
          requireSymbols: config.auth.passwordPolicy?.requireSymbols !== false,
        },
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
        removalPolicy: config.environment === 'prod' ? 
          cdk.RemovalPolicy.RETAIN : 
          cdk.RemovalPolicy.DESTROY,
        mfa: config.auth.mfaEnabled ? 
          (config.auth.mfaRequired ? cognito.Mfa.REQUIRED : cognito.Mfa.OPTIONAL) : 
          cognito.Mfa.OFF,
        mfaSecondFactor: {
          sms: false,
          otp: true,
        },
      });
      
      // Add custom attributes
      this.userPool.addDomain('UserPoolDomain', {
        cognitoDomain: {
          domainPrefix: `${config.projectName}-${config.environment}`,
        },
      });
      
      // Create app clients
      const webClient = this.userPool.addClient('WebClient', {
        userPoolClientName: `${config.projectName}-${config.environment}-web-client`,
        generateSecret: false,
        authFlows: {
          userPassword: true,
          userSrp: true,
          adminUserPassword: true,
        },
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
            implicitCodeGrant: true,
          },
          scopes: [
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.PROFILE,
            cognito.OAuthScope.COGNITO_ADMIN,
          ],
          callbackUrls: config.auth.callbackUrls || ['http://localhost:3000/callback'],
          logoutUrls: config.auth.logoutUrls || ['http://localhost:3000/'],
        },
      });
      
      const serverClient = this.userPool.addClient('ServerClient', {
        userPoolClientName: `${config.projectName}-${config.environment}-server-client`,
        generateSecret: true,
        authFlows: {
          adminUserPassword: true,
          userSrp: true,
          custom: true,
        },
      });
      
      // Create identity pool
      this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
        identityPoolName: config.auth.identityPoolName || `${config.projectName}-${config.environment}-identity`,
        allowUnauthenticatedIdentities: true,
        cognitoIdentityProviders: [
          {
            clientId: webClient.userPoolClientId,
            providerName: `cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
          },
        ],
      });
      
      // Create roles for the identity pool
      this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
        roleName: `${config.projectName}-${config.environment}-auth-role`,
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      });
      
      this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
        roleName: `${config.projectName}-${config.environment}-unauth-role`,
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'unauthenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      });
      
      // Add basic permissions to roles
      this.authenticatedRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cognito-sync:*', 'cognito-identity:*'],
          resources: ['*'],
        })
      );
      
      this.unauthenticatedRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cognito-sync:*'],
          resources: ['*'],
        })
      );
      
      // Add S3 permissions if bucket is provided
      if (bucket) {
        // Allow authenticated users to access their own private folder
        this.authenticatedRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
            resources: [
              `${bucket.bucketArn}/private/\${cognito-identity.amazonaws.com:sub}/*`,
            ],
          })
        );
        
        // Allow authenticated users to list their own private folder
        this.authenticatedRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:ListBucket'],
            resources: [bucket.bucketArn],
            conditions: {
              StringLike: {
                's3:prefix': ['private/${cognito-identity.amazonaws.com:sub}/*'],
              },
            },
          })
        );
        
        // Allow authenticated users to read from public folder
        this.authenticatedRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject'],
            resources: [`${bucket.bucketArn}/public/*`],
          })
        );
        
        // Allow unauthenticated users to read from public folder
        this.unauthenticatedRole.addToPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject'],
            resources: [`${bucket.bucketArn}/public/*`],
          })
        );
      }
      
      // Attach roles to identity pool
      new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
        identityPoolId: this.identityPool.ref,
        roles: {
          authenticated: this.authenticatedRole.roleArn,
          unauthenticated: this.unauthenticatedRole.roleArn,
        },
      });
      
      // Create IAM policy for admin access to Cognito
      const cognitoAdminPolicy = new iam.ManagedPolicy(this, 'CognitoAdminPolicy', {
        managedPolicyName: `${config.projectName}-${config.environment}-cognito-admin-policy`,
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cognito-idp:AdminInitiateAuth',
              'cognito-idp:AdminCreateUser',
              'cognito-idp:AdminSetUserPassword',
              'cognito-idp:AdminUpdateUserAttributes',
              'cognito-idp:AdminGetUser',
              'cognito-idp:AdminConfirmSignUp',
              'cognito-idp:AdminDisableUser',
              'cognito-idp:AdminEnableUser',
              'cognito-idp:AdminRemoveUserFromGroup',
              'cognito-idp:AdminAddUserToGroup',
              'cognito-idp:AdminListGroupsForUser',
              'cognito-idp:AdminDeleteUser',
              'cognito-idp:ListUsers',
            ],
            resources: [this.userPool.userPoolArn],
          }),
        ],
      });
      
      // Output user pool and identity pool IDs
      new cdk.CfnOutput(this, 'UserPoolId', {
        value: this.userPool.userPoolId,
        description: 'The ID of the Cognito user pool',
        exportName: `${config.projectName}-${config.environment}-user-pool-id`,
      });
      
      new cdk.CfnOutput(this, 'UserPoolClientId', {
        value: webClient.userPoolClientId,
        description: 'The ID of the Cognito user pool web client',
        exportName: `${config.projectName}-${config.environment}-user-pool-client-id`,
      });
      
      new cdk.CfnOutput(this, 'IdentityPoolId', {
        value: this.identityPool.ref,
        description: 'The ID of the Cognito identity pool',
        exportName: `${config.projectName}-${config.environment}-identity-pool-id`,
      });
      
      new cdk.CfnOutput(this, 'CognitoAdminPolicyArn', {
        value: cognitoAdminPolicy.managedPolicyArn,
        description: 'The ARN of the Cognito admin policy',
        exportName: `${config.projectName}-${config.environment}-cognito-admin-policy-arn`,
      });
    }
  }
} 