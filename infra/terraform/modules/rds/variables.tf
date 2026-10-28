variable "project_name" {
  type        = string
  default     = "interest"
}

variable "environment" {
  type        = string
}

variable "vpc_id" {
  type        = string
}

variable "subnet_ids" {
  type        = list(string)
}

variable "app_security_group_ids" {
  type        = list(string)
  description = "Security groups allowed to connect to RDS"
}

variable "instance_class" {
  type        = string
  default     = "db.r6g.xlarge"
}

variable "allocated_storage" {
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  type        = number
  default     = 2000
}

variable "db_name" {
  type        = string
  default     = "interest_db"
}

variable "db_username" {
  type        = string
  default     = "interest_admin"
}

variable "db_password" {
  type        = string
  sensitive   = true
}

variable "multi_az" {
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  type        = number
  default     = 35
}

variable "max_connections" {
  type        = string
  default     = "500"
}
