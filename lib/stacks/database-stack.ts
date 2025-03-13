import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { InfrastructureConfig } from '../config';

/**
 * Stack for database resources (RDS instances)
 */
export class DatabaseStack extends cdk.Stack {
  /**
   * The RDS instance created by this stack
   */
  public readonly databaseInstance?: rds.IDatabaseInstance;
  
  /**
   * The database credentials secret
   */
  public readonly databaseSecret?: secretsmanager.ISecret;

  constructor(
    scope: Construct, 
    id: string, 
    config: InfrastructureConfig, 
    vpc: ec2.IVpc,
    securityGroup: ec2.ISecurityGroup,
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

    // Create database if enabled
    if (config.database?.createDatabase) {
      // Create database credentials secret
      this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
        secretName: `${config.projectName}/${config.environment}/database`,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: 'postgres' }),
          excludePunctuation: true,
          includeSpace: false,
          generateStringKey: 'password',
        },
      });
      
      // Set default values
      const engine = config.database.engine || 
        rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_17_2,
        });
      
      const instanceType = config.database.instanceType || 
        ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
      
      const allocatedStorage = config.database.allocatedStorage || 20;
      
      const backupRetention = config.database.backupRetentionDays || 
        (config.environment === 'prod' ? 30 : 7);
      
      const multiAz = config.database.multiAz !== undefined ? 
        config.database.multiAz : 
        config.environment === 'prod';
      
      const deletionProtection = config.database.deletionProtection !== undefined ? 
        config.database.deletionProtection : 
        config.environment === 'prod';
      
      // Create parameter group for PostgreSQL
      const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_17_2,
        }),
        parameters: {
          'max_connections': '100',
          'shared_buffers': '16',
        },
      });
      
      // Create the database instance
      this.databaseInstance = new rds.DatabaseInstance(this, 'Database', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_17_2,
        }),
        instanceType,
        vpc,
        vpcSubnets: {
          subnetType: config.database.publiclyAccessible ? 
            ec2.SubnetType.PUBLIC : 
            ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
        credentials: rds.Credentials.fromSecret(this.databaseSecret),
        databaseName: config.database.databaseName || config.projectName.replace(/-/g, '_'),
        allocatedStorage,
        storageType: rds.StorageType.GP2,
        backupRetention: cdk.Duration.days(backupRetention),
        deleteAutomatedBackups: config.environment !== 'prod',
        deletionProtection,
        removalPolicy: config.environment === 'prod' ? 
          cdk.RemovalPolicy.RETAIN : 
          cdk.RemovalPolicy.DESTROY,
        multiAz,
        autoMinorVersionUpgrade: true,
        parameterGroup,
        publiclyAccessible: config.database.publiclyAccessible || false,
        storageEncrypted: config.environment === 'prod',
      });
      
      // Output database endpoint and secret ARN
      new cdk.CfnOutput(this, 'DatabaseEndpoint', {
        value: this.databaseInstance.dbInstanceEndpointAddress,
        description: 'The endpoint of the database',
        exportName: `${config.projectName}-${config.environment}-db-endpoint`,
      });
      
      new cdk.CfnOutput(this, 'DatabasePort', {
        value: this.databaseInstance.dbInstanceEndpointPort,
        description: 'The port of the database',
        exportName: `${config.projectName}-${config.environment}-db-port`,
      });
      
      new cdk.CfnOutput(this, 'DatabaseSecretArn', {
        value: this.databaseSecret.secretArn,
        description: 'The ARN of the database secret',
        exportName: `${config.projectName}-${config.environment}-db-secret-arn`,
      });
    }
  }
} 