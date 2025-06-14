FROM ghcr.io/jamsocket/y-sweet:latest

EXPOSE $Y_SWEET_PORT

CMD ["y-sweet", "serve", "--host", "0.0.0.0", "--port", $Y_SWEET_PORT, "--auth", $Y_SWEET_AUTH_KEY, $S3_BUCKET_URL]
