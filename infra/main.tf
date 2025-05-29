
data "azurerm_client_config" "current" {}


# Ressursgruppe
resource "azurerm_resource_group" "jobblo_rg" {
  name     = var.resource_group_name
  location = var.location
}

# Azure Container Registry (ACR)
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

# Container App (med nginx)
resource "azurerm_container_app" "jobblo_container_app" {
  name                         = "jobblo-container-app"
  resource_group_name          = azurerm_resource_group.jobblo_rg.name
  container_app_environment_id = azurerm_container_app_environment.jobblo_environment.id
  revision_mode                = "Multiple"

  template {
    container {
      name   = "nginx"
      image  = "nginx:latest"
      cpu    = "0.5"
      memory = "1.0Gi"
    }
  }
}

# User-assigned identity for GitHub Actions
resource "azurerm_user_assigned_identity" "github_identity" {
  name                = "github-identity"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
}

# Federated identity credential for GitHub Actions
resource "azurerm_federated_identity_credential" "github_oidc" {
  name                = "github-oidc"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  parent_id           = azurerm_user_assigned_identity.github_identity.id

  issuer   = "https://token.actions.githubusercontent.com"
  subject = "repo:abdi4312/jobblo:ref:refs/heads/main"
  audience = ["api://AzureADTokenExchange"]
}

# Gi GitHub-identiteten tillatelse til å pushe til ACR
resource "azurerm_role_assignment" "acr_push" {
  principal_id         = azurerm_user_assigned_identity.github_identity.principal_id
  role_definition_name = "AcrPush"
  scope                = azurerm_container_registry.jobblo_acr.id
}
