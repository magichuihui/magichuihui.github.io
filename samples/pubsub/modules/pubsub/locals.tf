locals {
  subscriptions = flatten([
    for topic, config in var.pubsub_config : [
      for sub in config.subscriptions : {
        topic       = topic
        name        = sub.name
        subscribers = sub.subscribers
      } if length(config.subscriptions) > 0
    ]
  ])
}
