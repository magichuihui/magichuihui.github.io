# print details of subscriptions
output "subscription_details" {
  value = google_pubsub_subscription.subscriptions
}
