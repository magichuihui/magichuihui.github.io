---
layout: post
title: Use Terraform module to manage GCP Pub/Sub service
excerpt: Create GCP Pub/Sub resources with terraform
date: 2025-03-15
tags: [gcloud]
comments: true
---

Create a Terraform module to create GCP pubsub resources, including topics, subscriptions and iam permissions.

## Terraform code

First define a Terraform variable `pubsub_config` to store your Pub/Sub configuration, then extract your subscriptions to a local variable.

The Terraform code is placed [here](https://github.com/magichuihui/magichuihui.github.io/tree/master/samples/pubsub)

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

# Create Pub/Sub Topics
resource "google_pubsub_topic" "topics" {
  for_each = var.pubsub_config
  name     = each.key
  project  = var.project_id

  # message retention policy, keep for 7 days
  message_retention_duration = "604800s"

}

# Create subscriptions for every topics
resource "google_pubsub_subscription" "subscriptions" {
  for_each = tomap({
    for subscription in local.subscriptions : "${subscription.topic}-${subscription.name}-subscription" => {
      name  = subscription.name
      topic = subscription.topic
    }
  })

  name    = each.value.name
  topic   = google_pubsub_topic.topics[each.value.topic].name
  project = var.project_id

  ack_deadline_seconds = 600
}

# Grant Topic Publisher role to GSA
resource "google_pubsub_topic_iam_binding" "publishers" {
  for_each = {
    for topic, config in var.pubsub_config :
    "${topic}-publisher" => {
      topic   = topic
      members = config.publishers
    } if length(config.publishers) > 0
  }

  topic   = google_pubsub_topic.topics[each.value.topic].name
  project = var.project_id

  role    = "roles/pubsub.publisher"
  members = [for sa in each.value.members : "serviceAccount:${sa}"]
}

# Grant subscriber role to every subscriptions in topics
resource "google_pubsub_subscription_iam_binding" "subscribers" {
  for_each = tomap({
    for subscription in local.subscriptions : "${subscription.topic}-${subscription.name}-subscriber" => {
      name    = subscription.name
      topic   = subscription.topic
      members = subscription.subscribers
    }
  })

  subscription = google_pubsub_subscription.subscriptions["${each.value.topic}-${each.value.name}-subscription"].name
  project      = var.project_id

  role    = "roles/pubsub.subscriber"
  members = [for sa in each.value.members : "serviceAccount:${sa}"]
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