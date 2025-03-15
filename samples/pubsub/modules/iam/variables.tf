# Define a variable to store pubsub configuration
variable "pubsub_config" {
  type = map(object({
    subscriptions = list(object({
      name        = string
      subscribers = list(string)
    }))
    publishers = list(string)
  }))
  description = "Pub/Sub configuration, use topics name as key"
}
