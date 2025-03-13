Create a Terraform module to create GCP pubsub resources, including topics, subscriptions and iam permissions.

## Terraform code

```
# Define a variable to store pubsub configuration
variable "pubsub_config" {
  type = map(object({
    subscriptions = list(object({
      name        = string
      subscribers = list(string)
    }))
    publishers    = list(string)
  }))
  description = "Pub/Sub configuration, use topics name as key"
}

# Create Pub/Sub Topics
resource "google_pubsub_topic" "topics" {
  for_each = var.pubsub_config
  name     = each.key
}

# Create subscriptions for every topics
resource "google_pubsub_subscription" "subscriptions" {
  for_each = {
    for topic, config in var.pubsub_config : 
    "${topic}-${sub.name}" => {
      topic        = topic
      subscription = sub
    }
    for sub in config.subscriptions
  }

  name  = each.value.subscription.name
  topic = google_pubsub_topic.topics[each.value.topic].name

  # message retention policy, keep for 7 days
  message_retention_duration = "604800s" # 604800s = 7 days
}

# Grant Topic Publisher role to GSA
resource "google_pubsub_topic_iam_binding" "publishers" {
  for_each = {
    for topic, config in var.pubsub_config :
    "${topic}-publisher" => {
      topic     = topic
      members   = config.publishers
    } if length(config.publishers) > 0
  }

  topic  = google_pubsub_topic.topics[each.value.topic].name
  role   = "roles/pubsub.publisher"
  members = [for sa in each.value.members : "serviceAccount:${sa}"]
}

# Grant subscriber role to every subscriptions in topics
resource "google_pubsub_subscription_iam_binding" "subscribers" {
  for_each = {
    for topic, config in var.pubsub_config :
    "${topic}-${sub.name}-subscriber" => {
      subscription_name = sub.name
      members            = sub.subscribers
    }
    for sub in config.subscriptions
    if length(sub.subscribers) > 0
  }

  subscription = google_pubsub_subscription.subscriptions["${each.key}"].name
  role         = "roles/pubsub.subscriber"
  members      = [for sa in each.value.members : "serviceAccount:${sa}"]
}

# print details of subscriptions
output "subscription_details" {
  value = {
    for sub in google_pubsub_subscription.subscriptions :
    sub.name => {
      topic       = sub.topic
      subscribers = sub.subscribers
    }
  }
}
```

## terraform.tfvars

```
pubsub_config = {
  "order-events" = {
    subscriptions = [
      {
        name        = "order-processor",
        subscribers = ["processor@your-project.iam.gserviceaccount.com"]
      },
      {
        name        = "order-archive",
        subscribers = ["analytics@your-project.iam.gserviceaccount.com"]
      }
    ],
    publishers = ["order-service@your-project.iam.gserviceaccount.com"]
  },
  "payment-events" = {
    subscriptions = [
      {
        name        = "payment-notifications",
        subscribers = ["notification-service@your-project.iam.gserviceaccount.com"]
      }
    ],
    publishers = ["payment-service@your-project.iam.gserviceaccount.com"]
  }
}
```