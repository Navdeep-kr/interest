variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance size (db.r6g.xlarge recommended for 512-d HNSW index memory residency)"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "db_name" {
  type    = string
  default = "interest_db"
}

variable "db_username" {
  type    = string
  default = "interest_master"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "SecureInterestProdPass2026!"
}
