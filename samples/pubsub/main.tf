module "pubsub" {
  source = "./modules/pubsub"

  project_id    = var.project_id
  pubsub_config = var.pubsub_config
}

module "iam" {
  source = "./modules/iam"

  pubsub_config = var.pubsub_config
}
