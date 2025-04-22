variable "resource_group_name" {
  type    = string
  default = "jobblo-rg"
}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "acr_name" {
  type    = string
  default = "jobbloacr123" # må være unikt globalt
}
