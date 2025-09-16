variable "resource_group_name" {
  type        = string
  description = "Navn på resource group"
  default     = "jobblo-rg"
}

variable "location" {
  type        = string
  description = "Azure region for ressursene"
  default     = "westeurope"
}

variable "acr_name" {
  type        = string
  description = "Navn på Azure Container Registry"
  default     = "jobbloacr" # unikt suffix legges til senere
}

variable "storage_account_name" {
  type        = string
  description = "Navn på Azure Storage Account (må være globalt unikt)"
  default     = "jobblostorage" # unikt suffix legges til senere
}

variable "github_repo" {
  type        = string
  description = "GitHub repo i format bruker/repo"
  default     = "abdi4312/jobblo"
}

variable "github_main_branch" {
  type        = string
  description = "Main branch for GitHub Actions"
  default     = "main"
}
