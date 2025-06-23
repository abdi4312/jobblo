output "acr_login_server" {
  value = azurerm_container_registry.jobblo_acr.login_server
}

output "acr_username" {
  value = azurerm_container_registry.jobblo_acr.admin_username
}

output "acr_password" {
  value     = azurerm_container_registry.jobblo_acr.admin_password
  sensitive = true
}

output "client_id" {
  value = azurerm_user_assigned_identity.github_identity.client_id
}

output "tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}

output "subscription_id" {
  value = data.azurerm_client_config.current.subscription_id
}

output "azure_client_id" {
  value = azurerm_user_assigned_identity.github_identity.client_id
}

output "mongo_connection_string" {
  description = "Primary MongoDB connection string"
  value       = azurerm_cosmosdb_account.mongo.primary_mongodb_connection_string
  sensitive   = true
}
