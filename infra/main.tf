# Hent info om Azure-klienten (subscription, tenant, etc)
data "azurerm_client_config" "current" {}


# Sett miljø/suffix direkte i koden
locals {
  env = "newsub"  # f.eks. "dev", "prod", eller navn på ny subscription
}

#########################
# Ressursgruppe
#########################
resource "azurerm_resource_group" "jobblo_rg" {
  name     = "jobblo-rg-${local.env}"
  location = "westeurope"
}

#########################
# Azure Container Registry (ACR)
#########################
resource "azurerm_container_registry" "jobblo_acr" {
  name                = "jobbloacr${local.env}"  # må være globalt unikt
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

#########################
# User-assigned managed identity for GitHub Actions
#########################
resource "azurerm_user_assigned_identity" "github_identity" {
  name                = "github-identity-${local.env}"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  location            = azurerm_resource_group.jobblo_rg.location
}

#########################
# Azure Storage Account
#########################
resource "azurerm_storage_account" "jobblo_storage" {
  name                     = "jobblostorage${local.env}" # må være globalt unikt, små bokstaver
  resource_group_name      = azurerm_resource_group.jobblo_rg.name
  location                 = azurerm_resource_group.jobblo_rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

#########################
# Blob Container
#########################
resource "azurerm_storage_container" "jobblo_container" {
  name               = "bilder-${local.env}"
  storage_account_id = azurerm_storage_account.jobblo_storage.id
  container_access_type = "private"
}
