import * as dotenv from 'dotenv';
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2';
import { PostgresEngineVersion } from 'aws-cdk-lib/aws-rds';
import * as rds from 'aws-cdk-lib/aws-rds';
import { InfrastructureConfig } from './interfaces';

// Load environment variables from .env file
dotenv.config();

/**
 * Helper function to get environment variable with a default value
 */
function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Create configuration from environment variables
 */
export function createConfigFromEnv(): InfrastructureConfig {
  return {
    account: getEnv('AWS_ACCOUNT_ID', process.env.CDK_DEFAULT_ACCOUNT || ''),
    region: getEnv('AWS_REGION', process.env.CDK_DEFAULT_REGION || 'us-east-1'),
    profile: getEnv('AWS_PROFILE', 'personal'),
    projectName: getEnv('PROJECT_NAME', 'my-project'),
    environment: getEnv('ENVIRONMENT', 'dev'),
    tags: {
      Environment: getEnv('TAG_ENVIRONMENT', 'Development'),
      Project: getEnv('TAG_PROJECT', 'MyProject'),
      Owner: getEnv('TAG_OWNER', 'DevTeam'),
    },
    
    // Network configuration
    network: {
      createVpc: true,
      vpcCidr: getEnv('VPC_CIDR', '10.0.0.0/16'),
      maxAzs: parseInt(getEnv('MAX_AZS', '2')),
      natGateways: false, // Disable NAT Gateways to save costs
      ipWhitelist: ['0.0.0.0/0'], // Allow all IPs in dev
    },
    
    // Storage configuration
    storage: {
      createBucket: true,
      bucketName: getEnv('S3_BUCKET_NAME', `${getEnv('PROJECT_NAME', 'my-project')}-${getEnv('ENVIRONMENT', 'dev')}-bucket`),
      createDistribution: false, // Disable CloudFront to save costs
      enableVersioning: false,
      enableCors: true,
      corsAllowedOrigins: ['*'],
      corsAllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      enableLifecycle: true, // Enable lifecycle rules to optimize storage costs
      transitionToIaAfterDays: 30, // Move to infrequent access after 30 days
    },
    
    // Database configuration
    database: {
      createDatabase: true,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17_2,
      }),
      instanceType: InstanceType.of(
        InstanceClass.T3, // Use t3 class for better performance
        InstanceSize.MICRO,
      ),
      allocatedStorage: 20,
      publiclyAccessible: true,
      deletionProtection: false,
      multiAz: false,
      enableBackups: true,
      backupRetentionDays: 7,
      databaseName: getEnv('DB_NAME', 'mydb'),
    },
    
    // Authentication configuration
    auth: {
      createAuth: true,
      userPoolName: getEnv('USER_POOL_NAME', `${getEnv('PROJECT_NAME', 'my-project')}-${getEnv('ENVIRONMENT', 'dev')}-users`),
      identityPoolName: getEnv('IDENTITY_POOL_NAME', `${getEnv('PROJECT_NAME', 'my-project')}-${getEnv('ENVIRONMENT', 'dev')}-identity`),
      selfSignUpEnabled: true,
      mfaEnabled: false, // Simplify for development
      mfaRequired: false,
      callbackUrls: [getEnv('COGNITO_CALLBACK_URL', 'http://localhost:3000/callback')],
      logoutUrls: [getEnv('COGNITO_LOGOUT_URL', 'http://localhost:3000/')],
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
    },
    
    // Compute configuration
    compute: {
      createCompute: true, // Enable EC2 instance
      instanceType: InstanceType.of(
        InstanceClass.T2, // Use t2 class for free tier
        InstanceSize.MICRO, // Use micro size for free tier
      ),
      createAsg: false, // No auto-scaling group to stay within free tier
      keyName: getEnv('EC2_KEY_PAIR_NAME', ''),
      // Use x86_64 architecture for free tier eligibility
      userData: getEnv('EC2_USER_DATA', ''),
    },
    
    // Serverless configuration
    serverless: {
      createServerless: true,
      createApiGateway: true,
      apiStageName: getEnv('API_STAGE_NAME', 'dev'),
      // No function definitions - will be created separately
    },
    
    // Monitoring configuration
    monitoring: {
      createMonitoring: true,
      createDashboard: false, // Disable dashboard to stay within free tier
      createAlarms: true,
      alarmEmail: getEnv('ALARM_EMAIL', 'dev-team@example.com'),
      essentialAlarmsOnly: true, // Only create essential alarms to stay within free tier
    },
  };
}

/**
 * Environment-based configuration using environment variables
 */
export const envConfig = createConfigFromEnv();
