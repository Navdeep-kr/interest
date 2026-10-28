variable "project_name" {
  type    = string
  default = "interest"
}

variable "environment" {
  type = string
}

variable "allowed_cors_origins" {
  type    = list(string)
  default = ["*"]
}
