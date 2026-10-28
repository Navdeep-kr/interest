variable "project_name" {
  type        = string
  default     = "interest"
  description = "Project name identifier"
}

variable "environment" {
  type        = string
  description = "Deployment environment (staging, production)"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "VPC CIDR block"
}

variable "availability_zones" {
  type        = list(string)
  description = "Target availability zones for subnets"
}

variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "True to deploy 1 NAT Gateway (cost-saving for staging), False for 1 per AZ (high availability for production)"
}
