## Usage

```bash
terraform init

terraform plan -var-file=amyinfo.tfvars -target=module.pubsub
terraform apply -var-file=amyinfo.tfvars -target=module.pubsub

terraform test
```