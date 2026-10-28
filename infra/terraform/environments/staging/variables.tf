variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
}

variable "api_image" {
  type    = string
  default = "123456789012.dkr.ecr.us-east-1.amazonaws.com/interest-api:staging-latest"
}

variable "worker_image" {
  type    = string
  default = "123456789012.dkr.ecr.us-east-1.amazonaws.com/interest-worker:staging-latest"
}

variable "admin_image" {
  type    = string
  default = "123456789012.dkr.ecr.us-east-1.amazonaws.com/interest-admin:staging-latest"
}
