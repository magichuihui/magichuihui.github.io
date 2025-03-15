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
