project_id = "amyinfo"

pubsub_config = {
  "order-events" = {
    subscriptions = [
      {
        name        = "order-processor",
        subscribers = ["processor@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
      },
      {
        name        = "order-archive",
        subscribers = ["analytics@amyinfo.iam.gserviceaccount.com"]
      }
    ],
    publishers = ["order-service@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
  },
  "payment-events" = {
    subscriptions = [
      {
        name        = "payment-notifications",
        subscribers = ["notification-service@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
      }
    ],
    publishers = ["payment-service@amyinfo.iam.gserviceaccount.com"]
  },
  "test1" = {
    subscriptions = [],
    publishers = ["abcd123@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
  },
  "test2" = {
    publishers = ["aaasss@amyinfo.iam.gserviceaccount.com"],
    subscriptions = [
      {
        name        = "test2-sub",
        subscribers = []
      },
      {
        name        = "test2-sub2",
        subscribers = ["abcdef@amyinfo.iam.gserviceaccount.com", "aaasss@amyinfo.iam.gserviceaccount.com"]
      }
    ]
  }
}