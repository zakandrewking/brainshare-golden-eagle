# yjs

For now, we're manually setting up a render.com service that builds based on
a GitHub connection.

Requires a Y_SWEET_PORT which I'm setting to 8080 in render, and S3_BUCKET_URL as deployed by pulumi
(looks like `s3://<bucket-name>/`).

and also:
AWS_REGION
AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID

Generate a random key with `openssl rand -base64 32` and set it as
Y_SWEET_AUTH_KEY.
