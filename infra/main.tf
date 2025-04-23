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
