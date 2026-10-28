variable "project_name" {
  type    = string
  default = "interest"
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "acm_certificate_arn" {
  type    = string
  default = ""
}

variable "api_image" {
  type = string
}

variable "worker_image" {
  type = string
}

variable "admin_image" {
  type = string
}

variable "api_cpu" {
  type    = number
  default = 1024
}

variable "api_memory" {
  type    = number
  default = 2048
}

variable "worker_cpu" {
  type    = number
  default = 2048
}

variable "worker_memory" {
  type    = number
  default = 4096
}

variable "admin_cpu" {
  type    = number
  default = 512
}

variable "admin_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "api_max_count" {
  type    = number
  default = 20
}

variable "worker_desired_count" {
  type    = number
  default = 2
}

variable "admin_desired_count" {
  type    = number
  default = 2
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "db_host" {
  type = string
}

variable "redis_host" {
  type = string
}

variable "s3_bucket_raw" {
  type = string
}

variable "s3_bucket_hls" {
  type = string
}

variable "cdn_domain" {
  type = string
}
