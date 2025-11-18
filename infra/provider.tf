terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0.0"
    }
  }
  required_version = ">= 1.3.0"
}


provider "azurerm" {
  features {}

  subscription_id = "1b6ef46a-1f97-4645-98b9-feb495342968"
  tenant_id       = "47f63c1f-6415-4572-ae82-ad4f36a3c4f5"
  client_id       = "de3ecbcb-2e02-44fe-af8e-64b098d83498"
  client_secret   = "4Aa8Q~dQD_bLcP70wJDWGXrZwXA6EQzMbuluMb8C"
}
