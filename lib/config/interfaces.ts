import { InstanceType } from 'aws-cdk-lib/aws-ec2';
import { DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';

/**
 * Base configuration interface for all environments
 */
export interface BaseConfig {
  /**
   * AWS account ID
   */
  readonly account: string;
  
  /**
   * AWS region
   */
  readonly region: string;
  
  /**
   * AWS CLI profile name to use for deployment
   * This helps prevent accidental deployments to the wrong account
   */
  readonly profile?: string;
  
  /**
   * Project name used for resource naming and tagging
   */
  readonly projectName: string;
  
  /**
   * Environment name (dev, staging, prod)
   */
  readonly environment: string;
  
  /**
   * Tags to apply to all resources
   */
  readonly tags?: Record<string, string>;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /**
   * Whether to create a new VPC
   * @default true
   */
  readonly createVpc?: boolean;
  
  /**
   * Existing VPC ID to use if not creating a new VPC
   */
  readonly vpcId?: string;
  
  /**
   * CIDR block for the VPC
   * @default '10.0.0.0/16'
   */
  readonly vpcCidr?: string;
  
  /**
   * Number of availability zones to use
   * @default 2
   */
  readonly maxAzs?: number;
  
  /**
   * Whether to create NAT gateways
   * @default true
   */
  readonly natGateways?: boolean;
  
  /**
   * IP addresses to whitelist for security groups
   */
  readonly ipWhitelist?: string[];
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /**
   * Whether to create an S3 bucket
   * @default true
   */
  readonly createBucket?: boolean;
  
  /**
   * Name of the S3 bucket
   */
  readonly bucketName?: string;
  
  /**
   * Whether to create a CloudFront distribution
   * @default false
   */
  readonly createDistribution?: boolean;
  
  /**
   * Whether to enable versioning on the bucket
   * @default false
   */
  readonly enableVersioning?: boolean;
  
  /**
   * Whether to enable CORS on the bucket
   * @default true
   */
  readonly enableCors?: boolean;
  
  /**
   * CORS allowed origins
   * @default ['*']
   */
  readonly corsAllowedOrigins?: string[];
  
  /**
   * CORS allowed methods
   * @default ['GET', 'PUT', 'POST', 'DELETE', 'HEAD']
   */
  readonly corsAllowedMethods?: string[];
  
  /**
   * Whether to enable lifecycle rules
   * @default false
   */
  readonly enableLifecycle?: boolean;
  
  /**
   * Number of days to transition objects to infrequent access
   * @default 30
   */
  readonly transitionToIaAfterDays?: number;
  
  /**
   * Number of days after which objects should expire (be deleted)
   * If not specified, objects will not expire automatically
   * @default undefined
   */
  readonly expireAfterDays?: number;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /**
   * Whether to create a database
   * @default false
   */
  readonly createDatabase?: boolean;
  
  /**
   * Database engine to use
   * @default PostgreSQL
   */
  readonly engine?: DatabaseInstanceEngine;
  
  /**
   * Instance type for the database
   */
  readonly instanceType?: InstanceType;
  
  /**
   * Allocated storage in GB
   * @default 20
   */
  readonly allocatedStorage?: number;
  
  /**
   * Whether the database should be publicly accessible
   * @default false
   */
  readonly publiclyAccessible?: boolean;
  
  /**
   * Whether to enable deletion protection
   * @default true in prod, false otherwise
   */
  readonly deletionProtection?: boolean;
  
  /**
   * Whether to enable multi-AZ deployment
   * @default true in prod, false otherwise
   */
  readonly multiAz?: boolean;
  
  /**
   * Whether to enable automated backups
   * @default true
   */
  readonly enableBackups?: boolean;
  
  /**
   * Backup retention period in days
   * @default 7
   */
  readonly backupRetentionDays?: number;
  
  /**
   * Database name
   */
  readonly databaseName?: string;
  
  /**
   * Database port
   * @default 5432 for PostgreSQL, 3306 for MySQL
   */
  readonly port?: number;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /**
   * Whether to create authentication resources
   * @default false
   */
  readonly createAuth?: boolean;
  
  /**
   * User pool name
   */
  readonly userPoolName?: string;
  
  /**
   * Identity pool name
   */
  readonly identityPoolName?: string;
  
  /**
   * Whether to enable self sign-up
   * @default false
   */
  readonly selfSignUpEnabled?: boolean;
  
  /**
   * Whether to enable MFA
   * @default false
   */
  readonly mfaEnabled?: boolean;
  
  /**
   * Whether MFA should be required
   * @default false
   */
  readonly mfaRequired?: boolean;
  
  /**
   * OAuth callback URLs
   */
  readonly callbackUrls?: string[];
  
  /**
   * OAuth logout URLs
   */
  readonly logoutUrls?: string[];
  
  /**
   * Password policy configuration
   */
  readonly passwordPolicy?: {
    /**
     * Minimum password length
     * @default 8
     */
    readonly minLength?: number;
    
    /**
     * Whether to require lowercase characters
     * @default true
     */
    readonly requireLowercase?: boolean;
    
    /**
     * Whether to require uppercase characters
     * @default true
     */
    readonly requireUppercase?: boolean;
    
    /**
     * Whether to require numbers
     * @default true
     */
    readonly requireDigits?: boolean;
    
    /**
     * Whether to require symbols
     * @default true
     */
    readonly requireSymbols?: boolean;
  };
}

/**
 * Compute configuration
 */
export interface ComputeConfig {
  /**
   * Whether to create compute resources
   * @default false
   */
  readonly createCompute?: boolean;
  
  /**
   * Instance type for EC2 instances
   */
  readonly instanceType?: InstanceType;
  
  /**
   * AMI ID to use for EC2 instances
   */
  readonly amiId?: string;
  
  /**
   * Key pair name for SSH access
   */
  readonly keyName?: string;
  
  /**
   * Whether to create an auto-scaling group
   * @default false
   */
  readonly createAsg?: boolean;
  
  /**
   * Minimum number of instances in the auto-scaling group
   * @default 1
   */
  readonly minCapacity?: number;
  
  /**
   * Maximum number of instances in the auto-scaling group
   * @default 1
   */
  readonly maxCapacity?: number;
  
  /**
   * Desired capacity of the auto-scaling group
   * @default 1
   */
  readonly desiredCapacity?: number;
  
  /**
   * User data script to run on instance launch
   */
  readonly userData?: string;
}

/**
 * Serverless configuration
 */
export interface ServerlessConfig {
  /**
   * Whether to create serverless resources
   * @default false
   */
  readonly createServerless?: boolean;
  
  /**
   * Lambda functions configuration
   */
  readonly functions?: {
    /**
     * Function name
     */
    readonly name: string;
    
    /**
     * Function handler
     */
    readonly handler: string;
    
    /**
     * Function runtime
     */
    readonly runtime: string;
    
    /**
     * Function memory size in MB
     * @default 128
     */
    readonly memorySize?: number;
    
    /**
     * Function timeout in seconds
     * @default 3
     */
    readonly timeout?: number;
    
    /**
     * Environment variables
     */
    readonly environment?: Record<string, string>;
  }[];
  
  /**
   * Whether to create an API Gateway
   * @default false
   */
  readonly createApiGateway?: boolean;
  
  /**
   * API Gateway stage name
   * @default 'api'
   */
  readonly apiStageName?: string;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /**
   * Whether to create monitoring resources
   * @default true
   */
  readonly createMonitoring?: boolean;
  
  /**
   * Whether to create a CloudWatch dashboard
   * @default true
   */
  readonly createDashboard?: boolean;
  
  /**
   * Whether to create CloudWatch alarms
   * @default true
   */
  readonly createAlarms?: boolean;
  
  /**
   * Email address to send alarm notifications to
   */
  readonly alarmEmail?: string;

  /**
   * Whether to create only essential alarms to stay within free tier
   * @default false
   */
  readonly essentialAlarmsOnly?: boolean;
}

/**
 * Complete infrastructure configuration
 */
export interface InfrastructureConfig extends BaseConfig {
  /**
   * Network configuration
   */
  readonly network?: NetworkConfig;
  
  /**
   * Storage configuration
   */
  readonly storage?: StorageConfig;
  
  /**
   * Database configuration
   */
  readonly database?: DatabaseConfig;
  
  /**
   * Authentication configuration
   */
  readonly auth?: AuthConfig;
  
  /**
   * Compute configuration
   */
  readonly compute?: ComputeConfig;
  
  /**
   * Serverless configuration
   */
  readonly serverless?: ServerlessConfig;
  
  /**
   * Monitoring configuration
   */
  readonly monitoring?: MonitoringConfig;
} 