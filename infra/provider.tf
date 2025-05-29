terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
  required_version = ">= 1.3.0"
}

provider "azurerm" {
  features {}

  tenant_id       = "fcb49129-e76a-43ba-bf6c-f9b095996b3a"
  subscription_id = "6e34f846-270b-456d-8716-2268f2e85596"
}
