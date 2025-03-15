variables {
  project_id = "amyinfo"

  pubsub_config = {
    "order-events-test" = {
      subscriptions = [
        {
          name        = "order-processor-test",
          subscribers = ["processor@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
        },
        {
          name        = "order-archive-test",
          subscribers = ["analytics@amyinfo.iam.gserviceaccount.com"]
        }
      ],
      publishers = ["order-service@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
    },
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
  zone    = "us-central1-c"
}

run "pubsub" {
  module {
    source = "./modules/pubsub"
  }

  assert {
    condition = alltrue([for topic, config in var.pubsub_config: contains(keys(google_pubsub_topic.topics), topic)])

    error_message = "topics not created correctly"
  }

  assert {
    condition = alltrue([for subscription in local.subscriptions: contains(keys(google_pubsub_subscription.subscriptions), "${subscription.topic}-${subscription.name}-subscription")])

    error_message = "subscriptions not created correctly"
  }
}