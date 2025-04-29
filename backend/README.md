# backend

## set up

Generate AWS credentials and set them in the `.env` file. These might also be
stored in `~/.aws/credentials`.

```text
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## test upload

```bash
http --form POST http://localhost:8086/upload \
  file@./sample.csv \
  docId='123e4567-e89b-12d3-a456-426614174000'
```
