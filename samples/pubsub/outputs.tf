output "service_accounts_details" {
  value = {
    for sa in module.iam.service_accounts : sa.name => {
      email        = sa.email
      display_name = sa.display_name
      project      = sa.project
    }
  }
}

output "subscription_details" {
  value = module.pubsub.subscription_details
}
