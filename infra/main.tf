resource "azurerm_resource_group" "jobblo_rg" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_container_registry" "jobblo_acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

# Opprett Container App Environment
resource "azurerm_container_app_environment" "jobblo_environment" {
  name                = "jobblo-container-app-environment"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
}

# Opprett Azure Container App med nginx-bildet
resource "azurerm_container_app" "jobblo_container_app" {
  name                       = "jobblo-container-app"
  resource_group_name        = azurerm_resource_group.jobblo_rg.name
  container_app_environment_id = azurerm_container_app_environment.jobblo_environment.id
  revision_mode             = "Multiple"  # Alternativ: "Single"

  # Container template for nginx
  template {
    container {
      name   = "nginx"
      image  = "nginx:latest"  # Bruker den offentlige nginx-bildet fra Docker Hub
      cpu    = "0.5"
      memory = "1.0Gi"

    }
  }
}
# GitHub Actions OIDC Identity
resource "azurerm_user_assigned_identity" "github_identity" {
  name                = "github-identity"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
}

# Federated Identity Credential for GitHub Actions
resource "azurerm_federated_identity_credential" "github_oidc" {
  name                = "github-oidc"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  parent_id           = azurerm_user_assigned_identity.github_identity.id

  issuer              = "https://token.actions.githubusercontent.com"
  subject             = "repo:my-org/jobblo-backend:ref:refs/heads/main"

  audience            = ["api://AzureADTokenExchange"]
}

# Allow GitHub identity to push to ACR
resource "azurerm_role_assignment" "acr_push" {
  principal_id         = azurerm_user_assigned_identity.github_identity.principal_id
  role_definition_name = "AcrPush"
  scope                = azurerm_container_registry.jobblo_acr.id
}
data "azurerm_client_config" "current" {}

resource "azurerm_azuread_application" "jobblo_app" {
  name = "jobblo-github-app"
}

resource "azurerm_azuread_service_principal" "jobblo_sp" {
  application_id = azurerm_azuread_application.jobblo_app.client_id
}

resource "azurerm_azuread_service_principal_password" "jobblo_sp_password" {
  service_principal_id = azurerm_azuread_service_principal.jobblo_sp.id
  value                = random_password.password.result
  end_date_relative    = "8760h" # 1 år
}

resource "random_password" "password" {
  length  = 32
  special = true
}
