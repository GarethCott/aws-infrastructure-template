#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { envConfig } from '../lib/config';
import { InfrastructureApp } from '../lib/app';

// Create CDK app
const app = new cdk.App();

// Create infrastructure app with environment configuration
new InfrastructureApp(app, envConfig);

// Synthesize the app
app.synth(); 