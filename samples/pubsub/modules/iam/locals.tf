locals {
  service_accounts_pubsub_full = distinct(concat(flatten([
    # Service accounts for subscribers
    for topic, config in var.pubsub_config : [
      for sub in config.subscriptions : sub.subscribers if length(sub.subscribers) > 0
    ]
    ]), flatten([
    # Service accounts for publishers
    for topic, config in var.pubsub_config : config.publishers if length(config.publishers) > 0
    ])
  ))

  service_accounts_pubsub = [for sa in local.service_accounts_pubsub_full : split("@", sa)[0]]
}
