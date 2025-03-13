#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { envConfig } from '../lib/config';
import { InfrastructureApp } from '../lib/app';

// Set AWS profile from config if specified
if (envConfig.profile) {
  process.env.AWS_PROFILE = envConfig.profile;
  console.log(`Using AWS profile: ${envConfig.profile}`);
}

// Create CDK app
const app = new cdk.App();

// Create infrastructure app with environment-based configuration
new InfrastructureApp(app, envConfig);

// Synthesize the app
app.synth();
