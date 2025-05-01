import * as aws from '@pulumi/aws';

// chunks bucket
const c = new aws.s3.Bucket("brainshare-primary", {});

// files bucket
const f = new aws.s3.Bucket("brainshare-files", {});
