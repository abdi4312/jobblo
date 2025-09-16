#########################
# CosmosDB Account
#########################
resource "azurerm_cosmosdb_account" "mongo" {
  name                       = "jobblo-cosmos-${local.env}"
  location                   = azurerm_resource_group.jobblo_rg.location
  resource_group_name        = azurerm_resource_group.jobblo_rg.name
  offer_type                 = "Standard"
  kind                       = "MongoDB"
  automatic_failover_enabled = true
  mongo_server_version       = "4.2"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.jobblo_rg.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableMongo"
  }
}

resource "azurerm_cosmosdb_mongo_database" "jobblo_db" {
  name                = "jobblodb-${local.env}"
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  account_name        = azurerm_cosmosdb_account.mongo.name
}

resource "azurerm_cosmosdb_mongo_collection" "jobs" {
  name                = "jobs-${local.env}"
  database_name       = azurerm_cosmosdb_mongo_database.jobblo_db.name
  account_name        = azurerm_cosmosdb_account.mongo.name
  resource_group_name = azurerm_resource_group.jobblo_rg.name
  throughput          = 400

  index {
    keys   = ["_id"]
    unique = true
  }

  lifecycle {
    ignore_changes = [throughput]
  }
}
