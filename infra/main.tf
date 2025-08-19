# Hent info om Azure klient (subscription, tenant, etc)
data "azurerm_client_config" "current" {}

# Ressursgruppe
resource "azurerm_resource_group" "jobblo_rg" {
  name     = var.resource_group_name
  location = var.location
}

# Azure Container Registry (ACR) - Opprettelse
resource "azurerm_container_registry" "jobblo_acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

# Container App Environment
resource "azurerm_container_app_environment" "jobblo_environment" {
  name                = "jobblo-container-app-environment"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
}

# Container App med nginx
resource "azurerm_container_app" "jobblo_container_app" {
  name                         = "jobblo-container-app"
  resource_group_name          = azurerm_resource_group.jobblo_rg.name
  container_app_environment_id = azurerm_container_app_environment.jobblo_environment.id
  revision_mode                = "Multiple"

  template {
    container {
      name   = "nginx"
      image  = "nginx:latest"
      cpu    = 0.5
      memory = "1.0Gi"
    }
  }
}

# User-assigned managed identity for GitHub Actions
resource "azurerm_user_assigned_identity" "github_identity" {
  name                = "github-identity"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
}

# Federated identity credential for GitHub Actions (main branch)
resource "azurerm_federated_identity_credential" "github_oidc" {
  name                = "github-oidc"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  parent_id           = azurerm_user_assigned_identity.github_identity.id

  issuer   = "https://token.actions.githubusercontent.com"
  subject  = "repo:abdi4312/jobblo:ref:refs/heads/main"
  audience = ["api://AzureADTokenExchange"]
}

# Federated identity credential for GitHub Actions (pull requests)
resource "azurerm_federated_identity_credential" "github_oidc_pull_request" {
  name                = "github-oidc-pr"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  parent_id           = azurerm_user_assigned_identity.github_identity.id

  issuer   = "https://token.actions.githubusercontent.com"
  subject  = "repo:abdi4312/jobblo:pull_request"
  audience = ["api://AzureADTokenExchange"]
}

# Gi GitHub-identiteten rettighet til å pushe til ACR
resource "azurerm_role_assignment" "acr_push" {
  principal_id         = azurerm_user_assigned_identity.github_identity.principal_id
  role_definition_name = "AcrPush"
  scope                = azurerm_container_registry.jobblo_acr.id
}

# 1. Azure Storage Account
resource "azurerm_storage_account" "jobblo_storage" {
  name                     = "jobblostorage" # må være globalt unikt
  resource_group_name      = azurerm_resource_group.jobblo_rg.name
  location                 = azurerm_resource_group.jobblo_rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  allow_blob_public_access = false
  min_tls_version          = "TLS1_2"

  tags = {
    environment = "jobblo"
  }
}

# 2. Blob Container (f.eks. for opplastede bilder)
resource "azurerm_storage_container" "jobblo_container" {
  name                  = "bilder"
  storage_account_name  = azurerm_storage_account.jobblo_storage.name
  container_access_type = "private" # eller "blob" hvis du ønsker offentlig lesetilgang
}

# (Valgfritt) 3. Role Assignment: gi GitHub eller app tilgang til Blob Storage
resource "azurerm_role_assignment" "github_blob_access" {
  principal_id         = azurerm_user_assigned_identity.github_identity.principal_id
  role_definition_name = "Storage Blob Data Contributor"
  scope                = azurerm_storage_account.jobblo_storage.id
}
