import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { InfrastructureConfig } from './config';
import {
  NetworkStack,
  StorageStack,
  DatabaseStack,
  AuthStack,
  ComputeStack,
  ServerlessStack,
  MonitoringStack,
} from './stacks';

/**
 * Main application class that creates all stacks based on configuration
 */
export class InfrastructureApp {
  /**
   * The CDK app instance
   */
  private readonly app: cdk.App;
  
  /**
   * The configuration for the infrastructure
   */
  private readonly config: InfrastructureConfig;
  
  /**
   * The stacks created by this application
   */
  private readonly stacks: {
    network?: NetworkStack;
    storage?: StorageStack;
    database?: DatabaseStack;
    auth?: AuthStack;
    compute?: ComputeStack;
    serverless?: ServerlessStack;
    monitoring?: MonitoringStack;
  } = {};

  constructor(app: cdk.App, config: InfrastructureConfig) {
    this.app = app;
    this.config = config;
    
    // Create stacks based on configuration
    this.createStacks();
  }
  
  /**
   * Create all stacks based on configuration
   */
  private createStacks(): void {
    const stackNamePrefix = `${this.config.projectName}-${this.config.environment}`;
    const env = {
      account: this.config.account,
      region: this.config.region,
    };
    
    // Create network stack
    this.stacks.network = new NetworkStack(this.app, `${stackNamePrefix}-network`, this.config, {
      env,
      description: `Network stack for ${this.config.projectName} ${this.config.environment} environment`,
    });
    
    // Create storage stack
    this.stacks.storage = new StorageStack(this.app, `${stackNamePrefix}-storage`, this.config, {
      env,
      description: `Storage stack for ${this.config.projectName} ${this.config.environment} environment`,
    });
    
    // Create database stack
    if (this.config.database?.createDatabase) {
      this.stacks.database = new DatabaseStack(
        this.app,
        `${stackNamePrefix}-database`,
        this.config,
        this.stacks.network.vpc,
        this.stacks.network.databaseSecurityGroup,
        {
          env,
          description: `Database stack for ${this.config.projectName} ${this.config.environment} environment`,
        }
      );
      
      // Add dependency on network stack
      this.stacks.database.addDependency(this.stacks.network);
    }
    
    // Create auth stack
    if (this.config.auth?.createAuth) {
      this.stacks.auth = new AuthStack(
        this.app,
        `${stackNamePrefix}-auth`,
        this.config,
        this.stacks.storage?.bucket,
        {
          env,
          description: `Authentication stack for ${this.config.projectName} ${this.config.environment} environment`,
        }
      );
      
      // Add dependency on storage stack if bucket is used
      if (this.stacks.storage?.bucket) {
        this.stacks.auth.addDependency(this.stacks.storage);
      }
    }
    
    // Create compute stack
    if (this.config.compute?.createCompute) {
      this.stacks.compute = new ComputeStack(
        this.app,
        `${stackNamePrefix}-compute`,
        this.config,
        this.stacks.network.vpc,
        this.stacks.network.applicationSecurityGroup,
        {
          env,
          description: `Compute stack for ${this.config.projectName} ${this.config.environment} environment`,
        }
      );
      
      // Add dependency on network stack
      this.stacks.compute.addDependency(this.stacks.network);
    }
    
    // Create serverless stack
    if (this.config.serverless?.createServerless) {
      this.stacks.serverless = new ServerlessStack(
        this.app,
        `${stackNamePrefix}-serverless`,
        this.config,
        this.stacks.network.vpc,
        {
          env,
          description: `Serverless stack for ${this.config.projectName} ${this.config.environment} environment`,
        }
      );
      
      // Add dependency on network stack
      this.stacks.serverless.addDependency(this.stacks.network);
    }
    
    // Create monitoring stack
    if (this.config.monitoring?.createMonitoring !== false) {
      this.stacks.monitoring = new MonitoringStack(
        this.app,
        `${stackNamePrefix}-monitoring`,
        this.config,
        {
          instance: this.stacks.compute?.instance,
          autoScalingGroup: this.stacks.compute?.autoScalingGroup,
          databaseInstance: this.stacks.database?.databaseInstance,
          functions: this.stacks.serverless?.functions,
        },
        {
          env,
          description: `Monitoring stack for ${this.config.projectName} ${this.config.environment} environment`,
        }
      );
      
      // Add dependencies on other stacks
      if (this.stacks.compute) {
        this.stacks.monitoring.addDependency(this.stacks.compute);
      }
      
      if (this.stacks.database) {
        this.stacks.monitoring.addDependency(this.stacks.database);
      }
      
      if (this.stacks.serverless) {
        this.stacks.monitoring.addDependency(this.stacks.serverless);
      }
    }
  }
} 