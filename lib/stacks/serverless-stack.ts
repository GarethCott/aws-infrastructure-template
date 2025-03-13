import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { InfrastructureConfig } from '../config';

/**
 * Stack for serverless resources (Lambda functions, API Gateway)
 */
export class ServerlessStack extends cdk.Stack {
  /**
   * The Lambda functions created by this stack
   */
  public readonly functions: Record<string, lambda.Function> = {};
  
  /**
   * The API Gateway created by this stack
   */
  public readonly api?: apigateway.RestApi;

  constructor(
    scope: Construct, 
    id: string, 
    config: InfrastructureConfig, 
    vpc?: ec2.IVpc,
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

    // Create serverless resources if enabled
    if (config.serverless?.createServerless) {
      // Create Lambda execution role
      const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
        roleName: `${config.projectName}-${config.environment}-lambda-role`,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      });
      
      // Add VPC access if VPC is provided
      if (vpc) {
        lambdaExecutionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
        );
      }
      
      // Create Lambda functions
      if (config.serverless.functions && config.serverless.functions.length > 0) {
        for (const functionConfig of config.serverless.functions) {
          // Create Lambda function
          const lambdaFunction = new lambda.Function(this, functionConfig.name, {
            functionName: `${config.projectName}-${config.environment}-${functionConfig.name}`,
            runtime: new lambda.Runtime(functionConfig.runtime),
            handler: functionConfig.handler,
            code: lambda.Code.fromAsset('lambda'),
            memorySize: functionConfig.memorySize || 128,
            timeout: cdk.Duration.seconds(functionConfig.timeout || 3),
            environment: functionConfig.environment || {},
            role: lambdaExecutionRole,
            vpc: vpc,
            vpcSubnets: vpc ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
          });
          
          // Store function reference
          this.functions[functionConfig.name] = lambdaFunction;
          
          // Output function ARN
          new cdk.CfnOutput(this, `${functionConfig.name}FunctionArn`, {
            value: lambdaFunction.functionArn,
            description: `The ARN of the ${functionConfig.name} Lambda function`,
            exportName: `${config.projectName}-${config.environment}-${functionConfig.name}-function-arn`,
          });
        }
      }
      
      // Create API Gateway if enabled
      if (config.serverless.createApiGateway) {
        this.api = new apigateway.RestApi(this, 'Api', {
          restApiName: `${config.projectName}-${config.environment}-api`,
          description: `API for ${config.projectName} ${config.environment} environment`,
          deployOptions: {
            stageName: config.serverless.apiStageName || 'api',
            loggingLevel: apigateway.MethodLoggingLevel.OFF,
            dataTraceEnabled: false,
            metricsEnabled: true,
          },
          defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS,
            allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
            maxAge: cdk.Duration.days(1),
          },
        });
        
        // Add Lambda integration if functions exist
        if (Object.keys(this.functions).length > 0) {
          // Get the first function as the default handler
          const defaultFunction = Object.values(this.functions)[0];
          
          // Create a proxy resource
          const proxyResource = this.api.root.addResource('{proxy+}');
          
          // Add ANY method with Lambda integration
          proxyResource.addMethod('ANY', new apigateway.LambdaIntegration(defaultFunction, {
            proxy: true,
          }));
          
          // Add OPTIONS method for CORS
          this.api.root.addMethod('OPTIONS', new apigateway.MockIntegration({
            integrationResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                  'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
                  'method.response.header.Access-Control-Allow-Origin': "'*'",
                },
              },
            ],
            passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
            requestTemplates: {
              'application/json': '{"statusCode": 200}',
            },
          }), {
            methodResponses: [
              {
                statusCode: '200',
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Headers': true,
                  'method.response.header.Access-Control-Allow-Methods': true,
                  'method.response.header.Access-Control-Allow-Origin': true,
                },
              },
            ],
          });
        }
        
        // Output API Gateway URL
        new cdk.CfnOutput(this, 'ApiUrl', {
          value: this.api.url,
          description: 'The URL of the API Gateway',
          exportName: `${config.projectName}-${config.environment}-api-url`,
        });
      }
      
      // Output Lambda execution role ARN
      new cdk.CfnOutput(this, 'LambdaExecutionRoleArn', {
        value: lambdaExecutionRole.roleArn,
        description: 'The ARN of the Lambda execution role',
        exportName: `${config.projectName}-${config.environment}-lambda-role-arn`,
      });
    }
  }
} 