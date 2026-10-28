variable "project_name" {
  type    = string
  default = "interest"
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "app_security_group_ids" {
  type = list(string)
}

variable "node_type" {
  type    = string
  default = "cache.m6g.large"
}

variable "num_cache_clusters" {
  type    = number
  default = 2
}

variable "automatic_failover_enabled" {
  type    = bool
  default = true
}

variable "multi_az_enabled" {
  type    = bool
  default = true
}

variable "auth_token" {
  type      = string
  sensitive = true
}

variable "snapshot_retention_limit" {
  type    = number
  default = 7
}
