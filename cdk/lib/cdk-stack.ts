import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class BillSplitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB 表
    const table = new dynamodb.Table(this, 'PeopleTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda 函数
    const fn = new lambda.Function(this, 'PeopleFn', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    table.grantReadWriteData(fn);

    // HTTP API，不启用 corsPreflight，让 Lambda 自己返回 CORS 头
    const api = new apigwv2.HttpApi(this, 'Api');

    // 把 GET / POST / OPTIONS 都路由到 Lambda
    api.addRoutes({
      path: '/',
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.OPTIONS,
      ],
      integration: new integrations.HttpLambdaIntegration('LambdaInt', fn),
    });

    // 输出 API Gateway URL
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: api.apiEndpoint,
    });
  }
}
