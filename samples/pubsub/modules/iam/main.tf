resource "google_service_account" "service_accounts" {
  for_each     = toset(local.service_accounts_pubsub)
  account_id   = each.value
  display_name = each.value
}

